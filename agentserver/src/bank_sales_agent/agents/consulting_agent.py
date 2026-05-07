"""Consulting Package Agent - Draft → Critic → Rewrite Reflection 루프"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from openai import OpenAI

from bank_sales_agent.agents.prompts import (
    CONSULTING_DRAFT_SYSTEM,
    CONSULTING_CRITIC_SYSTEM,
    CONSULTING_REWRITE_SYSTEM,
    build_consulting_draft_prompt,
    build_consulting_critic_prompt,
    build_consulting_rewrite_prompt,
)

MODEL = "gpt-4o"

# Reflection 기준: 평균 품질 점수가 이 값 미만이면 Rewrite
QUALITY_THRESHOLD = 0.78

# 금지 표현 목록 (룰 기반 검사)
FORBIDDEN_WORDS = ["무조건", "반드시 가입", "KPI라서", "실적 때문에", "보장합니다", "오늘 가입하셔야"]


# ── 내부 유틸 ─────────────────────────────────────────────────────────────────

def _call_gpt(
    client: OpenAI,
    system: str,
    user: str,
    temperature: float = 0.3,
    max_tokens: int = 4000,
) -> dict:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raw = raw.strip()
        raw = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        # 파싱 실패 시 빈 dict 반환 (호출자가 기본값 보정)
        return {}


def _probability_label(prob: float) -> str:
    if prob >= 0.80:
        return "수락 가능성 높음"
    if prob >= 0.50:
        return "수락 가능성 보통"
    return "수락 가능성 낮음"


# ── 룰 기반 품질 검사 ──────────────────────────────────────────────────────────

def rule_based_quality_check(package: dict) -> dict[str, Any]:
    """
    상담패키지에 금지 표현, 과도한 멘트 길이, 누락 항목을 탐지합니다.
    LLM 없이 빠르게 1차 필터링합니다.
    """
    issues = []
    try:
        cards = package.get("consulting_package", {}).get("top_cards", [])
        for card in cards:
            talk = card.get("staff_talk", "")
            next_action = card.get("next_action", "")

            # 금지 표현
            for word in FORBIDDEN_WORDS:
                if word in talk:
                    issues.append({
                        "type": "FORBIDDEN_EXPRESSION",
                        "message": f"상담 멘트에 금지 표현 포함: '{word}'",
                    })

            # 멘트 길이 (한국어 기준 80자 초과면 주의)
            if len(talk) > 120:
                issues.append({
                    "type": "TOO_LONG",
                    "message": f"상담 멘트가 깁니다 ({len(talk)}자). 2문장 이내로 줄이십시오.",
                })

            # 다음 행동 누락
            if not next_action or len(next_action) < 5:
                issues.append({
                    "type": "MISSING_NEXT_ACTION",
                    "message": "next_action이 없거나 너무 짧습니다.",
                })

            # 필요서류 누락
            if not card.get("required_documents"):
                issues.append({
                    "type": "MISSING_INFO",
                    "message": "필요서류(required_documents)가 없습니다.",
                })

    except Exception:
        pass

    return {
        "pass": len(issues) == 0,
        "issues": issues,
    }


# ── Consulting Package 생성 단계 ───────────────────────────────────────────────

def _generate_draft(client: OpenAI, **kwargs: Any) -> dict:
    """1단계: 초안 생성"""
    return _call_gpt(
        client,
        system=CONSULTING_DRAFT_SYSTEM,
        user=build_consulting_draft_prompt(**kwargs),
        temperature=0.35,
    )


def _run_critic(client: OpenAI, draft: dict) -> dict:
    """2단계: Critic 평가"""
    result = _call_gpt(
        client,
        system=CONSULTING_CRITIC_SYSTEM,
        user=build_consulting_critic_prompt(draft),
        temperature=0.1,
    )
    result.setdefault("pass", True)
    result.setdefault("quality_score", {
        "conciseness": 0.8, "clarity": 0.8, "informativeness": 0.8,
        "actionability": 0.8, "compliance_safety": 0.9,
    })
    result.setdefault("issues", [])
    result.setdefault("revision_instruction", "")
    return result


def _run_rewrite(client: OpenAI, draft: dict, critic_result: dict) -> dict:
    """3단계: Rewrite 개선"""
    return _call_gpt(
        client,
        system=CONSULTING_REWRITE_SYSTEM,
        user=build_consulting_rewrite_prompt(draft, critic_result),
        temperature=0.25,
    )


def _attach_quality_score(package: dict, quality_score: dict) -> dict:
    """최종 패키지에 품질 점수 첨부"""
    if "consulting_package" in package:
        package["consulting_package"]["quality_score"] = quality_score
    return package


def _attach_probability_labels(package: dict) -> dict:
    """probability_label 필드 보정"""
    try:
        for card in package.get("consulting_package", {}).get("top_cards", []):
            prob = float(card.get("acceptance_probability", 0.5))
            card["acceptance_probability"] = round(prob, 2)
            if not card.get("probability_label"):
                card["probability_label"] = _probability_label(prob)
    except Exception:
        pass
    return package


# ── 공개 API ──────────────────────────────────────────────────────────────────

def run_consulting_package(
    customer_payload: dict,
    router_result: dict,
    specialist_result: dict,
    policy_support_list: list[dict],
    kpi_badge_map: dict,
    api_key: str | None = None,
) -> dict:
    """
    상담패키지 보고서를 Draft → Critic → Rewrite 반성(Reflection) 루프로 생성합니다.

    흐름:
        Draft 생성
        → 룰 기반 1차 검사 (Python)
        → Critic LLM 평가 (GPT-4o)
        → 품질 미달 or 룰 위반 시 Rewrite (GPT-4o)
        → 최종 JSON 반환 (quality_score 포함)

    Args:
        customer_payload: Feature Mart + Live Context
        router_result: Router Agent 결과
        specialist_result: Specialist Agent 결과
        policy_support_list: 상품별 Policy/RAG 결과 리스트
        kpi_badge_map: {product_id: kpi_badge_dict}
        api_key: OpenAI API 키

    Returns:
        { cust_id, consulting_package: { customer_brief, recommended_strategy,
          top_cards, do_not_say, quality_score }, reflection: {...} }
    """
    key = api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

    client = OpenAI(api_key=key)
    kwargs = dict(
        customer_payload=customer_payload,
        router_result=router_result,
        specialist_result=specialist_result,
        policy_support_list=policy_support_list,
        kpi_badge_map=kpi_badge_map,
    )

    # ── 1. Draft ─────────────────────────────────────────────────────────────
    draft = _generate_draft(client, **kwargs)
    _attach_probability_labels(draft)

    # ── 2. 룰 기반 1차 검사 ────────────────────────────────────────────────────
    rule_check = rule_based_quality_check(draft)

    # ── 3. Critic LLM 평가 ────────────────────────────────────────────────────
    critic_result = _run_critic(client, draft)

    qs = critic_result.get("quality_score", {})
    avg_score = round(
        sum([
            float(qs.get("conciseness", 0.8)),
            float(qs.get("clarity", 0.8)),
            float(qs.get("informativeness", 0.8)),
            float(qs.get("actionability", 0.8)),
            float(qs.get("compliance_safety", 0.9)),
        ]) / 5,
        3,
    )

    # ── 4. Rewrite 판단 ───────────────────────────────────────────────────────
    needs_rewrite = (
        not critic_result.get("pass", True)
        or not rule_check["pass"]
        or avg_score < QUALITY_THRESHOLD
    )

    if needs_rewrite:
        # 룰 위반 이슈를 Critic에 병합
        if rule_check["issues"]:
            critic_result["issues"] = critic_result.get("issues", []) + rule_check["issues"]
            if not critic_result.get("revision_instruction"):
                critic_result["revision_instruction"] = (
                    "; ".join(i["message"] for i in rule_check["issues"])
                )
        final = _run_rewrite(client, draft, critic_result)
        _attach_probability_labels(final)
        rewritten = True
    else:
        final = draft
        rewritten = False

    # ── 5. 품질 점수 첨부 ─────────────────────────────────────────────────────
    _attach_quality_score(final, qs)

    # ── 6. 메타 정보 첨부 ─────────────────────────────────────────────────────
    final["reflection"] = {
        "rewritten": rewritten,
        "avg_quality_score": avg_score,
        "quality_score": qs,
        "critic_pass": critic_result.get("pass", True),
        "rule_pass": rule_check["pass"],
        "issues": critic_result.get("issues", []) + rule_check.get("issues", []),
        "revision_instruction": critic_result.get("revision_instruction", ""),
    }

    return final
