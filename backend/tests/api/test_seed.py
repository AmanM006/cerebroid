"""`python -m app.cli seed`: creates configured demo cases and test accounts once, and is safe to rerun."""
import pandas as pd
from sqlalchemy import select

from app import cli
from app.core.config import get_settings
from app.db.models import Role, Study, User


def test_seed_is_idempotent(db, monkeypatch, tmp_path):
    table=tmp_path/"features.parquet"
    pd.DataFrame({
        "patient_id": ["UCSF-PDGM-0001"], "age": [51.0], "sex": [1.0], "prior_biopsy": [0.0],
    }).to_parquet(table)
    settings=get_settings()
    monkeypatch.setattr(type(settings), "feature_table_path", property(lambda self: table))
    monkeypatch.setenv("VBX_SEED_DEMO_CASES", "UCSF-PDGM-0001, UCSF-PDGM-9999")
    monkeypatch.setenv("VBX_EVALUATOR_PASSWORD", "evaluator-password-1")
    monkeypatch.setenv("VBX_REVIEWER_PASSWORD", "short")

    cli.seed()
    cli.seed()

    studies=db.scalars(select(Study)).all()
    assert [s.source_patient_id for s in studies]==["UCSF-PDGM-0001"]
    assert studies[0].age==51 and studies[0].sex=="M" and studies[0].prior_biopsy is False
    users={u.username: u for u in db.scalars(select(User))}
    assert set(users)=={"evaluator"}  # reviewer skipped: password too short
    assert users["evaluator"].role==Role.CLINICIAN and users["evaluator"].is_synthetic
