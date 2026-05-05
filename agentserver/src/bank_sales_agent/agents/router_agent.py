"""Router Agent - 영업 카테고리 분류"""

from __future__ import annotations

import json
import os
import re

from openai import OpenAI

from bank_sales_agent.agents.prompts import ROUTER_SYSTEM_PROMPT, build_router_prompt

MODEL = "gpt-4o"

VALID_LABELS = {
    "DEPOSIT_SAVINGS",
    "PERSONAL_LOAN",
    "BUSINESS_LOAN",
    "CARD",
    "CASH_MANAGEMENT",
    "FX_REMITTANCE",
    "INVESTMENT_TAX",
}


def _parse_json(text: str) -> dict:
    """LLM 응답에서 JSON을 추출합니다."""
    text = text.strip()
    # 코드 블록 제거
    text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    # 첫 { } 블록 추출
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


def _validate_router_result(result: dict) -> dict:
    """Router 결과 유효성 검증 및 기본값 보정"""
    if result.get("primary_label") not in VALID_LABELS:
        result["primary_label"] = "DEPOSIT_SAVINGS"
    result.setdefault("secondary_labels", [])
    result.setdefault("confidence", 0.5)
    result.setdefault("routing_reason", [])
    result.setdefault("negative_signals", [])
    result.setdefault("recommended_specialist", f"{result['primary_label'].lower()}_specialist")
    result["do_not_use_kpi"] = True
    # confidence 범위 보정
    result["confidence"] = max(0.0, min(1.0, float(result["confidence"])))
    return result


def run_router(customer_payload: dict, api_key: str | None = None) -> dict:
    """
    고객 페이로드를 받아 영업 카테고리를 분류합니다.

    Args:
        customer_payload: Feature Mart + Live Context 결합 데이터
        api_key: OpenAI API 키 (None이면 환경변수에서 로드)

    Returns:
        Router 분류 결과 dict
    """
    key = api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

    client = OpenAI(api_key=key)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
            {"role": "user",   "content": build_router_prompt(customer_payload)},
        ],
        temperature=0.2,
        max_tokens=1000,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = _parse_json(raw)

    return _validate_router_result(result)
