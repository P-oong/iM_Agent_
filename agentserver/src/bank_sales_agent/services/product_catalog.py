"""라우터 레이블별 후보 상품 조회 서비스"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

# Router 레이블 → DB 상품 ID 매핑
LABEL_TO_PRODUCT_IDS: dict[str, list[str]] = {
    "DEPOSIT_SAVINGS": ["P001", "P002", "P003"],
    "PERSONAL_LOAN":   ["P004", "P005"],
    "BUSINESS_LOAN":   ["P006", "P015"],
    "CARD":            ["P007", "P008"],
    "CASH_MANAGEMENT": ["P008", "P006"],
    "FX_REMITTANCE":   ["P013", "P014"],
    "INVESTMENT_TAX":  ["P009", "P010", "P011", "P012"],
}

# 고객 유형별 제외 상품 (개인 고객에게 기업 상품 노출 방지)
CUSTOMER_TYPE_EXCLUDE: dict[str, set[str]] = {
    "개인": {"P006", "P008", "P012", "P014", "P015"},
    "개인사업자": {"P004", "P014", "P015"},
    "법인": {"P003", "P004", "P005", "P007", "P009", "P010", "P011"},
}


def _product_row_to_candidate(row: sqlite3.Row) -> dict:
    """DB 상품 행을 Specialist 입력 형식으로 변환합니다."""
    target_types = json.loads(row["target_types"] or "[]")
    target_segments = json.loads(row["target_segments"] or "[]")
    priority_tags = json.loads(row["priority_tags"] or "[]")

    target_conditions = target_types + target_segments + priority_tags
    main_benefits = []
    if row["customer_value"]:
        main_benefits.append(row["customer_value"])
    if row["description"]:
        main_benefits.append(row["description"])

    return {
        "product_id": row["product_id"],
        "product_name": row["product_name"],
        "category": row["category"],
        "sub_category": row["sub_category"],
        "requires_review": bool(row["requires_review"]),
        "target_conditions": target_conditions,
        "main_benefits": main_benefits,
    }


def get_candidate_products(
    primary_label: str,
    secondary_labels: list[str],
    customer_type: str,
    db_path: Path,
) -> list[dict]:
    """Router 레이블에 맞는 후보 상품 목록을 반환합니다."""
    # Primary + Secondary에서 상품 ID 수집 (최대 6개)
    product_ids: list[str] = []
    for label in [primary_label] + (secondary_labels or []):
        for pid in LABEL_TO_PRODUCT_IDS.get(label, []):
            if pid not in product_ids:
                product_ids.append(pid)

    if not product_ids:
        return []

    # 고객 유형 기반 필터
    exclude_ids = CUSTOMER_TYPE_EXCLUDE.get(customer_type, set())
    filtered_ids = [pid for pid in product_ids if pid not in exclude_ids]

    if not filtered_ids:
        return []

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        placeholders = ",".join("?" * len(filtered_ids))
        rows = conn.execute(
            f"""SELECT product_id, product_name, category, sub_category,
                       target_types, target_segments, priority_tags,
                       customer_value, description, requires_review
                FROM products WHERE product_id IN ({placeholders})""",
            filtered_ids,
        ).fetchall()
        # 원래 순서(label 우선순위) 유지
        row_map = {r["product_id"]: r for r in rows}
        return [_product_row_to_candidate(row_map[pid]) for pid in filtered_ids if pid in row_map]
    finally:
        conn.close()
