"""audit log

Revision ID: c4e1a7d93b20
Revises: b3b85d36d5ea
Create Date: 2026-10-14 20:15:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str='c4e1a7d93b20'
down_revision: str | None='b3b85d36d5ea'
branch_labels: str | Sequence[str] | None=None
depends_on: str | Sequence[str] | None=None


def upgrade() -> None:
    op.create_table(
        'audit_log',
        sa.Column('seq', sa.Integer(), autoincrement=False, nullable=False),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actor_id', sa.Uuid(), nullable=True),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('object_id', sa.String(length=64), nullable=True),
        sa.Column('model_version', sa.String(length=80), nullable=True),
        sa.Column('prev_hash', sa.String(length=64), nullable=False),
        sa.Column('hash', sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint('seq', name='pk_audit_log'),
        sa.UniqueConstraint('hash', name='uq_audit_log_hash'),
    )
    op.create_index('ix_audit_log_actor_id', 'audit_log', ['actor_id'])


def downgrade() -> None:
    op.drop_index('ix_audit_log_actor_id', table_name='audit_log')
    op.drop_table('audit_log')
