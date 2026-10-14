"""study source patient and prior biopsy

Revision ID: b3b85d36d5ea
Revises: 005a5ebe2803
Create Date: 2026-10-14 14:12:16.289493
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str='b3b85d36d5ea'
down_revision: str | None='005a5ebe2803'
branch_labels: str | Sequence[str] | None=None
depends_on: str | Sequence[str] | None=None


def upgrade() -> None:
    op.add_column('studies', sa.Column('prior_biopsy', sa.Boolean(), nullable=True))
    op.add_column('studies', sa.Column('source_patient_id', sa.String(length=32), nullable=True))
    op.create_unique_constraint('uq_studies_source_patient_id', 'studies', ['source_patient_id'])


def downgrade() -> None:
    op.drop_constraint('uq_studies_source_patient_id', 'studies', type_='unique')
    op.drop_column('studies', 'source_patient_id')
    op.drop_column('studies', 'prior_biopsy')
