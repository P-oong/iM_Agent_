"""Policy/RAG Agent - 추천 상품별 공문·규정·이벤트·필요서류 요약"""

from __future__ import annotations

import json
import os
import re

from openai import OpenAI

from bank_sales_agent.agents.prompts import POLICY_AGENT_SYSTEM_PROMPT, build_policy_agent_prompt

MODEL = "gpt-4o"


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


def _validate_policy_result(result: dict, product: dict) -> dict:
    """필수 필드 보정"""
    result.setdefault("product_id", product.get("product_id", ""))
    result.setdefault("product_name", product.get("product_name", ""))
    result.setdefault("related_docs", [])
    result.setdefault("required_documents", [])
    result.setdefault("eligibility_summary", [])
    result.setdefault("event_summary", [])
    result.setdefault("caution_points", ["최신 공문 기준으로 필요서류 및 조건을 재확인하십시오."])
    return result


def run_policy_agent(
    product: dict,
    customer_context: dict,
    retrieved_docs: list[dict],
    api_key: str | None = None,
) -> dict:
    """
    추천 상품에 대한 공문·규정·이벤트 요약을 생성합니다.

    Args:
        product: Specialist top_products의 개별 상품 dict
        customer_context: 고객 세그먼트 + live_context 정보
        retrieved_docs: policy_rag.py로 검색한 문서 목록
        api_key: OpenAI API 키

    Returns:
        policy_support dict (related_docs, required_documents, eligibility_summary, caution_points)
    """
    key = api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

    # 검색된 문서가 없으면 LLM 호출 생략 후 기본 결과 반환
    if not retrieved_docs:
        return _validate_policy_result(
            {"caution_points": ["해당 상품 관련 문서가 없습니다. 영업점 공문을 직접 확인하십시오."]},
            product,
        )

    client = OpenAI(api_key=key)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": POLICY_AGENT_SYSTEM_PROMPT},
            {"role": "user",   "content": build_policy_agent_prompt(
                product_result=product,
                customer_context=customer_context,
                retrieved_docs=retrieved_docs,
            )},
        ],
        temperature=0.1,
        max_tokens=1200,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = _parse_json(raw)

    return _validate_policy_result(result, product)
