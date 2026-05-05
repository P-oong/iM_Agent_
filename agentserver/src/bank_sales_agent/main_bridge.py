"""
iM BRIDGE Agent CLI 테스트 스크립트
  기본 모드: python src/bank_sales_agent/main_bridge.py --cust-id C003
  전체 모드: python src/bank_sales_agent/main_bridge.py --cust-id C003 --full
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# PYTHONPATH 보정 (poetry shell 없이 직접 실행 시)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bank_sales_agent.config.settings import get_settings
from bank_sales_agent.services.feature_mart import (
    build_customer_payload,
    get_customer_basic_info,
    get_feature_mart,
)
from bank_sales_agent.services.product_catalog import get_candidate_products
from bank_sales_agent.services.policy_rag import retrieve_policy_docs
from bank_sales_agent.services.kpi_mapper import map_kpi_badges_for_products
from bank_sales_agent.agents.router_agent import run_router
from bank_sales_agent.agents.specialist_agent import run_specialist
from bank_sales_agent.agents.policy_agent import run_policy_agent
from bank_sales_agent.agents.assembler_agent import run_assembler

DEMO_LIVE_CONTEXTS: dict[str, dict] = {
    "C001": {"visit_reason_code": "LOAN_INQUIRY",    "counter_task": "주택대출 상담",      "staff_note": "주택 구입 관련 문의"},
    "C002": {"visit_reason_code": "SAVINGS_INQUIRY",  "counter_task": "적금 만기 상담",      "staff_note": "청약 및 절세 상품 문의"},
    "C003": {"visit_reason_code": "LOAN_MATURITY",    "counter_task": "대출 만기 상담",      "staff_note": "대출 연장 또는 대환 문의"},
    "C004": {"visit_reason_code": "SAVINGS_INQUIRY",  "counter_task": "재테크 상담",         "staff_note": "ISA/펀드 관심 표명"},
    "C005": {"visit_reason_code": "INVESTMENT",       "counter_task": "투자 상품 상담",      "staff_note": "절세 방법 및 신탁 문의"},
    "C006": {"visit_reason_code": "LOAN_INQUIRY",     "counter_task": "기업대출 상담",       "staff_note": "설비 증설 자금 대출 문의"},
    "C007": {"visit_reason_code": "FX_INQUIRY",       "counter_task": "외환 상담",           "staff_note": "헤지 상품 및 운전자금 문의"},
    "C008": {"visit_reason_code": "BUSINESS_ACCOUNT", "counter_task": "사업자 통장 상담",    "staff_note": "소자본 대출 및 카드 혜택 문의"},
    "C009": {"visit_reason_code": "DEPOSIT_MATURITY", "counter_task": "예금 만기 상담",      "staff_note": "정기예금 만기 후 ISA 관심"},
    "C010": {"visit_reason_code": "CASH_MANAGEMENT",  "counter_task": "정산 계좌 이전 상담", "staff_note": "카드 매출 당행 정산 이전 문의"},
    "DEMO-1": {"visit_reason_code": "TRANSFER_LIMIT", "counter_task": "이체한도 상향",       "staff_note": "전세보증금 이체한도 상향 요청"},
    "DEMO-2": {"visit_reason_code": "CASH_MANAGEMENT","counter_task": "거래내역 발급",       "staff_note": "카드매출 타행 정산 이전 가능 여부 문의"},
    "DEMO-3": {"visit_reason_code": "CORPORATE_OTP",  "counter_task": "법인 OTP 재발급",    "staff_note": "이체한도 변경 및 법인카드 문의"},
}


def main() -> None:
    parser = argparse.ArgumentParser(description="iM BRIDGE Agent CLI 테스트")
    parser.add_argument("--cust-id", default="C003", help="고객 ID (기본: C003)")
    parser.add_argument("--visit-reason", default=None, help="내점 사유 코드 (없으면 기본값 사용)")
    parser.add_argument("--counter-task", default=None, help="창구 업무")
    parser.add_argument("--staff-note", default=None, help="직원 메모")
    parser.add_argument("--full", action="store_true", help="전체 파이프라인 실행 (RAG/KPI/Assembler 포함)")
    args = parser.parse_args()

    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("[ERROR] OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    cust_id = args.cust_id

    # Live Context 구성
    default_ctx = DEMO_LIVE_CONTEXTS.get(cust_id, {
        "visit_reason_code": "GENERAL",
        "counter_task": "일반 상담",
        "staff_note": "",
    })
    live_context = {
        "visit_reason_code": args.visit_reason or default_ctx["visit_reason_code"],
        "counter_task": args.counter_task or default_ctx["counter_task"],
        "staff_note": args.staff_note or default_ctx["staff_note"],
    }

    print(f"\n{'='*60}")
    print(f"iM BRIDGE Agent - 고객: {cust_id}")
    print(f"Live Context: {live_context}")
    print(f"{'='*60}")

    # 1. Feature Mart 조회
    print("\n[1/4] Feature Mart 조회 중...")
    feature_mart_json = get_feature_mart(cust_id, settings.db_path)
    if not feature_mart_json:
        print(f"[ERROR] {cust_id} 의 Feature Mart 데이터가 없습니다. db/build_feature_mart.py 를 먼저 실행하세요.")
        sys.exit(1)

    basic_info = get_customer_basic_info(cust_id, settings.db_path)
    customer_payload = build_customer_payload(feature_mart_json, live_context, basic_info)

    seg = feature_mart_json.get("customer_segment", {})
    rfm = feature_mart_json.get("rfm_pc", {})
    print(f"  세그먼트: {seg.get('age_band')} / {seg.get('customer_type')} / {seg.get('risk_grade')}")
    print(f"  상품 공백: {rfm.get('P', {}).get('missing_product_labels', [])}")
    print(f"  영업 피로도: {rfm.get('C', {}).get('sales_fatigue_score', 0)}")

    # 2. Router Agent
    print("\n[2/4] Router Agent 실행 중...")
    router_result = run_router(customer_payload, api_key=api_key)
    print(f"  primary_label: {router_result['primary_label']}")
    print(f"  secondary_labels: {router_result.get('secondary_labels', [])}")
    print(f"  confidence: {router_result['confidence']}")
    print(f"  routing_reason:")
    for r in router_result.get("routing_reason", []):
        print(f"    - {r}")
    if router_result.get("negative_signals"):
        print(f"  negative_signals:")
        for s in router_result["negative_signals"]:
            print(f"    ! {s}")

    # 3. 후보 상품 조회
    customer_type = seg.get("customer_type", "개인")
    candidate_products = get_candidate_products(
        primary_label=router_result["primary_label"],
        secondary_labels=router_result.get("secondary_labels", []),
        customer_type=customer_type,
        db_path=settings.db_path,
    )
    print(f"\n[3/4] 후보 상품 {len(candidate_products)}개 조회 완료")
    for p in candidate_products:
        print(f"  - [{p['product_id']}] {p['product_name']} ({p['category']})")

    # 4. Specialist Agent
    print("\n[4/4] Specialist Agent 실행 중...")
    specialist_result = run_specialist(
        router_result=router_result,
        customer_payload=customer_payload,
        candidate_products=candidate_products,
        api_key=api_key,
    )

    print(f"\n{'='*60}")
    print(f"최종 추천 결과")
    print(f"{'='*60}")
    for p in specialist_result.get("top_products", []):
        band = p.get("probability_band", "")
        prob = p.get("acceptance_probability", 0)
        print(f"\n  [{p['rank']}위] {p['product_name']}  ({band} / {prob:.0%})")
        print(f"  근거:")
        for e in p.get("evidence", []):
            print(f"    [O] {e}")
        if p.get("risk_or_caution"):
            print(f"  주의:")
            for r in p["risk_or_caution"]:
                print(f"    [!] {r}")
        print(f"  상담 방향: {p.get('recommended_talk_direction', '')}")

    if specialist_result.get("excluded_products"):
        print(f"\n  제외 상품:")
        for ep in specialist_result["excluded_products"]:
            print(f"    [X] {ep['product_name']}: {ep['reason']}")

    print(f"\n  Specialist confidence: {specialist_result.get('confidence', 0)}")

    top_products = specialist_result.get("top_products", [])
    base_date = feature_mart_json.get("base_date", "")

    if not args.full:
        final = {"cust_id": cust_id, "router_result": router_result, "specialist_result": specialist_result}
        print(f"\n{'='*60}\n최종 JSON (Specialist 까지)\n{'='*60}")
        print(json.dumps(final, ensure_ascii=False, indent=2))
        return

    # ── 전체 파이프라인 (--full 모드) ───────────────────────────────────────────

    # 5. RAG/Policy Agent
    print(f"\n[5/7] RAG/Policy Agent 실행 중...")
    customer_context = {
        "customer_segment": feature_mart_json.get("customer_segment", {}),
        "live_context": live_context,
    }
    policy_support_list = []
    for product in top_products:
        retrieved_docs = retrieve_policy_docs(
            product_id=product["product_id"],
            data_dir=settings.data_dir,
            query=product.get("product_name", ""),
        )
        print(f"  [{product['product_id']}] 문서 {len(retrieved_docs)}건 검색")
        policy = run_policy_agent(
            product=product,
            customer_context=customer_context,
            retrieved_docs=retrieved_docs,
            api_key=api_key,
        )
        policy_support_list.append(policy)
        if policy.get("required_documents"):
            print(f"    필요서류: {', '.join(policy['required_documents'][:3])}")

    # 6. KPI Mapper
    print(f"\n[6/7] KPI 매핑 중...")
    kpi_badge_map = map_kpi_badges_for_products(top_products, base_date, settings.data_dir)
    for pid, badge in kpi_badge_map.items():
        print(f"  [{pid}] {badge['badge_text']} (점수: {badge['kpi_score']}, {badge['priority_level']})")

    # 7. Sales Card Assembler
    print(f"\n[7/7] Sales Card Assembler 실행 중...")
    assembled = run_assembler(
        customer_payload=customer_payload,
        router_result=router_result,
        specialist_result=specialist_result,
        policy_support_list=policy_support_list,
        kpi_badge_map=kpi_badge_map,
        api_key=api_key,
    )

    print(f"\n{'='*60}")
    print(f"최종 Sales Card")
    print(f"{'='*60}")
    for card in assembled.get("sales_cards", []):
        prob = card.get("acceptance_probability", 0)
        band = card.get("probability_band", "")
        kpi = card.get("kpi_badge", {})
        print(f"\n  [{card['rank']}위] {card['product_name']}  ({band} / {prob:.0%})")
        print(f"  근거: {card.get('main_reason', '')}")
        if card.get("required_documents"):
            print(f"  필요서류: {', '.join(card['required_documents'])}")
        if card.get("event_summary"):
            print(f"  이벤트: {', '.join(card['event_summary'])}")
        if card.get("policy_cautions"):
            for c in card["policy_cautions"]:
                print(f"  [!] {c}")
        print(f"  KPI: [{kpi.get('badge_text')}] {kpi.get('branch_campaign') or ''}")
        print(f"  세일즈톡: {card.get('staff_sales_talk', '')}")
        print(f"  다음 행동: {card.get('next_action', '')}")

    final = {
        "cust_id": cust_id,
        "router_result": router_result,
        "specialist_result": specialist_result,
        "sales_cards": assembled.get("sales_cards", []),
    }
    print(f"\n{'='*60}\n최종 JSON (전체)\n{'='*60}")
    print(json.dumps(final, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
