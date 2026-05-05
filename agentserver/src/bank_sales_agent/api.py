"""Role: FastAPI server exposing the LangGraph sales agent as a REST API."""

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
from bank_sales_agent.graph.build_graph import build_sales_graph


# ── Graph singleton (built once at startup) ────────────────────────────────
_graph: Any = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _graph
    settings = get_settings()
    _graph = build_sales_graph(settings)
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
            model="gpt-4.1-mini",
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

from bank_sales_agent.agents.router_agent import run_router
from bank_sales_agent.agents.specialist_agent import run_specialist
from bank_sales_agent.services.feature_mart import (
    get_feature_mart,
    get_customer_basic_info,
    build_customer_payload,
)
from bank_sales_agent.services.product_catalog import get_candidate_products


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

    # 3. Feature Mart + Live Context 결합
    customer_payload = build_customer_payload(
        feature_mart_json,
        req.live_context.model_dump(),
        basic_info,
    )

    # 4. Router Agent
    try:
        router_result = run_router(customer_payload, api_key=api_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Router Agent 오류: {exc}")

    # 5. 후보 상품 조회
    customer_type = feature_mart_json.get("customer_segment", {}).get("customer_type", "개인")
    candidate_products = get_candidate_products(
        primary_label=router_result["primary_label"],
        secondary_labels=router_result.get("secondary_labels", []),
        customer_type=customer_type,
        db_path=settings.db_path,
    )

    if not candidate_products:
        raise HTTPException(status_code=404, detail="해당 카테고리에 적합한 후보 상품이 없습니다.")

    # 6. Specialist Agent
    try:
        specialist_result = run_specialist(
            router_result=router_result,
            customer_payload=customer_payload,
            candidate_products=candidate_products,
            api_key=api_key,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Specialist Agent 오류: {exc}")

    return BridgeAnalyzeResponse(
        cust_id=req.cust_id,
        router_result=router_result,
        specialist_result=specialist_result,
    )
