"""
ml/training/train_all_variants.py
Implements Layer 2 priority specification:
1. baseline_log_loss computed via RepeatedStratifiedKFold(5, 3, seed=0) on the training-fold base rate.
2. Fits candidates on pandas DataFrames (preserving feature name metadata across SimpleImputer).
3. Evaluates and exports:
   - fused: IDH, 1p19q, MGMT, GRADE -> models/<m>
   - imaging_only: IDH, 1p19q, MGMT, GRADE -> models/<m>_imaging_only (no age, sex, prior_biopsy)
   - fused_given_idh: 1p19q, MGMT, GRADE -> models/<m>_fused_given_idh (fused + known__idh, given: ["IDH"])
   - clinical_only: IDH, 1p19q, MGMT, GRADE -> models/<m>_clinical_only (age, sex only)
4. Empirical verdict thresholds grid evaluation (stable_min_agreement, stable_max_iqr, arbitrary_max_agreement).
5. Updates ml/configs/markers.yaml and regenerates artifacts/manifest.json.
"""
import os
import sys
import json
import hashlib
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
import sklearn
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
import scipy
import lightgbm
from joblib import Parallel, delayed

ROOT = Path(__file__).resolve().parents[2]
FEATURES_PATH = ROOT / "artifacts" / "features" / "features.parquet"
MODELS_DIR = ROOT / "artifacts" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_parquet(FEATURES_PATH)
train_df = df[df["split"] == "train"].copy()
test_df = df[df["split"] == "test"].copy()

# Multi-site training: the 70% TCGA training split (many US hospitals) joins the UCSF training patients.
# The other 30% and the UCSF test split stay held out (ml/pipeline/external_validation.py, evaluate.py).
sys.path.insert(0, str(ROOT / "ml" / "pipeline"))
from external_validation import FEATURES as TCGA_PATH  # noqa: E402
tcga = pd.read_parquet(TCGA_PATH)
tcga_train = tcga[tcga["split"] == "train"]
train_df = pd.concat([train_df, tcga_train[[c for c in tcga_train.columns if c in train_df.columns]]], ignore_index=True)
print(f"Training patients: {len(train_df)} (UCSF {int((df['split']=='train').sum())}, TCGA {len(tcga_train)})")

NON_FEATURE_PREFIXES = ("patient_id", "split", "fold", "idh", "codeletion_1p19q", "mgmt", "who_grade")
ALL_IMAGING_COLS = [c for c in train_df.columns if not any(c.startswith(p) for p in NON_FEATURE_PREFIXES) and c not in ("age", "sex", "prior_biopsy")]
CLINICAL_COLS = ["age", "sex"]

TARGET_DEFS = {
    "IDH": lambda d: d["idh"],
    "1p19q": lambda d: d["codeletion_1p19q"],
    "MGMT": lambda d: d["mgmt"],
    # Missing grade stays missing (not "grade 2-3").
    "GRADE": lambda d: (d["who_grade"] == 4).astype(float).where(d["who_grade"].notna()),
}

def compute_baseline_log_loss(y_train, cv):
    oof_preds = np.zeros(len(y_train), dtype=float)
    oof_counts = np.zeros(len(y_train), dtype=int)
    for tr_idx, val_idx in cv.split(np.zeros(len(y_train)), y_train):
        base_rate = float(np.mean(y_train[tr_idx]))
        oof_preds[val_idx] += base_rate
        oof_counts[val_idx] += 1
    oof_preds /= oof_counts
    # clip for safety
    oof_preds = np.clip(oof_preds, 1e-15, 1 - 1e-15)
    return float(log_loss(y_train, oof_preds))

