"""Specialist Agent - 카테고리별 상품 수락 확률 산출"""

from __future__ import annotations

import json
import os
import re

from openai import OpenAI

from bank_sales_agent.agents.prompts import SPECIALIST_SYSTEM_PROMPT, build_specialist_prompt

MODEL = "gpt-4o"

VALID_CATEGORIES = {"여신", "수신", "카드", "방카", "신탁", "펀드", "외환"}

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


def _validate_category_result(cat: dict) -> dict:
    """카테고리 단위 결과 보정"""
    cat.setdefault("category", "UNKNOWN")
    cat.setdefault("top_products", [])
    cat.setdefault("excluded_products", [])

    # 카테고리 confidence 범위 보정
    conf = float(cat.get("category_confidence", 0.5))
    cat["category_confidence"] = round(max(0.0, min(1.0, conf)), 2)

    # 상품은 카테고리당 최대 2개
    cat["top_products"] = [
        _validate_top_product(p) for p in cat["top_products"][:2]
    ]
    for i, p in enumerate(cat["top_products"]):
        p["rank"] = i + 1
    return cat


def _validate_specialist_result(result: dict) -> dict:
    """Specialist 카테고리별 결과 검증 및 기본값 보정"""
    result.setdefault("category_results", [])
    result["do_not_use_kpi"] = True

    valid_cats: list[dict] = []
    for cat in result["category_results"]:
        if not isinstance(cat, dict):
            continue
        label = cat.get("category", "")
        if label not in VALID_CATEGORIES:
            # 유효하지 않은 카테고리는 스킵
            continue
        valid_cats.append(_validate_category_result(cat))

    # category_confidence 내림차순 정렬
    valid_cats.sort(key=lambda c: c.get("category_confidence", 0.0), reverse=True)
    result["category_results"] = valid_cats

    # 평탄화된 top_products (전체 카테고리 합쳐서 acceptance_probability 내림차순)
    # → Policy/KPI 매핑이 한 번에 처리할 수 있도록 보조 필드 추가
    flat_products: list[dict] = []
    for cat in valid_cats:
        for p in cat.get("top_products", []):
            flat_p = {**p, "category": cat["category"], "category_confidence": cat["category_confidence"]}
            flat_products.append(flat_p)
    flat_products.sort(key=lambda p: p.get("acceptance_probability", 0.0), reverse=True)
    result["top_products_flat"] = flat_products

    return result


def run_specialist(
    router_result: dict,
    customer_payload: dict,
    candidates_by_category: dict[str, list[dict]],
    api_key: str | None = None,
) -> dict:
    """
    Router의 applicable_categories 각각에 대해 카테고리별 상위 상품 1~2개를 산출합니다.

    Args:
        router_result: Router Agent 분류 결과 (applicable_categories 포함)
        customer_payload: Feature Mart + behavior_signals 결합 데이터
        candidates_by_category: {"여신": [상품...], "수신": [상품...]} 형태의 후보
        api_key: OpenAI API 키

    Returns:
        {
            "category_results": [...카테고리별 결과...],
            "top_products_flat": [...전체 평탄화 상품...],
            "do_not_use_kpi": True
        }
    """
    key = api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

    # 후보 상품이 없는 카테고리는 스킵
    filtered_candidates = {k: v for k, v in candidates_by_category.items() if v}
    if not filtered_candidates:
        return {"category_results": [], "top_products_flat": [], "do_not_use_kpi": True}

    client = OpenAI(api_key=key)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SPECIALIST_SYSTEM_PROMPT},
            {"role": "user",   "content": build_specialist_prompt(
                router_result, customer_payload, filtered_candidates
            )},
        ],
        temperature=0.3,
        max_tokens=3000,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = _parse_json(raw)

    return _validate_specialist_result(result)
