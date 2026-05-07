"""FastAPI 서버 — 레거시 LangGraph 엔드포인트와 신규 iM BRIDGE Agent 엔드포인트를 함께 제공합니다.

[레거시] 프론트엔드에서 계속 사용 중인 엔드포인트
  POST /api/analyze          — 구 LangGraph 파이프라인 (CSV 기반)
  POST /analyze-opportunities — GPT 직접 호출 영업기회 분석

[신규] iM BRIDGE 멀티에이전트 파이프라인
  POST /api/bridge/analyze           — Router + Specialist
  POST /api/bridge/sales-card        — + RAG/Policy + KPI + Assembler
  POST /api/bridge/consulting-package — + 상담패키지 Reflection 보고서
"""

from __future__ import annotations

import json
import os
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI as _OpenAI
from pydantic import BaseModel, Field

from bank_sales_agent.config.settings import get_settings

# ── 레거시 LangGraph 그래프 (프론트엔드 /api/analyze 호환) ──────────────────
from bank_sales_agent.graph.build_graph import build_sales_graph

# ── 신규 iM BRIDGE Agent 모듈 ──────────────────────────────────────────────
from bank_sales_agent.agents.router_agent import run_router
from bank_sales_agent.agents.specialist_agent import run_specialist
from bank_sales_agent.agents.policy_agent import run_policy_agent
from bank_sales_agent.agents.assembler_agent import run_assembler
from bank_sales_agent.agents.consulting_agent import run_consulting_package
from bank_sales_agent.services.feature_mart import (
    get_feature_mart,
    get_customer_basic_info,
    build_customer_payload,
)
from bank_sales_agent.services.product_catalog import (
    get_candidate_products,
    get_candidates_by_category,
)
from bank_sales_agent.services.policy_rag import retrieve_policy_docs
from bank_sales_agent.services.kpi_mapper import map_kpi_badges_for_products


# ── 레거시 Graph 싱글톤 (서버 시작 시 1회 빌드) ─────────────────────────────
_graph: Any = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _graph
    settings = get_settings()
    try:
        _graph = build_sales_graph(settings)
    except Exception as exc:
        # CSV 데이터가 없어도 신규 Bridge 엔드포인트는 정상 동작
        import logging
        logging.getLogger(__name__).warning("레거시 LangGraph 초기화 실패 (Bridge 엔드포인트는 영향 없음): %s", exc)
        _graph = None
    yield


