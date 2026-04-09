"""Role: Upstage provider for hosted chat completion calls."""

from __future__ import annotations

import json
from urllib import request

from bank_sales_agent.llm.base import BaseLLMProvider


class UpstageProvider(BaseLLMProvider):
    """Adapter for Upstage-hosted chat completion APIs."""

    def __init__(self, api_key: str, model_name: str, base_url: str) -> None:
        self.api_key = api_key
        self.model_name = model_name
        self.base_url = base_url

    def _generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        if not self.api_key:
            raise RuntimeError("UPSTAGE_API_KEY is not configured.")

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt or "You are a banking assistant."},
                {"role": "user", "content": prompt},
            ],
        }
        req = request.Request(
            self.base_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=20) as response:
            raw = json.loads(response.read().decode("utf-8"))
        return str(raw["choices"][0]["message"]["content"])
