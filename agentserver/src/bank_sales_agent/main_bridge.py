"""
iM BRIDGE Agent CLI 테스트 스크립트

  기본 모드:  python src/bank_sales_agent/main_bridge.py --cust-id DEMO-2
  전체 모드:  python src/bank_sales_agent/main_bridge.py --cust-id DEMO-2 --full
  상담패키지: python src/bank_sales_agent/main_bridge.py --cust-id DEMO-2 --package

새 파이프라인:
  Feature Mart -> Router(applicable_categories 복수) -> Specialist(category_results 카테고리별)
              -> RAG/Policy(상품별) -> KPI(상품별) -> Sales Card / Consulting Package
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
from bank_sales_agent.services.product_catalog import get_candidates_by_category
from bank_sales_agent.services.policy_rag import retrieve_policy_docs
from bank_sales_agent.services.kpi_mapper import map_kpi_badges_for_products
from bank_sales_agent.agents.router_agent import run_router
from bank_sales_agent.agents.specialist_agent import run_specialist
from bank_sales_agent.agents.policy_agent import run_policy_agent
from bank_sales_agent.agents.assembler_agent import run_assembler
from bank_sales_agent.agents.consulting_agent import run_consulting_package


def main() -> None:
    parser = argparse.ArgumentParser(description="iM BRIDGE Agent CLI 테스트")
    parser.add_argument("--cust-id", default="DEMO-2", help="고객 ID (기본: DEMO-2)")
    parser.add_argument("--full", action="store_true", help="전체 파이프라인 실행 (RAG/KPI/Assembler 포함)")
    parser.add_argument("--package", action="store_true", help="상담패키지 보고서 생성 (Reflection 포함)")
    args = parser.parse_args()

    settings = get_settings()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("[ERROR] OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    cust_id = args.cust_id

    print(f"\n{'='*60}")
    print(f"iM BRIDGE Agent - 고객: {cust_id}")
    print(f"{'='*60}")

    # 1. Feature Mart 조회
    print("\n[1/4] Feature Mart 조회 중...")
    feature_mart_json = get_feature_mart(cust_id, settings.db_path)
    if not feature_mart_json:
        print(f"[ERROR] {cust_id} 의 Feature Mart 데이터가 없습니다. db/build_feature_mart.py 를 먼저 실행하세요.")
        sys.exit(1)

    basic_info = get_customer_basic_info(cust_id, settings.db_path)
    customer_payload = build_customer_payload(feature_mart_json, basic_info)

    seg = feature_mart_json.get("customer_segment", {})
    rfm = feature_mart_json.get("rfm_pc", {})
    print(f"  세그먼트: {seg.get('age_band')} / {seg.get('customer_type')} / {seg.get('risk_grade')}")
    sigs = rfm.get("explainable_signals", [])
    if sigs:
        print(f"  핵심 신호 ({len(sigs)}건):")
        for s in sigs[:5]:
            print(f"    - {s}")

    # 2. Router Agent
    print("\n[2/4] Router Agent 실행 중...")
    router_result = run_router(customer_payload, api_key=api_key)
    applicable = router_result.get("applicable_categories", [])
    excluded = router_result.get("excluded_categories", [])
    print(f"  적용 카테고리 ({len(applicable)}건):")
    for cat in applicable:
        print(f"    - {cat['label']:6s} confidence={cat['confidence']:.2f}")
        for r in cat.get("reasons", [])[:2]:
            print(f"        근거: {r}")
    if excluded:
        print(f"  제외 카테고리 ({len(excluded)}건):")
        for ex in excluded:
            print(f"    - {ex.get('label', '?')}: {ex.get('reason', '')}")

    # 3. 후보 상품 조회 (카테고리별 그룹)
    customer_type = seg.get("customer_type", "개인")
    applicable_labels = [cat["label"] for cat in applicable]
    candidates_by_category = get_candidates_by_category(
        applicable_labels=applicable_labels,
        customer_type=customer_type,
        db_path=settings.db_path,
    )
    print(f"\n[3/4] 카테고리별 후보 상품:")
    for cat_label, products in candidates_by_category.items():
        print(f"  [{cat_label}] {len(products)}개")
        for p in products:
            print(f"    - {p['product_id']} {p['product_name']}")

    if not candidates_by_category:
        print("[ERROR] 후보 상품이 없습니다.")
        sys.exit(1)

    # 4. Specialist Agent (카테고리별 분석)
    print("\n[4/4] Specialist Agent 실행 중...")
    specialist_result = run_specialist(
        router_result=router_result,
        customer_payload=customer_payload,
        candidates_by_category=candidates_by_category,
        api_key=api_key,
    )

    print(f"\n{'='*60}")
    print(f"카테고리별 추천 결과")
    print(f"{'='*60}")
    for cat in specialist_result.get("category_results", []):
        print(f"\n[카테고리] {cat['category']}  (신뢰도 {cat.get('category_confidence', 0):.2f})")
        for p in cat.get("top_products", []):
            band = p.get("probability_band", "")
            prob = p.get("acceptance_probability", 0)
            print(f"  [{p['rank']}위] {p['product_name']}  ({band} / {prob:.0%})")
            for e in p.get("evidence", [])[:3]:
                print(f"    [O] {e}")
            for r in p.get("risk_or_caution", [])[:2]:
                print(f"    [!] {r}")
            print(f"    상담 방향: {p.get('recommended_talk_direction', '')}")
        for ep in cat.get("excluded_products", [])[:2]:
            print(f"  [X] {ep.get('product_name', '')}: {ep.get('reason', '')}")

    # 평탄화된 top_products_flat (상위 확률 순)
    top_products_flat = specialist_result.get("top_products_flat", [])
    base_date = feature_mart_json.get("base_date", "")

    if not args.full and not args.package:
        final = {
            "cust_id": cust_id,
            "router_result": router_result,
            "specialist_result": specialist_result,
        }
        print(f"\n{'='*60}\n최종 JSON (Specialist 까지)\n{'='*60}")
        print(json.dumps(final, ensure_ascii=False, indent=2))
        return

    # ── 전체 파이프라인 (--full / --package) ───────────────────────────────────

    # 5. RAG/Policy Agent (top_products_flat 의 모든 상품)
    print(f"\n[5/7] RAG/Policy Agent 실행 중 (총 {len(top_products_flat)}개 상품)...")
    customer_context = {
        "customer_segment": feature_mart_json.get("customer_segment", {}),
        "behavior_signals": rfm.get("behavior_signals", {}),
        "explainable_signals": rfm.get("explainable_signals", []),
    }
    policy_support_list = []
    for product in top_products_flat:
        retrieved_docs = retrieve_policy_docs(
            product_id=product["product_id"],
            data_dir=settings.data_dir,
            query=product.get("product_name", ""),
        )
        print(f"  [{product['product_id']}] {product['product_name']} - 문서 {len(retrieved_docs)}건")
        try:
            policy = run_policy_agent(
                product=product,
                customer_context=customer_context,
                retrieved_docs=retrieved_docs,
                api_key=api_key,
            )
            policy["category"] = product.get("category", "")
        except Exception as exc:
            print(f"    [!] policy 실패: {exc}")
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
        if policy.get("required_documents"):
            print(f"    필요서류: {', '.join(policy['required_documents'][:3])}")

    # 6. KPI Mapper
    print(f"\n[6/7] KPI 매핑 중...")
    kpi_badge_map = map_kpi_badges_for_products(top_products_flat, base_date, settings.data_dir)
    for pid, badge in kpi_badge_map.items():
        print(f"  [{pid}] {badge['badge_text']} (점수: {badge['kpi_score']}, {badge['priority_level']})")
        for pm in badge.get("post_management", [])[:2]:
            print(f"    사후관리: {pm}")

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
        print(f"\n  [{card.get('rank')}위] [{card.get('category', '?')}] {card.get('product_name')}  ({band} / {prob:.0%})")
        print(f"  근거: {card.get('main_reason', '')}")
        if card.get("required_documents"):
            print(f"  필요서류: {', '.join(card['required_documents'])}")
        if card.get("event_summary"):
            print(f"  이벤트: {', '.join(card['event_summary'])}")
        for c in card.get("policy_cautions", [])[:2]:
            print(f"  [!] {c}")
        print(f"  KPI: [{kpi.get('badge_text')}] {kpi.get('branch_campaign') or ''}")
        print(f"  세일즈톡: {card.get('staff_sales_talk', '')}")
        print(f"  다음 행동: {card.get('next_action', '')}")

    if not args.package:
        final = {
            "cust_id": cust_id,
            "router_result": router_result,
            "specialist_result": specialist_result,
            "policy_support": policy_support_list,
            "kpi_badges": kpi_badge_map,
            "sales_cards": assembled.get("sales_cards", []),
        }
        print(f"\n{'='*60}\n최종 JSON (전체)\n{'='*60}")
        print(json.dumps(final, ensure_ascii=False, indent=2))
        return

    # ── 상담패키지 보고서 (--package 모드) ────────────────────────────────────

    print(f"\n{'='*60}")
    print("[상담패키지] Consulting Package Agent 실행 중...")
    print("  Draft 생성 -> Critic 평가 -> Rewrite (필요시)")
    print(f"{'='*60}")

    pkg_result = run_consulting_package(
        customer_payload=customer_payload,
        router_result=router_result,
        specialist_result=specialist_result,
        policy_support_list=policy_support_list,
        kpi_badge_map=kpi_badge_map,
        api_key=api_key,
    )

    pkg = pkg_result.get("consulting_package", {})
    ref = pkg_result.get("reflection", {})

    print(f"\n{'='*60}")
    print(f"최종 상담패키지 보고서")
    print(f"{'='*60}")
    print(f"\n[고객 요약] {pkg.get('customer_brief', '')}")
    print(f"[전략]      {pkg.get('recommended_strategy', '')}")

    if pkg.get("category_overview"):
        print(f"\n[카테고리 개요]")
        for c in pkg["category_overview"]:
            print(f"  - {c.get('category', ''):4s} (conf={c.get('category_confidence', 0):.2f}) {c.get('headline', '')}")

    for card in pkg.get("top_cards", []):
        prob = card.get("acceptance_probability", 0)
        band = card.get("probability_label", "")
        kpi = card.get("kpi_badge", {})
        print(f"\n  [{card.get('rank')}위] [{card.get('category', '?')}] {card.get('product_name')}  ({band} / {prob:.0%})")
        print(f"  핵심이유: {card.get('main_reason', '')}")
        for s in card.get("customer_signals", []):
            print(f"    - {s}")
        print(f"  KPI: [{kpi.get('badge_text')}] 점수 {kpi.get('kpi_score')} / {kpi.get('priority_level')}")
        for pm in card.get("kpi_post_management", [])[:2]:
            print(f"    사후관리: {pm}")
        if card.get("required_documents"):
            print(f"  필요서류: {', '.join(card.get('required_documents', []))}")
        for cp in card.get("caution_points", [])[:2]:
            print(f"  [!] {cp}")
        print(f"  [상담멘트] {card.get('staff_talk', '')}")
        print(f"  [다음행동] {card.get('next_action', '')}")

    if pkg.get("do_not_say"):
        print(f"\n  [금지 표현]")
        for d in pkg.get("do_not_say", []):
            print(f"    X {d}")

    qs = ref.get("quality_score", {})
    print(f"\n{'='*60}")
    print(f"Reflection 품질 점수")
    print(f"{'='*60}")
    print(f"  간결성:     {qs.get('conciseness', 0):.2f}")
    print(f"  핵심표현력: {qs.get('clarity', 0):.2f}")
    print(f"  정보성:     {qs.get('informativeness', 0):.2f}")
    print(f"  실행성:     {qs.get('actionability', 0):.2f}")
    print(f"  안전성:     {qs.get('compliance_safety', 0):.2f}")
    print(f"  평균:       {ref.get('avg_quality_score', 0):.3f}")
    print(f"  Rewrite 여부: {'Yes' if ref.get('rewritten') else 'No'}")

    if ref.get("issues"):
        print(f"  발견된 이슈:")
        for issue in ref["issues"]:
            print(f"    [{issue.get('type')}] {issue.get('message')}")

    final = {
        "cust_id": cust_id,
        "router_result": router_result,
        "specialist_result": specialist_result,
        "policy_support": policy_support_list,
        "kpi_badges": kpi_badge_map,
        "consulting_package": pkg,
        "reflection": ref,
    }
    print(f"\n{'='*60}\n최종 JSON (상담패키지)\n{'='*60}")
    print(json.dumps(final, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
