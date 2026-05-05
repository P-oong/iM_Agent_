"""Role: Pause the graph for human approval and support resume with a product choice."""

from __future__ import annotations

from langgraph.types import interrupt

from bank_sales_agent.graph.state import AgentState


def build_human_review_node():
    """Create a node that requests approval before CRM drafting."""

    def human_review_node(state: AgentState) -> AgentState:
        if state.get("errors"):
            return {}

        if not state.get("approval_required", True):
            top_products = state.get("top_products", [])
            auto_approved_product_id = None
            if top_products:
                auto_approved_product_id = top_products[0].get("product_id")
            return {
                "approved_product_id": auto_approved_product_id,
                "awaiting_approval": False,
                "review_status": "approved" if auto_approved_product_id else "end",
            }

        if state.get("approved_product_id"):
            return {"awaiting_approval": False, "review_status": "approved"}

        response = interrupt(
            {
                "message": "Approve one recommendation to continue to CRM drafting.",
                "recommendations": state.get("top_products", state.get("recommendations", [])),
                "thread_id": state.get("thread_id"),
                "policy_flags": state.get("policy_flags", []),
            }
        )

        approved_product_id: str | None = None
        approval_note = ""
        review_action = "approve"
        if isinstance(response, dict):
            approved_product_id = response.get("approved_product_id")
            approval_note = str(response.get("approval_note", ""))
            review_action = str(response.get("review_action", "approve")).lower()
        elif isinstance(response, str):
            approved_product_id = response

        if review_action == "hold":
            return {
                "awaiting_approval": True,
                "approval_note": approval_note or "Review is on hold.",
                "review_status": "hold",
            }

        if review_action in {"end", "reject", "terminate"}:
            return {
                "awaiting_approval": False,
                "approval_note": approval_note or "Review was ended without approval.",
                "review_status": "end",
            }

        if not approved_product_id:
            return {
                "awaiting_approval": True,
                "approval_note": "Approval payload was empty.",
                "review_status": "hold",
            }

        return {
            "approved_product_id": approved_product_id,
            "approval_note": approval_note,
            "awaiting_approval": False,
            "review_status": "approved",
        }

    return human_review_node
