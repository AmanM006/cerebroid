"""Alembic environment: reuses the app's settings and table metadata.

The database URL comes from DATABASE_URL (via app settings), never from
alembic.ini, so there's one source of truth and no credentials in the repo.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.db.models import Base

config=context.config
config.set_main_option("sqlalchemy.url", get_settings().database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata=Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = config.get_main_option("sqlalchemy.url")
    if url and url.startswith("sqlite"):
        from app.db.session import get_engine
        Base.metadata.create_all(get_engine())
        return

    try:
        connectable=engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        with connectable.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
            with context.begin_transaction():
                context.run_migrations()
    except Exception as e:
        import sys
        print(f"Warning: migrations failed ({e}), falling back to metadata create_all", file=sys.stderr)
        from app.db.session import get_engine
        try:
            Base.metadata.create_all(get_engine())
        except Exception as inner_e:
            print(f"Warning: metadata create_all also failed ({inner_e})", file=sys.stderr)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
