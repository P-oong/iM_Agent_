"""Feature Mart DB 조회 및 Live Context 결합 서비스"""

from __future__ import annotations

import json
import sqlite3
from datetime import date
from pathlib import Path


def get_feature_mart(cust_id: str, db_path: Path) -> dict | None:
    """오늘 날짜 Feature Mart JSON을 DB에서 조회합니다."""
    if not db_path.exists():
        raise FileNotFoundError(f"DB 파일을 찾을 수 없습니다: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT llm_input_json FROM customer_rfmpc_feature_mart WHERE cust_id = ? AND base_date = ?",
            (cust_id, date.today().isoformat()),
        ).fetchone()
        if row:
            return json.loads(row["llm_input_json"])
        # 오늘 데이터가 없으면 가장 최근 날짜 데이터로 폴백
        row = conn.execute(
            "SELECT llm_input_json FROM customer_rfmpc_feature_mart WHERE cust_id = ? ORDER BY base_date DESC LIMIT 1",
            (cust_id,),
        ).fetchone()
        return json.loads(row["llm_input_json"]) if row else None
    finally:
        conn.close()


def get_customer_basic_info(cust_id: str, db_path: Path) -> dict | None:
    """customers 테이블에서 기본 고객 정보를 조회합니다."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            """SELECT customer_id, name, age, gender, customer_type, grade, credit_score,
                      annual_income, total_assets, total_debt, notes
               FROM customers WHERE customer_id = ?""",
            (cust_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def build_customer_payload(feature_mart_json: dict, live_context: dict, basic_info: dict | None = None) -> dict:
    """Feature Mart JSON + Live Context를 에이전트 입력 형태로 결합합니다."""
    payload: dict = {
        "cust_id": feature_mart_json.get("cust_id"),
        "base_date": feature_mart_json.get("base_date"),
        "feature_mart": {
            "customer_segment": feature_mart_json.get("customer_segment", {}),
            "rfm_pc": feature_mart_json.get("rfm_pc", {}),
        },
        "live_context": live_context,
    }
    if basic_info:
        payload["customer_info"] = {
            "name": basic_info.get("name"),
            "age": basic_info.get("age"),
            "grade": basic_info.get("grade"),
            "credit_score": basic_info.get("credit_score"),
            "notes": basic_info.get("notes"),
        }
    return payload
