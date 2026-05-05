"""Specialist Agent - 상품 수락 확률 산출"""

from __future__ import annotations

import json
import os
import re

from openai import OpenAI

from bank_sales_agent.agents.prompts import SPECIALIST_SYSTEM_PROMPT, build_specialist_prompt

MODEL = "gpt-4o"

PROBABILITY_BANDS = {
    "HIGH": (0.80, 1.00),
    "MEDIUM": (0.40, 0.79),
    "LOW": (0.00, 0.39),
}


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


def _band_from_prob(prob: float) -> str:
    if prob >= 0.80:
        return "HIGH"
    if prob >= 0.40:
        return "MEDIUM"
    return "LOW"


def _validate_top_product(product: dict) -> dict:
    """개별 추천 상품 필드 보정"""
    prob = float(product.get("acceptance_probability", 0.5))
    prob = max(0.0, min(1.0, prob))
    product["acceptance_probability"] = round(prob, 2)
    product["probability_band"] = _band_from_prob(prob)

    sb = product.get("score_breakdown", {})
    for key in ["need_fit", "product_gap", "timing_fit", "response_signal", "friction_risk"]:
        sb[key] = round(max(0.0, min(1.0, float(sb.get(key, 0.5)))), 2)
    product["score_breakdown"] = sb

    product.setdefault("evidence", [])
    product.setdefault("risk_or_caution", [])
    product.setdefault("recommended_talk_direction", "")
    return product


def _validate_specialist_result(result: dict) -> dict:
    """Specialist 결과 유효성 검증 및 기본값 보정"""
    result.setdefault("category", "UNKNOWN")
    result.setdefault("top_products", [])
    result.setdefault("excluded_products", [])
    result.setdefault("confidence", 0.5)
    result["do_not_use_kpi"] = True

    # 상품은 최대 2개
    result["top_products"] = [
        _validate_top_product(p) for p in result["top_products"][:2]
    ]

    # rank 재정렬
    for i, p in enumerate(result["top_products"]):
        p["rank"] = i + 1

    # confidence 범위 보정
    result["confidence"] = max(0.0, min(1.0, float(result["confidence"])))
    return result


def run_specialist(
    router_result: dict,
    customer_payload: dict,
    candidate_products: list[dict],
    api_key: str | None = None,
) -> dict:
    """
    Router 결과 기반으로 수락 확률이 높은 상품 1~2개를 산출합니다.

    Args:
        router_result: Router Agent 분류 결과
        customer_payload: Feature Mart + Live Context 결합 데이터
        candidate_products: 카테고리별 후보 상품 목록
        api_key: OpenAI API 키

    Returns:
        Specialist 추천 결과 dict
    """
    key = api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

    client = OpenAI(api_key=key)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SPECIALIST_SYSTEM_PROMPT},
            {"role": "user",   "content": build_specialist_prompt(
                router_result, customer_payload, candidate_products
            )},
        ],
        temperature=0.3,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = _parse_json(raw)

    return _validate_specialist_result(result)
