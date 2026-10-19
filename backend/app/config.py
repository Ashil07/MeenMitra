"""Application settings loaded from environment variables (see backend/.env.example)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "local"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    database_path: str = "data/meenmitra_demo.db"
    seed_on_startup: bool = True
    allow_demo_reset: bool = False

    weather_provider: Literal["demo", "open_meteo"] = "demo"
    open_meteo_base_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_timeout_seconds: float = Field(default=5.0, gt=0, le=30)

    alert_provider: Literal["mock"] = "mock"

    risk_watch_threshold: float = Field(default=40.0, gt=0, lt=100)
    risk_danger_threshold: float = Field(default=70.0, gt=0, le=100)

    ml_data_dir: str = "data/raw"
    ml_artifacts_dir: str = "artifacts"

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard(cls, value: str) -> str:
        if "*" in value:
            raise ValueError("CORS_ORIGINS must list explicit origins; '*' is not allowed")
        return value

    @model_validator(mode="after")
    def _ordered_thresholds(self) -> "Settings":
        if self.risk_watch_threshold >= self.risk_danger_threshold:
            raise ValueError("RISK_WATCH_THRESHOLD must be lower than RISK_DANGER_THRESHOLD")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def resolve(self, value: str) -> Path:
        path = Path(value)
        return path if path.is_absolute() else BACKEND_DIR / path

    @property
    def database_file(self) -> Path:
        return self.resolve(self.database_path)

    @property
    def ml_data_path(self) -> Path:
        return self.resolve(self.ml_data_dir)

    @property
    def ml_artifacts_path(self) -> Path:
        return self.resolve(self.ml_artifacts_dir)


@lru_cache
def get_settings() -> Settings:
    return Settings()
