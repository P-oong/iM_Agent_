"""라우터 레이블별 후보 상품 조회 서비스"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

# Router 레이블 (7개 한국어 카테고리) → DB 상품 ID 매핑
# P016~P022는 박성호(개인사업자) 데모 시연 강화용 신규 상품
LABEL_TO_PRODUCT_IDS: dict[str, list[str]] = {
    "여신": ["P004", "P005", "P006", "P015", "P019", "P020", "P021"],
    "수신": ["P001", "P002", "P003", "P012", "P022"],
    "카드": ["P007", "P008", "P016", "P017", "P018"],
    "방카": ["P011"],
    "신탁": ["P011"],
    "펀드": ["P009", "P010"],
    "외환": ["P013", "P014"],
}

# 고객 유형별 제외 상품 (개인 고객에게 기업 상품 노출 방지)
CUSTOMER_TYPE_EXCLUDE: dict[str, set[str]] = {
    "개인": {
        # 사업자 전용
        "P006", "P008", "P012", "P014", "P015",
        "P017", "P018", "P019", "P020", "P021", "P022",
    },
    "개인사업자": {
        # 순수 개인·법인 전용
        "P004", "P014", "P015",
    },
    "법인": {
        # 개인 전용
        "P001", "P003", "P004", "P005", "P007", "P009", "P010", "P011",
        "P012", "P016", "P017",
        # 개인사업자 정책자금 전용
        "P019", "P020", "P021",
    },
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
    applicable_labels: list[str],
    customer_type: str,
    db_path: Path,
) -> list[dict]:
    """Router applicable_categories 레이블 목록에 맞는 후보 상품 목록을 반환합니다."""
    product_ids: list[str] = []
    for label in applicable_labels:
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
