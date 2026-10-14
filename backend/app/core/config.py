"""Centralized app settings, read once from environment variables.

Kept as a single pydantic-settings object so every module reads config the
same way instead of calling os.environ directly all over the codebase.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config=SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str="development"
    log_level: str="INFO"
    cors_origins: str="http://localhost:5173"

    database_url: str="postgresql+psycopg://vbx:vbx@localhost:5432/vbx"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
