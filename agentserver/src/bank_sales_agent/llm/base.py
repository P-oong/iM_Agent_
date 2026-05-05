"""Role: Define the common provider interface and fallback behavior for LLM integrations."""

from __future__ import annotations

from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    """Abstract provider with built-in mock fallback on runtime failures."""

    def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        mock_fallback: str | None = None,
    ) -> str:
        """Generate text and degrade gracefully to deterministic fallback text."""
        try:
            text = self._generate_text(prompt=prompt, system_prompt=system_prompt)
        except Exception:
            return mock_fallback or self.default_mock_response(prompt)

        if not text or not text.strip():
            return mock_fallback or self.default_mock_response(prompt)
        return text.strip()

    @abstractmethod
    def _generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        """Run the underlying provider-specific generation call."""

    def default_mock_response(self, prompt: str) -> str:
        """Return a generic mock response when no provider call succeeds."""
        condensed = " ".join(prompt.split())
        return f"[mock-fallback] {condensed[:180]}"


class MockLLMProvider(BaseLLMProvider):
    """Deterministic provider used when no external LLM is configured."""

    def _generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        raise RuntimeError("No external LLM provider is configured.")
