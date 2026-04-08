"""Role: Load application settings for graph execution, providers, and checkpointing."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "data"

load_dotenv(PROJECT_ROOT / ".env")


class ScoreWeights(BaseModel):
    """Simple score weighting config for the deterministic recommender."""

    customer_fit: float = 0.55
    kpi_score: float = 0.30
    document_boost: float = 0.15


class AppSettings(BaseModel):
    """App-level settings for data paths, scoring, providers, and checkpointing."""

    app_name: str = "bank_sales_agent"
    app_env: str = Field(default_factory=lambda: os.getenv("APP_ENV", "local"))
    data_dir: Path = DATA_DIR
    llm_provider: str = Field(default_factory=lambda: os.getenv("LLM_PROVIDER", "none"))
    local_model_name: str = Field(default_factory=lambda: os.getenv("LOCAL_MODEL_NAME", ""))
    local_model_endpoint: str = Field(default_factory=lambda: os.getenv("LOCAL_MODEL_ENDPOINT", ""))
    local_model_api_key: str = Field(default_factory=lambda: os.getenv("LOCAL_MODEL_API_KEY", ""))
    upstage_api_key: str = Field(default_factory=lambda: os.getenv("UPSTAGE_API_KEY", ""))
    upstage_model_name: str = Field(
        default_factory=lambda: os.getenv("UPSTAGE_MODEL_NAME", "solar-pro2")
    )
    upstage_base_url: str = Field(
        default_factory=lambda: os.getenv(
            "UPSTAGE_BASE_URL",
            "https://api.upstage.ai/v1/chat/completions",
        )
    )
    top_k_recommendations: int = Field(
        default_factory=lambda: int(os.getenv("TOP_K_RECOMMENDATIONS", "3"))
    )
    checkpointer_backend: str = Field(
        default_factory=lambda: os.getenv("CHECKPOINTER_BACKEND", "memory")
    )
    sqlite_db_path: Path = Field(
        default_factory=lambda: PROJECT_ROOT
        / os.getenv("SQLITE_DB_PATH", ".langgraph/checkpoints.sqlite")
    )
    score_weights: ScoreWeights = Field(default_factory=ScoreWeights)


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Return cached application settings."""
    # TODO: add YAML-based environment overlays when scenario configuration grows.
    return AppSettings()