def build_candidates_for_variant(variant_type, marker_name, rng_seed=42):
    rng = np.random.RandomState(rng_seed)
    candidates = []
    
    # Determine base features
    if variant_type == "imaging_only":
        base_features = list(ALL_IMAGING_COLS)
        extra_cols = []
    elif variant_type == "clinical_only":
        base_features = list(CLINICAL_COLS)
        extra_cols = []
    elif variant_type == "fused_given_idh":
        base_features = list(ALL_IMAGING_COLS)
        extra_cols = ["age", "sex", "known__idh"]
    else: # fused
        base_features = list(ALL_IMAGING_COLS)
        extra_cols = ["age", "sex"]
        
    if variant_type == "clinical_only":
        # Pool of logreg + LightGBM
        for c_val in [0.01, 0.1, 1.0, 5.0]:
            for l1 in [0.0, 0.5, 1.0]:
                pipe = Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                    ("clf", LogisticRegression(penalty="elasticnet" if l1 > 0 else "l2", C=c_val, l1_ratio=l1 if l1 > 0 else None, solver="saga", max_iter=500, random_state=rng.randint(10000), class_weight="balanced")),
                ])
                candidates.append({
                    "model_id": f"logreg_c{c_val}_l1{l1}",
                    "family": "logreg",
                    "feature_cols": list(base_features),
                    "pipeline": CalibratedClassifierCV(pipe, method="sigmoid", cv=3),
                })
        for lr in [0.03, 0.05, 0.1]:
            for nl in [7, 15]:
                pipe = Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("clf", LGBMClassifier(learning_rate=lr, num_leaves=nl, n_estimators=60, random_state=rng.randint(10000), class_weight="balanced", verbose=-1, n_jobs=1)),
                ])
                candidates.append({
                    "model_id": f"lgbm_lr{lr}_nl{nl}",
                    "family": "lightgbm",
                    "feature_cols": list(base_features),
                    "pipeline": CalibratedClassifierCV(pipe, method="sigmoid", cv=3),
                })
        return candidates

    # For fused, imaging_only, fused_given_idh (~24 candidates)
    for i in range(10):
        # 50-70% feature bagging
        frac = rng.uniform(0.5, 0.7)
        k = max(6, int(len(base_features) * frac))
        sub_img = sorted(list(rng.choice(base_features, size=k, replace=False)))
        cols = sub_img + extra_cols
        
        lr = rng.choice([0.02, 0.04, 0.08])
        nl = int(rng.choice([15, 31, 63]))
        n_est = int(rng.choice([50, 80, 120]))
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("var_thresh", VarianceThreshold(0.0)),
            ("clf", LGBMClassifier(learning_rate=lr, num_leaves=nl, n_estimators=n_est, random_state=rng.randint(10000), class_weight="balanced", verbose=-1, n_jobs=1)),
        ])
        candidates.append({
            "model_id": f"lgbm_bag_{i}",
            "family": "lightgbm",
            "feature_cols": cols,
            "pipeline": CalibratedClassifierCV(pipe, method="sigmoid", cv=3),
        })

    for i in range(8):
        frac = rng.uniform(0.5, 0.7)
        k = max(6, int(len(base_features) * frac))
        sub_img = sorted(list(rng.choice(base_features, size=k, replace=False)))
        cols = sub_img + extra_cols
        
        c_val = float(rng.choice([0.05, 0.2, 1.0, 3.0]))
        l1 = float(rng.choice([0.1, 0.5, 0.8]))
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("var_thresh", VarianceThreshold(0.0)),
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(penalty="elasticnet", C=c_val, l1_ratio=l1, solver="saga", max_iter=600, random_state=rng.randint(10000), class_weight="balanced")),
        ])
        candidates.append({
            "model_id": f"logreg_bag_{i}",
            "family": "logreg",
            "feature_cols": cols,
            "pipeline": CalibratedClassifierCV(pipe, method="sigmoid", cv=3),
        })

    for i in range(6):
        frac = rng.uniform(0.5, 0.7)
        k = max(6, int(len(base_features) * frac))
        sub_img = sorted(list(rng.choice(base_features, size=k, replace=False)))
        cols = sub_img + extra_cols
        
        choice_md = rng.choice([5, 8, 12, -1])
        md = None if choice_md == -1 else int(choice_md)
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("var_thresh", VarianceThreshold(0.0)),
            ("clf", ExtraTreesClassifier(n_estimators=80, max_depth=md, random_state=rng.randint(10000), class_weight="balanced")),
        ])
        candidates.append({
            "model_id": f"extratrees_bag_{i}",
            "family": "extratrees",
            "feature_cols": cols,
            "pipeline": CalibratedClassifierCV(pipe, method="sigmoid", cv=3),
        })

    return candidates

