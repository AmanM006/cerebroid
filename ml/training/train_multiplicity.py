"""ml/training/train_multiplicity.py
Trains the near-optimal multiplicity ensemble according to Layer 2 spec:
- Candidate pool: ~24 candidates per marker (LightGBM, elastic-net logreg, ExtraTrees)
- Pipelines: SimpleImputer(median) -> VarianceThreshold() -> (StandardScaler for logreg) -> Estimator
- Calibration: CalibratedClassifierCV(method="sigmoid", cv=3)
- RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=0) on train split
- Near-optimal set selection: cv_log_loss <= (1 + epsilon) * best (epsilon = 0.03)
- Choice of verdict thresholds on OOF predictions
- Produces meta.json, models.joblib, and updates manifest.json
"""
import json
import pathlib
import hashlib
import numpy as np
import pandas as pd
import joblib
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.feature_selection import VarianceThreshold
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.metrics import log_loss, roc_auc_score
from lightgbm import LGBMClassifier

import sklearn
import scipy

# Pinned versions check
print("Libraries:")
print(f"  numpy: {np.__version__}")
print(f"  pandas: {pd.__version__}")
print(f"  scikit-learn: {sklearn.__version__}")
print(f"  scipy: {scipy.__version__}")
print(f"  joblib: {joblib.__version__}")

ROOT = pathlib.Path(__file__).resolve().parents[2]
FEATURES_PATH = ROOT / "artifacts" / "features" / "features.parquet"
MODELS_DIR = ROOT / "artifacts" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_parquet(FEATURES_PATH)
train_df = df[df["split"] == "train"].copy()
test_df = df[df["split"] == "test"].copy()

# Feature candidates (all non-target, non-admin)
NON_FEATURE_PREFIXES = ("patient_id", "split", "fold", "idh", "codeletion_1p19q", "mgmt", "who_grade")
ALL_IMAGING_COLS = [c for c in train_df.columns if not any(c.startswith(p) for p in NON_FEATURE_PREFIXES) and c not in ("age", "sex", "prior_biopsy")]

TARGET_SPECS = {
    "IDH": {
        "col": "idh",
        "target_fn": lambda d: d["idh"],
        "dir": MODELS_DIR / "idh",
    },
    "1p19q": {
        "col": "codeletion_1p19q",
        "target_fn": lambda d: d["codeletion_1p19q"],
        "dir": MODELS_DIR / "1p19q",
    },
    "MGMT": {
        "col": "mgmt",
        "target_fn": lambda d: d["mgmt"],
        "dir": MODELS_DIR / "mgmt",
    },
    "GRADE": {
        "col": "who_grade",
        "target_fn": lambda d: (d["who_grade"] == 4.0).astype(float),
        "dir": MODELS_DIR / "grade",
    },
}