app = FastAPI(title="iM Bank Sales Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ─────────────────────────────────────────────

class FrontendCustomer(BaseModel):
    id: str
    name: str
    age: int = 30
    gender: str = "남"
    job: str = ""
    customerType: str = "개인"
    annualIncome: float = 3000
    creditScore: int = 700
    totalAssets: float = 0
    totalDebt: float = 0
    grade: str = "일반"
    products: list[str] = Field(default_factory=list)
    notes: str = ""


class AnalyzeRequest(BaseModel):
    customer: FrontendCustomer


class OpportunityItem(BaseModel):
    product: str
    reason: str
    priority: str
    kpiScore: int


class AnalysisResult(BaseModel):
    customerSummary: str = ""
    financialScore: int = 50
    financialHealthLabel: str = "보통"
    opportunities: list[OpportunityItem] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    recommendedScript: str = ""
    nextActions: list[str] = Field(default_factory=list)


# ── Customer mapping helpers ───────────────────────────────────────────────

def _map_to_agent_customer(c: FrontendCustomer) -> dict[str, Any]:
    """Transform frontend DummyCustomer → agentserver Customer schema."""
    age = max(c.age, 18)
    monthly_income = c.annualIncome / 12

    # Segment
    if c.customerType == "법인" or c.grade == "VIP":
        segment = "affluent"
    elif c.customerType == "개인사업자":
        segment = "family_builder"
    elif age < 35:
        segment = "young_professional"
    elif age < 50:
        segment = "family_builder"
    else:
        segment = "retiree"

    life_stage_map = {
        "young_professional": "starter",
        "family_builder": "growth",
        "retiree": "retirement",
        "affluent": "expansion",
    }

    # Primary goal
    if c.totalDebt > c.totalAssets:
        primary_goal = "reduce_loan_cost"
    elif age >= 55:
        primary_goal = "protect_assets"
    elif c.annualIncome > 50_000 or c.grade == "VIP":
        primary_goal = "grow_investments"
    else:
        primary_goal = "build_savings"

    digital_engagement = "high" if age < 40 else ("medium" if age < 55 else "low")
    preferred_channel = "mobile" if age < 40 else ("hybrid" if age < 55 else "branch")

    return {
        "customer_id": c.id,
        "name": c.name,
        "age": age,
        "segment": segment,
        "monthly_income": float(monthly_income),
        "assets": float(c.totalAssets),
        "digital_engagement": digital_engagement,
        "life_stage": life_stage_map.get(segment, "growth"),
        "primary_goal": primary_goal,
        "preferred_channel": preferred_channel,
    }


def _compute_financial_score(c: FrontendCustomer) -> tuple[int, str]:
    """Compute a 0-100 financial score and Korean health label from customer data."""
    credit_component = min(c.creditScore / 10, 100) * 0.55
    assets = max(c.totalAssets, 0)
    debt = max(c.totalDebt, 0)
    debt_ratio = debt / max(assets, 1)
    debt_component = max(0.0, 1.0 - min(debt_ratio, 2.0) / 2.0) * 45
    score = int(credit_component + debt_component)
    score = max(0, min(100, score))

    if score >= 80:
        label = "우수"
    elif score >= 65:
        label = "양호"
    elif score >= 50:
        label = "보통"
    elif score >= 35:
        label = "주의"
    else:
        label = "위험"

    return score, label


def _map_result_to_analysis(
    result: dict[str, Any],
    c: FrontendCustomer,
) -> AnalysisResult:
    """Map LangGraph graph output → AnalysisResult for the frontend."""
    top_products: list[dict[str, Any]] = result.get("top_products") or result.get("recommendations") or []
    crm_draft: dict[str, Any] = result.get("crm_draft") or {}
    policy_flags: list[str] = result.get("policy_flags") or []

    # Opportunities
    opportunities: list[OpportunityItem] = []
    for p in top_products:
        score = float(p.get("total_score", 0))
        priority = "높음" if score >= 70 else ("중간" if score >= 50 else "낮음")
        reason = (
            p.get("customer_message")
            or "; ".join(p.get("reasons", []))
            or p.get("customer_value", "")
        )
        opportunities.append(
            OpportunityItem(
                product=p.get("product_name", ""),
                reason=reason,
                priority=priority,
                kpiScore=int(p.get("kpi_score", 0)),
            )
        )

    # Summary & script
    customer_summary = crm_draft.get("summary", "")
    if not customer_summary and top_products:
        customer_summary = top_products[0].get("customer_message", "")

    # Next actions
    next_actions: list[str] = []
    if crm_draft.get("next_actions"):
        next_actions = [a.get("title", "") for a in crm_draft["next_actions"] if a.get("title")]

    financial_score, health_label = _compute_financial_score(c)

    return AnalysisResult(
        customerSummary=customer_summary,
        financialScore=financial_score,
        financialHealthLabel=health_label,
        opportunities=opportunities,
        risks=policy_flags,
        recommendedScript=customer_summary,
        nextActions=next_actions,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalysisResult)
async def analyze(req: AnalyzeRequest) -> AnalysisResult:
    if _graph is None:
        raise HTTPException(status_code=503, detail="Graph not initialized.")

    c = req.customer
    customer_profile = _map_to_agent_customer(c)

    thread_id = uuid.uuid4().hex
    config = {"configurable": {"thread_id": thread_id}}

    try:
        from langgraph.types import Command  # type: ignore[import]
    except ImportError:
        Command = None  # type: ignore[assignment,misc]

    try:
        result: dict[str, Any] = _graph.invoke(
            {
                "thread_id": thread_id,
                "customer_id": c.id,
                "customer_profile": customer_profile,
            },
            config=config,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    errors = result.get("errors") or []
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(str(e) for e in errors))

    # If the graph was interrupted at human_review_node, auto-approve the top product
    interrupted = result.get("__interrupt__") or (result.get("review_status") == "pending")
    if interrupted and Command is not None:
        top_products: list[dict[str, Any]] = result.get("top_products") or result.get("recommendations") or []
        auto_product_id = top_products[0].get("product_id") if top_products else None
        try:
            result = _graph.invoke(
                Command(
                    resume={
                        "approved_product_id": auto_product_id,
                        "review_action": "approve" if auto_product_id else "end",
                        "approval_note": "Auto-approved by API.",
                    }
                ),
                config=config,
            )
        except Exception:
            pass  # use the partial result if resume fails

    return _map_result_to_analysis(result, c)


# ── GPT 영업기회 분석 엔드포인트 ───────────────────────────────────────────

class AccountItem(BaseModel):
    product: str
    balance: float

class TransactionItem(BaseModel):
    date: str
    description: str
    amount: float

class BusinessInfo(BaseModel):
    companyName: str
    industry: str
    annualRevenue: Optional[str] = None
    employeeCount: Optional[int] = None

class CustomerForAnalysis(BaseModel):
    name: str
    type: str  # 개인 | 개인사업자 | 법인
    grade: str
    products: List[str]
    accounts: List[AccountItem]
    transactions: List[TransactionItem]
    businessInfo: Optional[BusinessInfo] = None
    visitPurpose: str
    aiEvent: str

class OppAnalysisRequest(BaseModel):
    customer: CustomerForAnalysis

# 프롬프트는 서버에서만 보관 (프론트에 노출 안 됨)
_SYSTEM_PROMPT = """당신은 iM뱅크(대구은행) 창구 행원을 보조하는 AI 영업 분석 전문가입니다.
고객 데이터를 분석하여 영업기회를 발굴하고 상담 멘트를 생성합니다.

반드시 아래 JSON 형식 그대로 응답하세요 (마크다운·코드블록 없이 순수 JSON만):
{
  "summary": "고객 분석 요약 (2~3문장, 자연스러운 한국어)",
  "keyMetrics": [
    { "label": "지표명", "value": "수치 또는 설명", "highlight": true }
  ],
  "opportunities": [
    {
      "rank": 1,
      "title": "영업기회 제목",
      "score": 85,
      "analysisPoints": [
        "근거 1 (구체적 수치 포함)",
        "근거 2",
        "근거 3",
        "근거 4"
      ],
      "script": "행원이 실제로 사용할 수 있는 자연스러운 상담 멘트 (2~3문장)",
      "customerBenefit": "고객 혜택 요약",
      "bankBenefit": "은행 기대효과 요약"
    }
  ],
  "coreMessage": "핵심 메시지 한 문장"
}

규칙:
- keyMetrics는 5~6개
- opportunities는 반드시 3개 (rank 1~3), score는 70~95 범위
- analysisPoints는 각 4개, 실제 데이터 수치를 구체적으로 언급
- script는 행원 말투로 자연스럽게, BIZFAST·태블릿·전자서명 언급 금지
- 모든 금액은 한국어 단위(만 원, 억 원) 사용
- JSON 외 다른 텍스트 절대 출력 금지"""


def _build_customer_prompt(c: CustomerForAnalysis) -> str:
    total_balance = sum(a.balance for a in c.accounts)
    account_lines = "\n".join(f"  - {a.product}: {int(a.balance):,}원" for a in c.accounts)
    tx_lines = "\n".join(
        f"  - {t.date} {t.description} {'+' if t.amount >= 0 else ''}{int(t.amount):,}원"
        for t in c.transactions
    )
    prompt = (
        f"[고객 정보]\n"
        f"고객명: {c.name}\n"
        f"고객유형: {c.type}\n"
        f"등급: {c.grade}\n"
        f"보유상품: {', '.join(c.products)}\n"
        f"총 잔액: {int(total_balance):,}원\n\n"
        f"[계좌 현황]\n{account_lines}\n\n"
        f"[최근 거래]\n{tx_lines}"
    )
    if c.businessInfo:
        b = c.businessInfo
        emp = f"\n직원 수: {b.employeeCount}명" if b.employeeCount else ""
        prompt += (
            f"\n\n[사업 정보]\n"
            f"상호: {b.companyName}\n"
            f"업종: {b.industry}\n"
            f"연매출: {b.annualRevenue or '미확인'}{emp}"
        )
    prompt += (
        f"\n\n[내점 맥락]\n"
        f"내점 목적: {c.visitPurpose}\n"
        f"AI 감지 이벤트: {c.aiEvent}\n\n"
        f"위 고객을 분석하여 영업기회 TOP 3와 상담 전략을 JSON으로 생성하세요."
    )
    return prompt


@app.post("/analyze-opportunities")
async def analyze_opportunities(req: OppAnalysisRequest) -> Dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")

    client = _OpenAI(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": _build_customer_prompt(req.customer)},
            ],
            temperature=0.7,
            max_tokens=2000,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI 호출 실패: {exc}") from exc

    raw = response.choices[0].message.content or ""
    json_text = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(json_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"GPT 응답 파싱 실패: {raw[:200]}")


# ── iM BRIDGE Agent 엔드포인트 ────────────────────────────────────────────────

class LiveContext(BaseModel):
    visit_reason_code: str = ""
    counter_task: str = ""
    staff_note: str = ""


class BridgeAnalyzeRequest(BaseModel):
    cust_id: str
    live_context: LiveContext = Field(default_factory=LiveContext)


class BridgeAnalyzeResponse(BaseModel):
    cust_id: str
    router_result: Dict[str, Any]
    specialist_result: Dict[str, Any]
    customer_payload: Dict[str, Any] = Field(default_factory=dict)


@app.post("/api/bridge/analyze", response_model=BridgeAnalyzeResponse)
async def bridge_analyze(req: BridgeAnalyzeRequest) -> BridgeAnalyzeResponse:
    """
    iM BRIDGE Agent 메인 분석 엔드포인트.
    Feature Mart 조회 → Router → Specialist → 추천 결과 반환
    """
    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")

    # 1. Feature Mart 조회
    try:
        feature_mart_json = get_feature_mart(req.cust_id, settings.db_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not feature_mart_json:
        raise HTTPException(
            status_code=404,
            detail=f"고객 {req.cust_id}의 Feature Mart 데이터가 없습니다. 배치 파이프라인을 먼저 실행하세요.",
        )

    # 2. 고객 기본 정보 조회
    basic_info = get_customer_basic_info(req.cust_id, settings.db_path)

    # 3. Feature Mart → customer_payload 변환
    customer_payload = build_customer_payload(feature_mart_json, basic_info)

    # 4. Router Agent
    try:
        router_result = run_router(customer_payload, api_key=api_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Router Agent 오류: {exc}")

    # 5. 후보 상품 조회 (applicable_categories 카테고리별 그룹화)
    customer_type = feature_mart_json.get("customer_segment", {}).get("customer_type", "개인")
    applicable_labels = [
        cat["label"] for cat in router_result.get("applicable_categories", [])
    ]
    candidates_by_category = get_candidates_by_category(
        applicable_labels=applicable_labels,
        customer_type=customer_type,
        db_path=settings.db_path,
    )

    if not candidates_by_category:
        raise HTTPException(status_code=404, detail="해당 카테고리에 적합한 후보 상품이 없습니다.")

    # 6. Specialist Agent (카테고리별 동시 분석)
    try:
        specialist_result = run_specialist(
            router_result=router_result,
            customer_payload=customer_payload,
            candidates_by_category=candidates_by_category,
            api_key=api_key,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Specialist Agent 오류: {exc}")

    return BridgeAnalyzeResponse(
        cust_id=req.cust_id,
        router_result=router_result,
        specialist_result=specialist_result,
        customer_payload=customer_payload,
    )


class SalesCardResponse(BaseModel):
    cust_id: str
    router_result: Dict[str, Any]
    specialist_result: Dict[str, Any]
    customer_payload: Dict[str, Any] = Field(default_factory=dict)
    policy_support: List[Dict[str, Any]] = Field(default_factory=list)
    kpi_badges: Dict[str, Any] = Field(default_factory=dict)
    sales_cards: List[Dict[str, Any]]


@app.post("/api/bridge/sales-card", response_model=SalesCardResponse)
async def bridge_sales_card(req: BridgeAnalyzeRequest) -> SalesCardResponse:
    """
    iM BRIDGE Agent 전체 파이프라인 엔드포인트.
    Feature Mart → Router → Specialist → RAG/Policy → KPI Mapper → Sales Card Assembler
    """
    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")

    try:
        customer_payload, router_result, specialist_result, policy_support_list, kpi_badge_map = (
            await _run_full_pipeline(req.cust_id, settings, api_key)
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"파이프라인 오류: {exc}")

    try:
        assembled = run_assembler(
            customer_payload=customer_payload,
            router_result=router_result,
            specialist_result=specialist_result,
            policy_support_list=policy_support_list,
            kpi_badge_map=kpi_badge_map,
            api_key=api_key,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Assembler Agent 오류: {exc}")

    return SalesCardResponse(
        cust_id=req.cust_id,
        router_result=router_result,
        specialist_result=specialist_result,
        customer_payload=customer_payload,
        policy_support=policy_support_list,
        kpi_badges=kpi_badge_map,
        sales_cards=assembled.get("sales_cards", []),
    )


# ── 상담패키지 보고서 (전체 파이프라인 최종) ────────────────────────────────────

class ConsultingPackageResponse(BaseModel):
    """
    iM BRIDGE 최종 응답.
    프론트엔드는 아래 4가지 영역을 모두 받아 시각화할 수 있습니다.

    [영역 1] feature_mart_summary  : 피처마트 핵심 + behavior_signals + explainable_signals
    [영역 2] router_result          : applicable_categories / excluded_categories
    [영역 3] specialist_result      : category_results (카테고리별 top_products + score_breakdown)
    [영역 4] policy_support / kpi_badges : 상위 상품의 RAG 문서 요약 + KPI 사후관리
    [통합]  consulting_package      : 위 4가지를 종합한 최종 상담패키지(직원용)
    """
    cust_id: str
    router_result: Dict[str, Any]
    specialist_result: Dict[str, Any]
    feature_mart_summary: Dict[str, Any] = Field(default_factory=dict)
    policy_support: List[Dict[str, Any]] = Field(default_factory=list)
    kpi_badges: Dict[str, Any] = Field(default_factory=dict)
    consulting_package: Dict[str, Any]
    reflection: Dict[str, Any]


def _build_feature_mart_summary(customer_payload: dict) -> Dict[str, Any]:
    """
    프론트 표시용 피처마트 요약.
    DB가 R/F/M/P/C 약어 키를 사용하므로 그대로 매핑하고,
    behavior_signals / explainable_signals 는 customer_payload.feature_mart 에서 가져옵니다.
    """
    fm = customer_payload.get("feature_mart", {})
    cust_seg = fm.get("customer_segment", {})
    rfm_pc = fm.get("rfm_pc", {})

    R = rfm_pc.get("R", {}) or {}
    F = rfm_pc.get("F", {}) or {}
    M = rfm_pc.get("M", {}) or {}
    P = rfm_pc.get("P", {}) or {}
    C = rfm_pc.get("C", {}) or {}

    behavior_signals = fm.get("behavior_signals", {}) or {}
    explainable_signals = fm.get("explainable_signals", []) or []

    # 화면 카드용 핵심 지표 묶음 (실제 build_feature_mart.py 키 기준)
    headline_metrics = {
        "recency": {
            "days_since_last_branch_visit": R.get("days_since_last_branch_visit"),
            "days_since_last_mobile_login": R.get("days_since_last_mobile_login"),
            "days_until_nearest_loan_maturity": R.get("days_until_nearest_loan_maturity"),
            "days_until_nearest_deposit_maturity": R.get("days_until_nearest_deposit_maturity"),
            "recent_salary_deposit_flag": R.get("recent_salary_deposit_flag"),
            "recent_large_outflow_flag": R.get("recent_large_outflow_flag"),
        },
        "frequency": {
            "transfer_cnt_30d": F.get("transfer_cnt_30d"),
            "branch_visit_cnt_90d": F.get("branch_visit_cnt_90d"),
            "mobile_login_cnt_30d": F.get("mobile_login_cnt_30d"),
            "salary_deposit_months_6m": F.get("salary_deposit_months_6m"),
            "merchant_deposit_cnt_30d": F.get("merchant_deposit_cnt_30d"),
            "business_expense_cnt_30d": F.get("business_expense_cnt_30d"),
        },
        "monetary": {
            "avg_balance_3m": M.get("avg_balance_3m"),
            "monthly_card_spend_amt": M.get("monthly_card_spend_amt"),
            "loan_balance_amt": M.get("loan_balance_amt"),
            "deposit_maturity_amt_60d": M.get("deposit_maturity_amt_60d"),
            "idle_cash_amt": M.get("idle_cash_amt"),
            "avg_balance_percentile": M.get("avg_balance_percentile"),
        },
        "product_gap": {
            "has_salary_account": P.get("has_salary_account"),
            "has_credit_card": P.get("has_credit_card"),
            "has_loan": P.get("has_loan"),
            "has_business_account": P.get("has_business_account"),
            "has_merchant_account": P.get("has_merchant_account"),
            "has_isa": P.get("has_isa"),
        },
        "contact": {
            "recent_consult_topic": C.get("recent_consult_topic"),
            "recent_consult_topics_90d": C.get("recent_consult_topics_90d", []),
            "recent_interest_topics": C.get("recent_interest_topics", []),
            "loan_inquiry_flag_90d": C.get("loan_inquiry_flag_90d"),
            "card_inquiry_flag_90d": C.get("card_inquiry_flag_90d"),
            "deposit_inquiry_flag_90d": C.get("deposit_inquiry_flag_90d"),
        },
    }

    return {
        "cust_id": customer_payload.get("cust_id"),
        "base_date": customer_payload.get("base_date"),
        "customer_info": customer_payload.get("customer_info", {}),
        "customer_segment": cust_seg,
        "headline_metrics": headline_metrics,
        "behavior_signals": behavior_signals,
        "explainable_signals": explainable_signals,
        "recommendation_tone": C.get("recommendation_tone"),
    }


async def _run_full_pipeline(
    cust_id: str,
    settings: Any,
    api_key: str,
) -> tuple[dict, dict, dict, list, dict]:
    """Router → Specialist(카테고리별) → RAG/Policy → KPI 공통 파이프라인"""
    try:
        feature_mart_json = get_feature_mart(cust_id, settings.db_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not feature_mart_json:
        raise HTTPException(
            status_code=404,
            detail=f"고객 {cust_id}의 Feature Mart 데이터가 없습니다.",
        )

    basic_info = get_customer_basic_info(cust_id, settings.db_path)
    customer_payload = build_customer_payload(feature_mart_json, basic_info)

    # ── 1) Router : applicable_categories (복수) 산출 ─────────────────────────
    router_result = run_router(customer_payload, api_key=api_key)

    customer_type = feature_mart_json.get("customer_segment", {}).get("customer_type", "개인")
    applicable_labels = [
        cat["label"] for cat in router_result.get("applicable_categories", [])
    ]

    # ── 2) 카테고리별 후보 상품 그룹 조회 ─────────────────────────────────────
    candidates_by_category = get_candidates_by_category(
        applicable_labels=applicable_labels,
        customer_type=customer_type,
        db_path=settings.db_path,
    )
    if not candidates_by_category:
        raise HTTPException(status_code=404, detail="해당 카테고리에 적합한 후보 상품이 없습니다.")

    # ── 3) Specialist : 카테고리별 top_products 산출 ──────────────────────────
    specialist_result = run_specialist(
        router_result=router_result,
        customer_payload=customer_payload,
        candidates_by_category=candidates_by_category,
        api_key=api_key,
    )

    # 카테고리 단위 결과를 평탄화한 top_products_flat 사용 (acceptance_probability 내림차순)
    top_products_flat: List[Dict[str, Any]] = specialist_result.get("top_products_flat", [])

    base_date = feature_mart_json.get("base_date", "")
    customer_context = {
        "customer_segment": feature_mart_json.get("customer_segment", {}),
        "behavior_signals": feature_mart_json.get("rfm_pc", {}).get("behavior_signals", {}),
        "explainable_signals": feature_mart_json.get("rfm_pc", {}).get("explainable_signals", []),
    }

    # ── 4) Policy/RAG : 카테고리별 상위 1~2개 상품에 대해 문서 요약 ───────────
    policy_support_list: List[Dict[str, Any]] = []
    for product in top_products_flat:
        retrieved_docs = retrieve_policy_docs(
            product_id=product["product_id"],
            data_dir=settings.data_dir,
            query=product.get("product_name", ""),
        )
        try:
            policy = run_policy_agent(
                product=product,
                customer_context=customer_context,
                retrieved_docs=retrieved_docs,
                api_key=api_key,
            )
            # 카테고리 정보 함께 보관 (프론트 그룹핑 편의)
            policy["category"] = product.get("category", "")
        except Exception:
            policy = {
                "product_id": product["product_id"],
                "product_name": product["product_name"],
                "category": product.get("category", ""),
                "related_docs": [],
                "required_documents": [],
                "eligibility_summary": [],
                "event_summary": [],
                "caution_points": ["최신 공문을 직접 확인하십시오."],
            }
        policy_support_list.append(policy)

    # ── 5) KPI 매핑 + 사후관리 지침 ───────────────────────────────────────────
    kpi_badge_map = map_kpi_badges_for_products(top_products_flat, base_date, settings.data_dir)

    return customer_payload, router_result, specialist_result, policy_support_list, kpi_badge_map


# ── SSE 스트리밍 엔드포인트 ──────────────────────────────────────────────────

_LABEL_KO: dict[str, str] = {
    "DEPOSIT_SAVINGS": "예적금/수신",
    "PERSONAL_LOAN":   "개인대출",
    "BUSINESS_LOAN":   "사업자대출",
    "CARD":            "카드",
    "CASH_MANAGEMENT": "자금관리",
    "FX_REMITTANCE":   "외환/송금",
    "INVESTMENT_TAX":  "투자/절세",
}


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.post("/api/bridge/sales-card/stream")
async def bridge_sales_card_stream(req: BridgeAnalyzeRequest):
    """
    iM BRIDGE Agent 진행 상황을 SSE로 스트리밍합니다.
    Router → Specialist → Policy RAG → KPI → Assembler
    """
    import asyncio
    from fastapi.responses import StreamingResponse as _StreamingResponse

    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")

    async def generate():
        try:
            # Feature Mart 조회
            try:
                feature_mart_json = await asyncio.to_thread(
                    get_feature_mart, req.cust_id, settings.db_path
                )
            except FileNotFoundError as e:
                yield _sse({"step": "error", "message": str(e)})
                return

            if not feature_mart_json:
                yield _sse({"step": "error", "message": f"고객 {req.cust_id}의 Feature Mart 데이터가 없습니다."})
                return

            basic_info = await asyncio.to_thread(get_customer_basic_info, req.cust_id, settings.db_path)
            customer_payload = build_customer_payload(feature_mart_json, basic_info)

            # ── Step 1: Router (applicable_categories 복수) ─────────────
            yield _sse({"step": "router", "status": "running", "label": "카테고리 분류"})
            try:
                router_result = await asyncio.to_thread(run_router, customer_payload, api_key)
            except Exception as exc:
                yield _sse({"step": "error", "message": f"Router Agent 오류: {exc}"})
                return

            applicable_cats = router_result.get("applicable_categories", []) or []
            top_cat = applicable_cats[0] if applicable_cats else {}
            primary_label = top_cat.get("label", "")
            label_ko = _LABEL_KO.get(primary_label, primary_label or "카테고리 분류 완료")
            cat_summary = ", ".join(c.get("label", "") for c in applicable_cats[:3])
            yield _sse({
                "step": "router", "status": "done",
                "detail": cat_summary or label_ko,
                "confidence": round(float(top_cat.get("confidence", 0)), 2),
            })

            # ── 후보 상품 조회 (카테고리별 그룹) ────────────────────────
            customer_type = feature_mart_json.get("customer_segment", {}).get("customer_type", "개인")
            applicable_labels = [cat["label"] for cat in applicable_cats]
            candidates_by_category = await asyncio.to_thread(
                get_candidates_by_category,
                applicable_labels,
                customer_type,
                settings.db_path,
            )
            if not candidates_by_category:
                yield _sse({"step": "error", "message": "해당 카테고리에 적합한 후보 상품이 없습니다."})
                return

            # ── Step 2: Specialist (카테고리별 top_products) ────────────
            yield _sse({"step": "specialist", "status": "running", "label": "상품 추천"})
            try:
                specialist_result = await asyncio.to_thread(
                    run_specialist,
                    router_result,
                    customer_payload,
                    candidates_by_category,
                    api_key,
                )
            except Exception as exc:
                yield _sse({"step": "error", "message": f"Specialist Agent 오류: {exc}"})
                return

            top_products_flat: list[dict[str, Any]] = specialist_result.get("top_products_flat", [])
            yield _sse({
                "step": "specialist", "status": "done",
                "detail": f"{len(top_products_flat)}개 상품 추천",
            })

            # ── Step 3: Policy RAG + KPI + Assembler ────────────────────
            yield _sse({"step": "assembler", "status": "running", "label": "정책 RAG · 영업카드 조합"})

            base_date = feature_mart_json.get("base_date", "")
            rfm = feature_mart_json.get("rfm_pc", {})
            customer_context = {
                "customer_segment": feature_mart_json.get("customer_segment", {}),
                "behavior_signals": rfm.get("behavior_signals", {}),
                "explainable_signals": rfm.get("explainable_signals", []),
            }

            policy_support_list: list[dict[str, Any]] = []
            for product in top_products_flat:
                retrieved_docs = await asyncio.to_thread(
                    retrieve_policy_docs,
                    product["product_id"],
                    settings.data_dir,
                    product.get("product_name", ""),
                )
                try:
                    policy = await asyncio.to_thread(
                        run_policy_agent, product, customer_context, retrieved_docs, api_key
                    )
                    policy["category"] = product.get("category", "")
                except Exception:
                    policy = {
                        "product_id": product["product_id"],
                        "product_name": product["product_name"],
                        "category": product.get("category", ""),
                        "related_docs": [],
                        "required_documents": [],
                        "eligibility_summary": [],
                        "event_summary": [],
                        "caution_points": ["최신 공문을 직접 확인하십시오."],
                    }
                policy_support_list.append(policy)

            kpi_badge_map = await asyncio.to_thread(
                map_kpi_badges_for_products, top_products_flat, base_date, settings.data_dir
            )

            try:
                assembled = await asyncio.to_thread(
                    run_assembler,
                    customer_payload, router_result, specialist_result,
                    policy_support_list, kpi_badge_map, api_key,
                )
            except Exception as exc:
                yield _sse({"step": "error", "message": f"Assembler Agent 오류: {exc}"})
                return

            final_data = {
                "cust_id": req.cust_id,
                "router_result": router_result,
                "specialist_result": specialist_result,
                "sales_cards": assembled.get("sales_cards", []),
            }

            yield _sse({
                "step": "assembler", "status": "done",
                "final": True,
                "data": final_data,
            })

        except Exception as exc:
            yield _sse({"step": "error", "message": str(exc)})

    return _StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/bridge/consulting-package", response_model=ConsultingPackageResponse)
async def bridge_consulting_package(req: BridgeAnalyzeRequest) -> ConsultingPackageResponse:
    """
    iM BRIDGE Agent 최종 상담패키지 엔드포인트.
    Router → Specialist(카테고리별) → RAG/Policy → KPI → Draft → Critic → Rewrite

    프론트엔드는 응답의 다음 필드를 그대로 사용해 4영역을 시각화합니다:
      - feature_mart_summary : 피처마트 + 행동신호 (영역 1)
      - router_result        : 카테고리 분류 (영역 2)
      - specialist_result    : 카테고리별 상품 영업확률 + 근거 (영역 3)
      - policy_support / kpi_badges : RAG 텍스트 + KPI 사후관리 (영역 4)
      - consulting_package   : 위 4영역을 통합한 직원용 상담 보고서 + 컨설팅 멘트
    """
    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")

    try:
        customer_payload, router_result, specialist_result, policy_support_list, kpi_badge_map = (
            await _run_full_pipeline(req.cust_id, settings, api_key)
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"파이프라인 오류: {exc}")

    try:
        result = run_consulting_package(
            customer_payload=customer_payload,
            router_result=router_result,
            specialist_result=specialist_result,
            policy_support_list=policy_support_list,
            kpi_badge_map=kpi_badge_map,
            api_key=api_key,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Consulting Package Agent 오류: {exc}")

    feature_mart_summary = _build_feature_mart_summary(customer_payload)

    return ConsultingPackageResponse(
        cust_id=req.cust_id,
        router_result=router_result,
        specialist_result=specialist_result,
        feature_mart_summary=feature_mart_summary,
        policy_support=policy_support_list,
        kpi_badges=kpi_badge_map,
        consulting_package=result.get("consulting_package", {}),
        reflection=result.get("reflection", {}),
    )


# ── 고객 기본정보 조회 (주민번호 앞자리) ────────────────────────────────────
@app.get("/api/customers/{resident_id_front}")
def get_customer_by_resident(resident_id_front: str):
    """주민번호 앞 6자리로 DB에서 고객 기본정보·계좌·거래내역을 조회합니다."""
    import sqlite3 as _sqlite3

    settings = get_settings()
    db_path = settings.db_path
    if not db_path.exists():
        raise HTTPException(status_code=503, detail="DB 파일을 찾을 수 없습니다")

    conn = _sqlite3.connect(db_path)
    conn.row_factory = _sqlite3.Row
    try:
        row = conn.execute(
            """SELECT customer_id, resident_id_front, name, age, gender, job,
                      customer_type, annual_income, credit_score,
                      total_assets, total_debt, grade, notes
               FROM customers WHERE resident_id_front = ?""",
            (resident_id_front,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")

        cust = dict(row)
        cust_id = cust["customer_id"]

        accounts = [
            {
                "number": r["account_number"],
                "product": r["product"],
                "balance": r["balance"],
                "status": r["status"],
            }
            for r in conn.execute(
                "SELECT account_number, product, balance, status FROM accounts WHERE customer_id = ?",
                (cust_id,),
            ).fetchall()
        ]

        transactions = [
            {
                "date": r["tx_date"],
                "description": r["description"],
                "amount": r["amount"],
            }
            for r in conn.execute(
                """SELECT tx_date, description, amount FROM transactions
                   WHERE customer_id = ? ORDER BY tx_date DESC LIMIT 10""",
                (cust_id,),
            ).fetchall()
        ]

        # 보유상품 목록 — 계좌 product 컬럼 기준 순서 유지 중복 제거
        products = list(dict.fromkeys(a["product"] for a in accounts))

        return {
            "customerId":      cust["customer_id"],
            "residentIdFront": cust["resident_id_front"],
            "name":            cust["name"],
            "customerType":    cust["customer_type"],
            "gender":          cust["gender"] or "",
            "grade":           cust["grade"],
            "age":             cust["age"],
            "job":             cust["job"],
            "annualIncome":    cust["annual_income"],
            "creditScore":     cust["credit_score"],
            "totalAssets":     cust["total_assets"],
            "totalDebt":       cust["total_debt"],
            "notes":           cust["notes"],
            "products":        products,
            "accounts":        accounts,
            "transactions":    transactions,
        }
    finally:
        conn.close()
