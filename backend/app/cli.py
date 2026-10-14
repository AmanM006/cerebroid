"""Admin commands, run inside the API container.

    docker compose exec api python -m app.cli create-user \
        --username demo_clinician --role clinician --synthetic

The password is read from VBX_NEW_USER_PASSWORD or prompted for, never taken
as a command-line argument (it would end up in shell history and `ps`).
"""
import argparse
import getpass
import os
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models import Role, User
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


def main() -> None:
    parser=argparse.ArgumentParser(prog="python -m app.cli")
    commands=parser.add_subparsers(dest="command", required=True)

    create=commands.add_parser("create-user")
    create.add_argument("--username", required=True)
    create.add_argument("--role", required=True, choices=[r.value for r in Role])
    create.add_argument("--synthetic", action="store_true", help="mark as a synthetic demo/test account")

    args=parser.parse_args()
    if args.command=="create-user":
        create_user(args.username, Role(args.role), args.synthetic)


if __name__=="__main__":
    main()
