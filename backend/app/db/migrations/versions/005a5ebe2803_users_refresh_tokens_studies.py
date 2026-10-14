"""users, refresh tokens, studies

Revision ID: 005a5ebe2803
Revises:
Create Date: 2026-10-14 12:07:15.762944
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str='005a5ebe2803'
down_revision: str | None=None
branch_labels: str | Sequence[str] | None=None
depends_on: str | Sequence[str] | None=None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('username', sa.String(length=64), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('clinician', 'reviewer', name='user_role'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False),
        sa.Column('failed_login_count', sa.Integer(), nullable=False),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('family_id', sa.Uuid(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('replaced_by_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['replaced_by_id'], ['refresh_tokens.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_refresh_tokens_family_id'), 'refresh_tokens', ['family_id'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_token_hash'), 'refresh_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)

    op.create_table(
        'studies',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('kind', sa.Enum('demo', 'upload', name='study_kind'), nullable=False),
        sa.Column('owner_id', sa.Uuid(), nullable=True),
        sa.Column('label', sa.String(length=64), nullable=False),
        sa.Column('age', sa.Integer(), nullable=False),
        sa.Column('sex', sa.String(length=1), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'processing', 'ready', 'failed', name='study_status'),
            nullable=False,
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "(kind = 'demo' AND owner_id IS NULL) OR (kind = 'upload' AND owner_id IS NOT NULL)",
            name='ck_studies_owner_matches_kind',
        ),
        sa.CheckConstraint("sex IN ('M', 'F')", name='ck_studies_sex'),
        sa.CheckConstraint('age BETWEEN 18 AND 100', name='ck_studies_age_range'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_studies_owner_id'), 'studies', ['owner_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_studies_owner_id'), table_name='studies')
    op.drop_table('studies')
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_token_hash'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_family_id'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_table('users')
    for enum_name in ('study_status', 'study_kind', 'user_role'):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
