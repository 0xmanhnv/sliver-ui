"""
Application configuration using Pydantic Settings
"""

from functools import lru_cache
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "SliverUI"
    app_env: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Security
    secret_key: str = "change-me-to-a-secure-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 7

    # Database
    database_url: str = "sqlite:///./data/sliverui.db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Sliver
    sliver_config: Optional[str] = None

    # Assemblies directory for execute-assembly (path traversal protection)
    assemblies_dir: str = "/app/data/assemblies"

    # GitHub token for armory operations (increases rate limit from 60 to 5000/hour)
    github_token: Optional[str] = None

    # CORS
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Handle comma-separated strings, JSON arrays, or empty values."""
        if isinstance(v, list):
            return v
        if not v or not v.strip():
            return ["http://localhost:5173", "http://localhost:3000"]
        # If it looks like JSON array, let pydantic handle it
        stripped = v.strip()
        if stripped.startswith("["):
            import json
            return json.loads(stripped)
        # Otherwise treat as comma-separated
        return [origin.strip() for origin in v.split(",") if origin.strip()]

    # Admin credentials (used for initial database seed)
    admin_username: str = "admin"
    admin_password: str = "changeme123"

    # Rate Limiting
    rate_limit_per_minute: int = 100

    # Logging
    log_level: str = "INFO"
    log_file: Optional[str] = None

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
