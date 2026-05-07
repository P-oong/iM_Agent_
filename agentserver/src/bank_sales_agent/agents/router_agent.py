"""Router Agent - 영업 카테고리 분류"""

from __future__ import annotations

import json
import os
import re

from openai import OpenAI

from bank_sales_agent.agents.prompts import ROUTER_SYSTEM_PROMPT, build_router_prompt

MODEL = "gpt-4o"

VALID_LABELS = {"여신", "수신", "카드", "방카", "신탁", "펀드", "외환"}

# confidence 임계값: 이 값 미만이면 excluded_categories로 분류
CONFIDENCE_THRESHOLD = 0.40


def _parse_json(text: str) -> dict:
    """LLM 응답에서 JSON을 추출합니다."""
    text = text.strip()
    text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


def _validate_category(cat: dict) -> dict:
    """개별 카테고리 항목 보정"""
    label = cat.get("label", "")
    if label not in VALID_LABELS:
        cat["label"] = "수신"
    cat["confidence"] = round(max(0.0, min(1.0, float(cat.get("confidence", 0.5)))), 2)
    cat.setdefault("reasons", [])
    cat.setdefault("negative_signals", [])
    return cat


def _validate_router_result(result: dict) -> dict:
    """Router 결과 유효성 검증 및 기본값 보정"""
    result.setdefault("applicable_categories", [])
    result.setdefault("excluded_categories", [])

    # applicable_categories 보정 및 confidence 임계값 필터
    valid_cats = []
    for cat in result["applicable_categories"]:
        cat = _validate_category(cat)
        if cat["confidence"] >= CONFIDENCE_THRESHOLD:
            valid_cats.append(cat)
        else:
            result["excluded_categories"].append({
                "label": cat["label"],
                "reason": f"confidence {cat['confidence']:.2f}이 임계값({CONFIDENCE_THRESHOLD}) 미만",
            })

    # confidence 내림차순 정렬
    valid_cats.sort(key=lambda x: x["confidence"], reverse=True)
    result["applicable_categories"] = valid_cats

    # applicable_categories가 비어 있으면 기본값
    if not result["applicable_categories"]:
        result["applicable_categories"] = [
            {"label": "수신", "confidence": 0.40, "reasons": ["기본값 적용"], "negative_signals": []}
        ]

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
