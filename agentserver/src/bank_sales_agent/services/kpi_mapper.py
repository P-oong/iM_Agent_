"""KPI Mapper - 상품별 KPI 뱃지를 결정론적으로 매핑합니다 (AI 불필요)"""

from __future__ import annotations

import json
from pathlib import Path

_DEFAULT_BADGE = {
    "kpi_category":  None,
    "kpi_score":     0,
    "priority_level": "NONE",
    "badge_text":    "KPI 해당 없음",
    "display_color": "gray",
    "branch_campaign": None,
    "post_management": [],
}


def _load_kpi_mapping(data_dir: Path) -> list[dict]:
    kpi_path = data_dir / "kpi" / "kpi_mapping.json"
    if not kpi_path.exists():
        return []
    with open(kpi_path, encoding="utf-8") as f:
        return json.load(f)


def map_kpi_badge(product_id: str, base_date: str, data_dir: Path) -> dict:
    """
    product_id + 날짜 기준으로 KPI 뱃지를 반환합니다.
    유효 기간(valid_from ~ valid_to)을 벗어난 경우 기본 뱃지를 반환합니다.
    """
    mappings = _load_kpi_mapping(data_dir)
    for row in mappings:
        if row.get("product_id") != product_id:
            continue
        if row.get("valid_from", "") <= base_date <= row.get("valid_to", ""):
            return {
                "kpi_category":  row["kpi_category"],
                "kpi_score":     row["kpi_score"],
                "priority_level": row["priority_level"],
                "badge_text":    row["badge_text"],
                "display_color": row["display_color"],
                "branch_campaign": row.get("branch_campaign"),
                "post_management": row.get("post_management", []),
            }
    return _DEFAULT_BADGE.copy()


def map_kpi_badges_for_products(
    products: list[dict],
    base_date: str,
    data_dir: Path,
) -> dict[str, dict]:
    """여러 상품에 대한 KPI 뱃지를 한 번에 조회합니다.

    Returns:
        {product_id: kpi_badge_dict}
    """
    return {
        p["product_id"]: map_kpi_badge(p["product_id"], base_date, data_dir)
        for p in products
    }