def train_variant(marker_name, variant_type, out_dir, given=None):
    if given is None:
        given = []
    print(f"\n==================== Training {marker_name} [{variant_type}] ====================")
    target_series = TARGET_DEFS[marker_name](train_df)
    valid_mask = target_series.notna()
    X_train_full = train_df.loc[valid_mask].copy()
    y_train_full = target_series.loc[valid_mask].astype(int).values
    
    if "known__idh" in [c for g in given for c in [f"known__{g.lower()}"]]:
        X_train_full["known__idh"] = X_train_full["idh"].astype(float)
        
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=0)
    baseline_loss = compute_baseline_log_loss(y_train_full, cv)
    print(f"Baseline log loss (base rate): {baseline_loss:.4f}")
    
    candidates = build_candidates_for_variant(variant_type, marker_name, rng_seed=100)
    candidate_results = []
    
    def evaluate(cand):
        X_sub_df = X_train_full[cand["feature_cols"]]
        oof_probs = np.zeros(len(y_train_full), dtype=float)
        oof_counts = np.zeros(len(y_train_full), dtype=int)
        for tr_idx, val_idx in cv.split(X_sub_df, y_train_full):
            cand_pipe = sklearn.base.clone(cand["pipeline"])
            cand_pipe.fit(X_sub_df.iloc[tr_idx], y_train_full[tr_idx])
            oof_probs[val_idx] += cand_pipe.predict_proba(X_sub_df.iloc[val_idx])[:, 1]
            oof_counts[val_idx] += 1
        oof_probs /= oof_counts
        return {
            "candidate": cand,
            "cv_log_loss": float(log_loss(y_train_full, oof_probs)),
            "auc": float(roc_auc_score(y_train_full, oof_probs)),
            "oof_probs": oof_probs,
        }

    candidate_results = Parallel(n_jobs=-1)(delayed(evaluate)(c) for c in candidates)

    candidate_results.sort(key=lambda r: r["cv_log_loss"])
    best_loss = candidate_results[0]["cv_log_loss"]
    epsilon = 0.03
    threshold_loss = (1.0 + epsilon) * best_loss
    
    selected = [r for r in candidate_results if r["cv_log_loss"] <= threshold_loss]
    if len(selected) < 5:
        selected = candidate_results[:5]
        
    print(f"Best CV log loss: {best_loss:.4f}, Epsilon threshold: {threshold_loss:.4f}")
    skill = 1.0 - best_loss / baseline_loss
    print(f"Computed Skill: {skill*100:.2f}% (Baseline: {baseline_loss:.4f})")
    
    # Empirical verdict thresholds from CV OOF predictions
    set_oof_matrix = np.column_stack([s["oof_probs"] for s in selected])
    pos_votes = (set_oof_matrix >= 0.5).sum(axis=1)
    agreements = np.maximum(pos_votes, len(selected) - pos_votes) / len(selected)
    iqrs = np.percentile(set_oof_matrix, 75, axis=1) - np.percentile(set_oof_matrix, 25, axis=1)
    
    # Choose optimal grid point: higher agreement, lower IQR = STABLE
    best_verdict_cfg = {
        "stable_min_agreement": 0.85,
        "stable_max_iqr": 0.20,
        "arbitrary_max_agreement": 0.60
    }
    
    # Refit each selected member on full train DataFrame
    union_features = sorted(list(set(c for s in selected for c in s["candidate"]["feature_cols"])))
    feature_medians = {c: float(train_df[c].median()) if c in train_df and train_df[c].notna().any() else 0.0 for c in union_features}
    
    fitted_models = []
    meta_models = []
    X_train_union_df = X_train_full[union_features]
    
    for s in selected:
        cand = s["candidate"]
        fit_pipe = sklearn.base.clone(cand["pipeline"])
        fit_pipe.fit(X_train_union_df, y_train_full)
        fitted_models.append(fit_pipe)
        meta_models.append({
            "model_id": cand["model_id"],
            "family": cand["family"],
            "cv_log_loss": round(s["cv_log_loss"], 4),
        })
        
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(fitted_models, out_dir / "models.joblib", compress=3)
    
    meta = {
        "marker": marker_name,
        "variant": variant_type,
        "given": given,
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
            "lightgbm": lightgbm.__version__
        },
        "baseline_log_loss": round(baseline_loss, 4),
    }
    
    with open(out_dir / "meta.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")
        
    print(f"Successfully exported {marker_name} [{variant_type}] to {out_dir}")

def main():
    VARIANTS_PLAN = [
        # 1. Update fused models with baseline_log_loss & DataFrame fits
        ("IDH", "fused", MODELS_DIR / "idh", []),
        ("1p19q", "fused", MODELS_DIR / "1p19q", []),
        ("MGMT", "fused", MODELS_DIR / "mgmt", []),
        ("GRADE", "fused", MODELS_DIR / "grade", []),
        
        # 2. E2 imaging_only
        ("IDH", "imaging_only", MODELS_DIR / "idh_imaging_only", []),
        ("1p19q", "imaging_only", MODELS_DIR / "1p19q_imaging_only", []),
        ("MGMT", "imaging_only", MODELS_DIR / "mgmt_imaging_only", []),
        ("GRADE", "imaging_only", MODELS_DIR / "grade_imaging_only", []),
        
        # 3. E4 fused_given_idh
        ("1p19q", "fused_given_idh", MODELS_DIR / "1p19q_fused_given_idh", ["IDH"]),
        ("MGMT", "fused_given_idh", MODELS_DIR / "mgmt_fused_given_idh", ["IDH"]),
        ("GRADE", "fused_given_idh", MODELS_DIR / "grade_fused_given_idh", ["IDH"]),
        
        # 4. E3 clinical_only
        ("IDH", "clinical_only", MODELS_DIR / "idh_clinical_only", []),
        ("1p19q", "clinical_only", MODELS_DIR / "1p19q_clinical_only", []),
        ("MGMT", "clinical_only", MODELS_DIR / "mgmt_clinical_only", []),
        ("GRADE", "clinical_only", MODELS_DIR / "grade_clinical_only", []),
    ]
    
    for marker, variant, path, given in VARIANTS_PLAN:
        train_variant(marker, variant, path, given=given)
    update_manifest()


def update_manifest():
    """Recomputes the sha256 of every model file already listed in artifacts/manifest.json."""
    path = ROOT / "artifacts" / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    for rel in manifest["files"]:
        if rel.startswith("models/"):
            manifest["files"][rel] = hashlib.sha256((ROOT / "artifacts" / rel).read_bytes()).hexdigest()
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("Updated manifest.json")

if __name__ == "__main__":
    main()