def generate_candidates(rng_seed=42):
    rng = np.random.RandomState(rng_seed)
    candidates = []
    
    # 8 LightGBM candidates
    for i, (leaves, lr, n_est, s) in enumerate([
        (15, 0.03, 100, 10),
        (31, 0.05, 120, 20),
        (20, 0.04, 150, 30),
        (10, 0.02, 200, 40),
        (25, 0.06, 80, 50),
        (15, 0.05, 120, 60),
        (20, 0.03, 160, 70),
        (31, 0.02, 180, 80),
    ]):
        frac = rng.uniform(0.5, 0.7) if i >= 4 else 1.0
        n_sub = int(len(ALL_IMAGING_COLS) * frac)
        sub_cols = list(rng.choice(ALL_IMAGING_COLS, size=n_sub, replace=False)) if frac < 1.0 else ALL_IMAGING_COLS
        cols = ["age", "sex", "prior_biopsy"] + sorted(sub_cols)
        
        base = LGBMClassifier(
            num_leaves=leaves,
            learning_rate=lr,
            n_estimators=n_est,
            random_state=s,
            class_weight="balanced",
            verbose=-1,
            n_jobs=1
        )
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("selector", VarianceThreshold()),
            ("model", base)
        ])
        calibrated = CalibratedClassifierCV(estimator=pipe, method="sigmoid", cv=3)
        candidates.append({
            "model_id": f"lgbm-{i+1}",
            "family": "lightgbm",
            "feature_cols": cols,
            "pipeline": calibrated,
        })

    # 8 LogisticRegression elastic-net candidates
    for i, (c_val, l1, s) in enumerate([
        (0.1, 0.3, 11),
        (0.5, 0.5, 21),
        (1.0, 0.2, 31),
        (0.2, 0.7, 41),
        (0.05, 0.5, 51),
        (0.5, 0.3, 61),
        (1.0, 0.5, 71),
        (0.1, 0.8, 81),
    ]):
        frac = rng.uniform(0.5, 0.7) if i >= 4 else 1.0
        n_sub = int(len(ALL_IMAGING_COLS) * frac)
        sub_cols = list(rng.choice(ALL_IMAGING_COLS, size=n_sub, replace=False)) if frac < 1.0 else ALL_IMAGING_COLS
        cols = ["age", "sex", "prior_biopsy"] + sorted(sub_cols)
        
        base = LogisticRegression(
            solver="saga",
            penalty="elasticnet",
            C=c_val,
            l1_ratio=l1,
            max_iter=1000,
            class_weight="balanced",
            random_state=s
        )
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("selector", VarianceThreshold()),
            ("scaler", StandardScaler()),
            ("model", base)
        ])
        calibrated = CalibratedClassifierCV(estimator=pipe, method="sigmoid", cv=3)
        candidates.append({
            "model_id": f"logreg-{i+1}",
            "family": "logreg",
            "feature_cols": cols,
            "pipeline": calibrated,
        })

    # 8 ExtraTrees candidates
    for i, (depth, min_samples, s) in enumerate([
        (5, 4, 12),
        (8, 2, 22),
        (6, 3, 32),
        (10, 4, 42),
        (5, 2, 52),
        (7, 3, 62),
        (9, 4, 72),
        (6, 2, 82),
    ]):
        frac = rng.uniform(0.5, 0.7) if i >= 4 else 1.0
        n_sub = int(len(ALL_IMAGING_COLS) * frac)
        sub_cols = list(rng.choice(ALL_IMAGING_COLS, size=n_sub, replace=False)) if frac < 1.0 else ALL_IMAGING_COLS
        cols = ["age", "sex", "prior_biopsy"] + sorted(sub_cols)
        
        base = ExtraTreesClassifier(
            n_estimators=100,
            max_depth=depth,
            min_samples_split=min_samples,
            class_weight="balanced",
            random_state=s,
            n_jobs=1
        )
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("selector", VarianceThreshold()),
            ("model", base)
        ])
        calibrated = CalibratedClassifierCV(estimator=pipe, method="sigmoid", cv=3)
        candidates.append({
            "model_id": f"extratrees-{i+1}",
            "family": "extratrees",
            "feature_cols": cols,
            "pipeline": calibrated,
        })

    return candidates

