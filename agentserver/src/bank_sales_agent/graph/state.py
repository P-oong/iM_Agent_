"""Role: Shared LangGraph state for recommendation and approval threads."""

from __future__ import annotations

from typing import Any, TypedDict


class SalesGraphState(TypedDict, total=False):
    """Serializable state shared across LangGraph nodes."""

    thread_id: str
    customer_id: str
    customer_profile: dict[str, Any]
    product_knowledge: list[dict[str, Any]]
    scored_products: list[dict[str, Any]]
    top_products: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]
    policy_flags: list[str]
    approval_required: bool
    review_status: str
    approved_product_id: str | None
    approval_note: str
    awaiting_approval: bool
    crm_draft: dict[str, Any] | None
    errors: list[str]


AgentState = SalesGraphState
