"""Role: Local LLM provider for OpenAI-compatible local inference endpoints."""

from __future__ import annotations

import json
from urllib import request

from bank_sales_agent.llm.base import BaseLLMProvider


class LocalLLMProvider(BaseLLMProvider):
    """Adapter for a local inference server that exposes chat completions."""

    def __init__(self, model_name: str, endpoint: str, api_key: str = "") -> None:
        self.model_name = model_name
        self.endpoint = endpoint
        self.api_key = api_key

    def _generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        if not self.endpoint:
            raise RuntimeError("LOCAL_MODEL_ENDPOINT is not configured.")

        payload = {
            "model": self.model_name or "local-model",
            "messages": [
                {"role": "system", "content": system_prompt or "You are a banking assistant."},
                {"role": "user", "content": prompt},
            ],
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with request.urlopen(req, timeout=20) as response:
            raw = json.loads(response.read().decode("utf-8"))
        return str(raw["choices"][0]["message"]["content"])
