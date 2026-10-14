"""Admin commands, run inside the API container.

    docker compose exec api python -m app.cli create-user \
        --username demo_clinician --role clinician --synthetic

The password is read from VBX_NEW_USER_PASSWORD or prompted for, never taken
as a command-line argument (it would end up in shell history and `ps`).

`seed` runs at container start, for hosts without a shell. It is idempotent and
driven only by environment variables:
    VBX_SEED_DEMO_CASES      comma-separated patient IDs, e.g. UCSF-PDGM-0061,UCSF-PDGM-0162
    VBX_EVALUATOR_PASSWORD   creates the synthetic clinician account "evaluator"
    VBX_REVIEWER_PASSWORD    creates the synthetic reviewer account "reviewer" (audit check)
"""
import argparse
import getpass
import os
import sys

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import Role, Study, StudyKind, StudyStatus, User
from app.domain.feature_store import load_feature_store
from app.db.session import get_session_factory

MIN_PASSWORD_LENGTH=12


def create_user(username: str, role: Role, synthetic: bool) -> None:
    password=os.environ.get("VBX_NEW_USER_PASSWORD") or getpass.getpass("Password: ")
    if len(password)<MIN_PASSWORD_LENGTH:
        sys.exit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")

    with get_session_factory()() as db:
        if db.scalar(select(User).where(User.username==username)):
            sys.exit(f"User {username!r} already exists.")
        db.add(User(
            username=username,
            password_hash=hash_password(password),
            role=role,
            is_synthetic=synthetic,
        ))
        db.commit()
    print(f"Created {role.value} {username!r}.")


def add_demo_case(patient_id: str) -> None:
    """Registers a public-dataset patient as a demo case; clinical fields come from its feature-table row."""
    store=load_feature_store(get_settings().feature_table_path)
    if not store.has(patient_id):
        sys.exit(f"{patient_id!r} is not in the feature table.")
    row=store.rows[patient_id]
    biopsy=row.get("prior_biopsy")
    with get_session_factory()() as db:
        if db.scalar(select(Study).where(Study.source_patient_id==patient_id)):
            sys.exit(f"{patient_id!r} is already a demo case.")
        study=Study(
            kind=StudyKind.DEMO,
            label=patient_id,
            age=int(round(row["age"])),
            sex="M" if int(row["sex"])==1 else "F",
            prior_biopsy=None if biopsy is None or biopsy!=biopsy else bool(biopsy),
            source_patient_id=patient_id,
            status=StudyStatus.READY,
        )
        db.add(study)
        db.commit()
        print(f"Added demo case {patient_id} as study {study.id}.")


def _ensure_user(username: str, role: Role, password: str) -> None:
    if len(password)<MIN_PASSWORD_LENGTH:
        print(f"Skipped {username!r}: password shorter than {MIN_PASSWORD_LENGTH} characters.")
        return
    with get_session_factory()() as db:
        if db.scalar(select(User).where(User.username==username)):
            return
        db.add(User(username=username, password_hash=hash_password(password), role=role, is_synthetic=True))
        db.commit()
    print(f"Created synthetic {role.value} {username!r}.")


def seed() -> None:
    """Creates the configured demo cases and test accounts that don't exist yet."""
    patient_ids=[p.strip() for p in os.environ.get("VBX_SEED_DEMO_CASES", "").split(",") if p.strip()]
    if patient_ids:
        store=load_feature_store(get_settings().feature_table_path)
        with get_session_factory()() as db:
            existing=set(db.scalars(select(Study.source_patient_id)))
        for patient_id in patient_ids:
            if patient_id in existing:
                continue
            if not store.has(patient_id):
                print(f"Skipped {patient_id!r}: not in the feature table.")
                continue
            add_demo_case(patient_id)
    if password:=os.environ.get("VBX_EVALUATOR_PASSWORD"):
        _ensure_user("evaluator", Role.CLINICIAN, password)
    if password:=os.environ.get("VBX_REVIEWER_PASSWORD"):
        _ensure_user("reviewer", Role.REVIEWER, password)


def main() -> None:
    parser=argparse.ArgumentParser(prog="python -m app.cli")
    commands=parser.add_subparsers(dest="command", required=True)

    create=commands.add_parser("create-user")
    create.add_argument("--username", required=True)
    create.add_argument("--role", required=True, choices=[r.value for r in Role])
    create.add_argument("--synthetic", action="store_true", help="mark as a synthetic demo/test account")

    demo=commands.add_parser("add-demo-case")
    demo.add_argument("--patient-id", required=True, help="e.g. UCSF-PDGM-0004")

    commands.add_parser("seed", help="idempotent demo cases and test accounts from environment variables")

    args=parser.parse_args()
    if args.command=="create-user":
        create_user(args.username, Role(args.role), args.synthetic)
    elif args.command=="add-demo-case":
        add_demo_case(args.patient_id)
    elif args.command=="seed":
        seed()


if __name__=="__main__":
    main()
