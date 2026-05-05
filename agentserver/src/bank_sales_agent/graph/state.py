"""Role: Shared LangGraph state for recommendation and approval threads."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class SalesGraphState(TypedDict, total=False):
    """Serializable state shared across LangGraph nodes."""

    thread_id: str
    customer_id: str
    customer_profile: Dict[str, Any]
    product_knowledge: List[Dict[str, Any]]
    scored_products: List[Dict[str, Any]]
    top_products: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    policy_flags: List[str]
    approval_required: bool
    review_status: str
    approved_product_id: Optional[str]
    approval_note: str
    awaiting_approval: bool
    crm_draft: Optional[Dict[str, Any]]
    errors: List[str]


AgentState = SalesGraphState