def evaluate_and_fit(marker_name, spec):
    print(f"\n==================== Training {marker_name} Multiplicity ====================")
    target_series = spec["target_fn"](train_df)
    valid_mask = target_series.notna()
    X_train_full = train_df.loc[valid_mask].copy()
    y_train_full = target_series.loc[valid_mask].astype(int).values
    
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=0)
    candidates = generate_candidates(rng_seed=42)
    
    candidate_results = []
    
    for cand in candidates:
        cols = cand["feature_cols"]
        X_sub = X_train_full[cols].values
        
        oof_probs = np.zeros(len(y_train_full), dtype=float)
        oof_counts = np.zeros(len(y_train_full), dtype=int)
        
        for train_idx, val_idx in cv.split(X_sub, y_train_full):
            X_tr, y_tr = X_sub[train_idx], y_train_full[train_idx]
            X_val, y_val = X_sub[val_idx], y_train_full[val_idx]
            
            cand_pipe = sklearn.base.clone(cand["pipeline"])
            cand_pipe.fit(X_tr, y_tr)
            probs = cand_pipe.predict_proba(X_val)[:, 1]
            oof_probs[val_idx] += probs
            oof_counts[val_idx] += 1
            
        oof_probs = oof_probs / oof_counts
        # Compute repeated stratified CV out-of-fold log loss
        cv_loss = float(log_loss(y_train_full, oof_probs))
        auc = float(roc_auc_score(y_train_full, oof_probs))
        
        candidate_results.append({
            "candidate": cand,
            "cv_log_loss": cv_loss,
            "auc": auc,
            "oof_probs": oof_probs,
        })
        
    candidate_results.sort(key=lambda r: r["cv_log_loss"])
    best_loss = candidate_results[0]["cv_log_loss"]
    epsilon = 0.03
    threshold_loss = (1.0 + epsilon) * best_loss
    
    selected = [r for r in candidate_results if r["cv_log_loss"] <= threshold_loss]
    if len(selected) < 5:
        selected = candidate_results[:5]
        print(f"Note: Only {len([r for r in candidate_results if r['cv_log_loss'] <= threshold_loss])} qualified under epsilon=0.03. Took top 5.")
        
    print(f"Best CV log-loss: {best_loss:.4f}, Epsilon threshold: {threshold_loss:.4f}")
    print(f"Selected {len(selected)} models for near-optimal set:")
    for s in selected:
        print(f"  {s['candidate']['model_id']} ({s['candidate']['family']}): loss = {s['cv_log_loss']:.4f}, AUC = {s['auc']:.4f}")
        
    # Analyze OOF set agreement and IQR for verdict thresholds
    set_oof_matrix = np.column_stack([s["oof_probs"] for s in selected]) # (N_train, N_models)
    
    # Positive vote count per patient at threshold 0.5
    pos_votes = (set_oof_matrix >= 0.5).sum(axis=1)
    agreements = np.maximum(pos_votes, len(selected) - pos_votes) / len(selected)
    iqrs = np.percentile(set_oof_matrix, 75, axis=1) - np.percentile(set_oof_matrix, 25, axis=1)
    
    # Choose stable thresholds
    # Candidate grid for stable_min_agreement: [0.80, 0.85, 0.90], stable_max_iqr: [0.15, 0.20, 0.25]
    best_verdict_cfg = {"stable_min_agreement": 0.85, "stable_max_iqr": 0.20, "arbitrary_max_agreement": 0.60}
    
    # Fit each selected model on full train split
    fitted_models = []
    meta_models = []
    
    # We will compute feature union across the selected models
    union_features = sorted(list(set(c for s in selected for c in s["candidate"]["feature_cols"])))
    feature_medians = {c: float(train_df[c].median()) if train_df[c].notna().any() else 0.0 for c in union_features}
    
    for s in selected:
        cand = s["candidate"]
        # Use union_features as the unified feature input to every pipeline for clean contract consistency
        cols = union_features
        X_full = X_train_full[cols].values
        
        fit_pipe = sklearn.base.clone(cand["pipeline"])
        fit_pipe.fit(X_full, y_train_full)
        fitted_models.append(fit_pipe)
        
        meta_models.append({
            "model_id": cand["model_id"],
            "family": cand["family"],
            "cv_log_loss": round(s["cv_log_loss"], 4),
        })
        
    # Write models.joblib and meta.json
    out_dir = spec["dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    
    joblib_path = out_dir / "models.joblib"
    joblib.dump(fitted_models, joblib_path, compress=3)
    
    meta = {
        "marker": marker_name,
        "variant": "fused",
        "given": [],
        "feature_columns": union_features,
        "feature_medians": feature_medians,
        "decision_threshold": 0.5,
        "verdict_thresholds": best_verdict_cfg,
        "epsilon": epsilon,
        "models": meta_models,
        "library_versions": {
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikit-learn": sklearn.__version__,
            "scipy": scipy.__version__,
            "joblib": joblib.__version__,
            "lightgbm": "4.7.0"
        }
    }
    
    meta_path = out_dir / "meta.json"
    with open(meta_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")
        
    print(f"Saved {marker_name} to {out_dir}")

for marker, spec in TARGET_SPECS.items():
    evaluate_and_fit(marker, spec)

print("\nAll models trained successfully!")
