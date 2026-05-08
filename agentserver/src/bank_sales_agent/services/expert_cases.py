"""우수 직원 노하우 로더 서비스.

두 가지 자산을 별도 JSON으로 관리하여 Router/Specialist에 분리 주입합니다.
- Router : 카테고리 분류 노하우 (router_expert_cases.json)
- Specialist : 상품 권유 성공/실패 사례 (specialist_outcome_patterns.json)

KPI 정보는 절대 포함되지 않으며, 두 에이전트 모두 KPI를 판단 근거로 사용하지 않습니다.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROUTER_CASES_FILE = "prompt_examples/router_expert_cases.json"
SPECIALIST_PATTERNS_FILE = "prompt_examples/specialist_outcome_patterns.json"


@lru_cache(maxsize=4)
def _load_json(file_path_str: str) -> list[dict]:
    """JSON 파일 1회 로드 후 캐싱."""
    p = Path(file_path_str)
    if not p.exists():
        return []
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def load_router_expert_cases(data_dir: Path, limit: int | None = None) -> list[dict]:
    """
    Router에 주입할 우수 직원 분류 노하우 사례 전체를 반환합니다.

    Args:
        data_dir: agentserver/data 경로
        limit: 토큰 절약을 위해 N개만 사용하고 싶을 때 지정

    Returns:
        case_id, case_name, input_signals, expert_judgment, expert_reason 필드를
        가진 dict 리스트
    """
    cases = _load_json(str(data_dir / ROUTER_CASES_FILE))
    if limit is not None:
        cases = cases[:limit]
    return cases


def load_specialist_outcome_patterns(
    data_dir: Path,
    categories: list[str] | None = None,
) -> list[dict]:
    """
    Specialist에 주입할 상품 성공/실패 패턴을 반환합니다.

    Args:
        data_dir: agentserver/data 경로
        categories: Router applicable_categories의 라벨 리스트
                    (예: ["여신", "수신", "카드"])
                    None이면 전체 반환, 지정 시 해당 카테고리만 필터링하여
                    프롬프트 토큰을 절약합니다.

    Returns:
        category, product_focus, success_patterns, failure_patterns,
        probability_guidance 필드를 가진 dict 리스트
    """
    patterns = _load_json(str(data_dir / SPECIALIST_PATTERNS_FILE))
    if not categories:
        return patterns
    cat_set = set(categories)
    return [p for p in patterns if p.get("category") in cat_set]
