"""Role: Create a provider adapter while keeping vendor-specific code isolated."""

from __future__ import annotations

from bank_sales_agent.config.settings import AppSettings
from bank_sales_agent.llm.base import BaseLLMProvider, MockLLMProvider
from bank_sales_agent.llm.local_provider import LocalLLMProvider
from bank_sales_agent.llm.upstage_provider import UpstageProvider


def create_llm_provider(settings: AppSettings) -> BaseLLMProvider:
    """Return the configured provider or a mock provider for deterministic runs."""
    if settings.llm_provider == "local":
        return LocalLLMProvider(
            model_name=settings.local_model_name,
            endpoint=settings.local_model_endpoint,
            api_key=settings.local_model_api_key,
        )
    if settings.llm_provider == "upstage":
        return UpstageProvider(
            api_key=settings.upstage_api_key,
            model_name=settings.upstage_model_name,
            base_url=settings.upstage_base_url,
        )
    return MockLLMProvider()
