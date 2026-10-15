"""Caps every near-optimal set at MAX_SET_SIZE members, keeping the lowest CV log-loss ones.

Sets with no real signal (MGMT, clinical-only) put almost every candidate within epsilon of the
best, which made them 18-24 models each and pushed the API past the host's 512 MB memory. Their
members are interchangeable, so keeping the best ten changes no call that is shown and leaves
sets with signal (five to eight members) untouched. The fitted members are kept as they are; only
the list is shortened, in the same order in models.joblib and meta.json. The same cap is applied in
train_all_variants.py, so retraining reproduces it.

    backend/.venv/Scripts/python ml/training/cap_set_size.py
"""
import hashlib
import json
from pathlib import Path

import joblib

MAX_SET_SIZE=10
ROOT=Path(__file__).resolve().parents[2]
ARTIFACTS=ROOT/"artifacts"


def main() -> None:
    manifest_path=ARTIFACTS/"manifest.json"
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    for meta_path in sorted((ARTIFACTS/"models").glob("*/meta.json")):
        meta=json.loads(meta_path.read_text(encoding="utf-8"))
        if len(meta["models"])<=MAX_SET_SIZE:
            continue
        models=joblib.load(meta_path.with_name("models.joblib"))
        order=sorted(range(len(models)), key=lambda i: meta["models"][i]["cv_log_loss"])[:MAX_SET_SIZE]
        order.sort()
        joblib.dump([models[i] for i in order], meta_path.with_name("models.joblib"), compress=3)
        print(f"{meta['marker']} {meta['variant']}: {len(models)} -> {len(order)} members")
        meta["models"]=[meta["models"][i] for i in order]
        meta_path.write_text(json.dumps(meta, indent=2)+"\n", encoding="utf-8", newline="\n")
        for name in ("meta.json", "models.joblib"):
            rel=meta_path.with_name(name).relative_to(ARTIFACTS).as_posix()
            manifest["files"][rel]=hashlib.sha256((ARTIFACTS/rel).read_bytes()).hexdigest()
    manifest_path.write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8", newline="\n")


if __name__=="__main__":
    main()
