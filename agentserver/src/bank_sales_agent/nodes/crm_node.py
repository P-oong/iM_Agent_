"""Role: Build a simple CRM draft after human approval."""

from __future__ import annotations

from bank_sales_agent.domain.schemas import CrmDraft, Customer, FollowUpAction, Recommendation
from bank_sales_agent.graph.state import AgentState
from bank_sales_agent.llm.base import BaseLLMProvider


def build_crm_node(provider: BaseLLMProvider):
    """Create a node that converts an approved recommendation into a CRM draft."""

    def crm_node(state: AgentState) -> AgentState:
        if state.get("errors"):
            return {}

        approved_product_id = state.get("approved_product_id")
        if not approved_product_id:
            return {"crm_draft": None}

        customer = Customer.model_validate(state["customer_profile"])
        recommendations = [
            Recommendation.model_validate(item)
            for item in state.get("top_products", state.get("recommendations", []))
        ]
        approved = next(
            (item for item in recommendations if item.product_id == approved_product_id),
            None,
        )
        if approved is None:
            return {"errors": [f"Approved product {approved_product_id} not found."]}

        fallback_summary = (
            f"Customer {customer.name} approved for {approved.product_name}. "
            f"Advisor note: {state.get('approval_note', '') or 'No note provided.'}"
        )
        prompt = (
            f"Customer: {customer.name} ({customer.customer_id})\n"
            f"Approved product: {approved.product_name}\n"
            f"Category: {approved.category}\n"
            f"Recommendation score: {approved.total_score:.2f}\n"
            f"Advisor note: {state.get('approval_note', '') or 'No note provided.'}\n"
            "Draft a concise CRM summary in 2 to 3 sentences."
        )

        draft = CrmDraft(
            title=f"CRM Draft - {customer.name}",
            summary=provider.generate_text(
                prompt=prompt,
                system_prompt="You draft CRM notes for bank relationship managers.",
                mock_fallback=fallback_summary,
            ),
            next_actions=[
                FollowUpAction(
                    title="Send follow-up summary",
                    owner="RM",
                    due_hint="today",
                ),
                FollowUpAction(
                    title="Register result in CRM",
                    owner="RM",
                    due_hint="within 2 days",
                ),
            ],
        )
        return {"crm_draft": draft.model_dump()}

    return crm_node
