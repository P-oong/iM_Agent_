"""Sales Card Assembler Agent - 최종 직원 대시보드용 상담 카드 생성"""

from __future__ import annotations

import json
import os
import re

from openai import OpenAI

from bank_sales_agent.agents.prompts import ASSEMBLER_SYSTEM_PROMPT, build_assembler_prompt

MODEL = "gpt-4o"


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


def _validate_sales_card(card: dict, product: dict, kpi_badge: dict) -> dict:
    """개별 Sales Card 필드 보정"""
    card.setdefault("rank", product.get("rank", 1))
    card.setdefault("product_id", product.get("product_id", ""))
    card.setdefault("product_name", product.get("product_name", ""))
    card.setdefault("acceptance_probability", product.get("acceptance_probability", 0))
    card.setdefault("probability_band", product.get("probability_band", "MEDIUM"))
    card.setdefault("main_reason", "")
    card.setdefault("customer_evidence", product.get("evidence", []))
    card.setdefault("required_documents", [])
    card.setdefault("event_summary", [])
    card.setdefault("policy_cautions", product.get("risk_or_caution", []))
    card.setdefault("staff_sales_talk", "")
    card.setdefault("next_action", "")
    # KPI 뱃지는 항상 매핑 결과를 우선 사용
    card["kpi_badge"] = {
        "badge_text":    kpi_badge.get("badge_text", "KPI 해당 없음"),
        "kpi_score":     kpi_badge.get("kpi_score", 0),
        "priority_level": kpi_badge.get("priority_level", "NONE"),
        "display_color": kpi_badge.get("display_color", "gray"),
        "branch_campaign": kpi_badge.get("branch_campaign"),
    }
    return card


def _validate_assembler_result(
    result: dict,
    cust_id: str,
    specialist_result: dict,
    kpi_badge_map: dict,
) -> dict:
    """Assembler 결과 전체 보정"""
    result.setdefault("cust_id", cust_id)
    result.setdefault("sales_cards", [])

    # Specialist top_products 순서에 맞게 카드 보정
    validated_cards = []
    for product in specialist_result.get("top_products", []):
        pid = product.get("product_id", "")
        kpi_badge = kpi_badge_map.get(pid, {})
        # Assembler가 생성한 카드 중 같은 product_id를 찾음
        matched = next(
            (c for c in result.get("sales_cards", []) if c.get("product_id") == pid),
            {},
        )
        validated_cards.append(_validate_sales_card(matched, product, kpi_badge))

    result["sales_cards"] = validated_cards
    return result


def run_assembler(
    customer_payload: dict,
    router_result: dict,
    specialist_result: dict,
    policy_support_list: list[dict],
    kpi_badge_map: dict,
    api_key: str | None = None,
) -> dict:
    """
    모든 에이전트 결과를 조합해 직원 대시보드용 Sales Card를 생성합니다.

    Args:
        customer_payload: Feature Mart + Live Context
        router_result: Router Agent 결과
        specialist_result: Specialist Agent 결과
        policy_support_list: 상품별 Policy/RAG 결과 리스트
        kpi_badge_map: {product_id: kpi_badge_dict}
        api_key: OpenAI API 키

    Returns:
        { cust_id, sales_cards }
    """
    key = api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

    cust_id = customer_payload.get("cust_id", "")

    client = OpenAI(api_key=key)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": ASSEMBLER_SYSTEM_PROMPT},
            {"role": "user",   "content": build_assembler_prompt(
                customer_payload=customer_payload,
                router_result=router_result,
                specialist_result=specialist_result,
                policy_support_list=policy_support_list,
                kpi_badge_map=kpi_badge_map,
            )},
        ],
        temperature=0.3,
        max_tokens=2500,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = _parse_json(raw)

    return _validate_assembler_result(result, cust_id, specialist_result, kpi_badge_map)
