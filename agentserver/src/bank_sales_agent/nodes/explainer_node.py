"""Role: Add advisor-facing explanation text to each recommendation."""

from __future__ import annotations

from bank_sales_agent.domain.schemas import Customer, Recommendation
from bank_sales_agent.graph.state import AgentState
from bank_sales_agent.llm.base import BaseLLMProvider


def build_explainer_node(provider: BaseLLMProvider):
    """Create a node that adds customer-facing summary text."""

    def explainer_node(state: AgentState) -> AgentState:
        if state.get("errors"):
            return {}

        customer = Customer.model_validate(state["customer_profile"])
        recommendations = [
            Recommendation.model_validate(item)
            for item in state.get("top_products", state.get("recommendations", []))
        ]

        enriched: list[dict[str, object]] = []
        for recommendation in recommendations:
            fallback = (
                f"{customer.name} is a strong candidate for {recommendation.product_name} "
                f"because fit is {recommendation.customer_fit_score:.0f}, KPI is "
                f"{recommendation.kpi_score:.0f}, and recent product context supports it."
            )
            prompt = (
                f"Customer name: {customer.name}\n"
                f"Product: {recommendation.product_name}\n"
                f"Fit score: {recommendation.customer_fit_score:.0f}\n"
                f"KPI score: {recommendation.kpi_score:.0f}\n"
                f"Reasons: {'; '.join(recommendation.reasons)}\n"
                "Write a concise advisor-facing explanation in 2 sentences."
            )
            recommendation.customer_message = provider.generate_text(
                prompt=prompt,
                system_prompt="You explain banking product recommendations clearly and conservatively.",
                mock_fallback=fallback,
            )
            enriched.append(recommendation.model_dump())

        return {"top_products": enriched, "recommendations": enriched}

    return explainer_node
