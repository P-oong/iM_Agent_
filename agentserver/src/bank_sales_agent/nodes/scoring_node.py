"""Role: Build candidate products and propensity scores for a customer."""

from __future__ import annotations

import numpy as np

from bank_sales_agent.domain.schemas import Customer, DemoDataBundle
from bank_sales_agent.graph.state import AgentState


def build_scoring_node(bundle: DemoDataBundle):
    """Create a node that produces candidate products with propensity scores."""

    def scoring_node(state: AgentState) -> AgentState:
        customer_id = state.get("customer_id")
        if not customer_id:
            return {"errors": ["customer_id is required to start the graph."]}

        customer = next(
            (item for item in bundle.customers if item.customer_id == customer_id),
            None,
        )
        if customer is None:
            return {"errors": [f"Unknown customer_id: {customer_id}"]}

        scored_products: list[dict[str, object]] = []
        for product in bundle.products:
            if not (product.min_age <= customer.age <= product.max_age):
                continue

            propensity_score = product.base_fit_score
            reasons = [f"Base propensity starts at {product.base_fit_score:.0f}."]
            if customer.segment in product.target_segments:
                propensity_score += 12.0
                reasons.append(f"Segment '{customer.segment}' matches the target profile.")
            if customer.life_stage in product.priority_tags:
                propensity_score += 8.0
                reasons.append(f"Life stage '{customer.life_stage}' matches a priority tag.")
            if customer.preferred_channel in product.priority_tags:
                propensity_score += 5.0
                reasons.append(f"Preferred channel '{customer.preferred_channel}' fits outreach.")
            if customer.digital_engagement == "high" and "digital" in product.priority_tags:
                propensity_score += 7.0
                reasons.append("High digital engagement supports this offer.")
            if customer.primary_goal == "protect_assets" and "protect" in product.priority_tags:
                propensity_score += 6.0
                reasons.append("Asset protection goal aligns with the product priority.")
            if customer.assets >= 200000 and "wealth" in product.priority_tags:
                propensity_score += 6.0
                reasons.append("High asset level supports a wealth-oriented recommendation.")

            scored_products.append(
                {
                    "product_id": product.product_id,
                    "product_name": product.name,
                    "category": product.category,
                    "target_segments": product.target_segments,
                    "priority_tags": product.priority_tags,
                    "customer_value": product.customer_value,
                    "candidate_reason": reasons[:2],
                    "propensity_score": float(np.clip(propensity_score, 0.0, 100.0)),
                    "customer_fit_score": float(np.clip(propensity_score, 0.0, 100.0)),
                    "document_boost": 0.0,
                    "kpi_score": 0.0,
                    "expected_kpi": 0.0,
                    "final_score": 0.0,
                    "requires_human_review": False,
                    "reasons": reasons[:5],
                }
            )

        # TODO: replace heuristic propensity scoring with a trained ML model in a later stage.
        return {
            "customer_profile": customer.model_dump(),
            "scored_products": scored_products,
        }

    return scoring_node
