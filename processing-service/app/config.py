from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # S3 configuration
    S3_ENDPOINT: str = "http://localhost:4566"
    S3_REGION: str = "us-east-1"
    S3_BUCKET: str = "expense-receipts"
    S3_ACCESS_KEY_ID: str = "test"
    S3_SECRET_ACCESS_KEY: str = "test"

    # AI configuration
    AI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4o-mini"
    CONFIDENCE_THRESHOLD: float = 0.7
    MAX_AI_RETRIES: int = 3

    # Backend communication
    BACKEND_URL: str = "http://localhost:8080"
    INTERNAL_API_KEY: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


def get_settings() -> Settings:
    return Settings()
