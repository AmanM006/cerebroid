"""Centralized app settings, read once from environment variables.

Kept as a single pydantic-settings object so every module reads config the
same way instead of calling os.environ directly all over the codebase.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # .env is looked up in the working directory and its parent, so the repo-root
    # .env is found whether commands run from the root or from backend/.
    model_config=SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    app_env: str="development"
    log_level: str="INFO"
    cors_origins: str="http://localhost:5173"

    database_url: str="postgresql+psycopg://vbx:vbx@localhost:5432/vbx"

    # No default on purpose: the app refuses to start without a real secret,
    # so a forgotten .env can never fall back to a guessable signing key.
    jwt_secret_key: str=Field(min_length=32)
    jwt_access_token_ttl_minutes: int=Field(default=15, ge=1, le=15)
    jwt_refresh_token_ttl_days: int=Field(default=7, ge=1, le=30)

    # Repository root (holds artifacts/ and ml/configs/). The container mirrors the repo layout.
    repo_root: Path=Field(default_factory=lambda: Path(__file__).resolve().parents[3])

    login_max_failed_attempts: int=Field(default=5, ge=1)
    login_lockout_minutes: int=Field(default=15, ge=1)

    @field_validator("jwt_secret_key")
    @classmethod
    def _reject_placeholder_secret(cls, value: str) -> str:
        if "change-me" in value:
            raise ValueError("JWT_SECRET_KEY is still the .env.example placeholder")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def artifacts_root(self) -> Path:
        return self.repo_root/"artifacts"

    @property
    def feature_table_path(self) -> Path:
        return self.artifacts_root/"features"/"features.parquet"

    @property
    def markers_config_path(self) -> Path:
        return self.repo_root/"ml"/"configs"/"markers.yaml"

    @property
    def is_production(self) -> bool:
        return self.app_env=="production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # required fields come from the environment
