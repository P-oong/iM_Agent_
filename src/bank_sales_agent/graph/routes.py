"""Role: Conditional routing helpers for the sales recommendation graph."""

from __future__ import annotations

from typing import Literal

from bank_sales_agent.graph.state import SalesGraphState


def route_after_human_review(
    state: SalesGraphState,
) -> Literal["crm_node", "hold", "end"]:
    """Route human review results to approval, hold, or end branches."""
    review_status = state.get("review_status", "")
    if review_status == "approved" and state.get("approved_product_id"):
        return "crm_node"
    if review_status == "hold":
        return "hold"
    return "end"
