import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_placeholder_jwt_secret_is_rejected():
    with pytest.raises(ValidationError):
        Settings(jwt_secret_key="change-me-to-a-long-random-value")


def test_short_jwt_secret_is_rejected():
    with pytest.raises(ValidationError):
        Settings(jwt_secret_key="too-short")


def test_access_token_lifetime_capped_at_15_minutes():
    with pytest.raises(ValidationError):
        Settings(jwt_secret_key="x"*40, jwt_access_token_ttl_minutes=60)
