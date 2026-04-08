"""Role: Remove unsuitable products, compute final ranking, and set review routing flags."""

from __future__ import annotations

from bank_sales_agent.config.settings import AppSettings
from bank_sales_agent.domain.schemas import Recommendation
from bank_sales_agent.graph.state import AgentState


def build_policy_guard_node(settings: AppSettings):
    """Create a node that filters products, ranks them, and sets review flags."""

    def policy_guard_node(state: AgentState) -> AgentState:
        if state.get("errors"):
            return {}

        scored_products = [dict(item) for item in state.get("scored_products", [])]
        policy_flags: list[str] = []
        filtered_scored_products: list[dict[str, object]] = []
        filtered_top_products: list[Recommendation] = []

        blocked_ids: set[str] = set()
        for scored_product in scored_products:
            requires_human_review = False
            category = str(scored_product.get("category", ""))
            propensity_score = float(scored_product.get("propensity_score", 0.0))
            product_id = str(scored_product.get("product_id", ""))
            kpi_score = float(scored_product.get("kpi_score", 0.0))
            document_boost = float(scored_product.get("document_boost", 0.0))
            expected_kpi = float(scored_product.get("expected_kpi", 0.0))

            final_score = round(
                propensity_score * settings.score_weights.customer_fit
                + kpi_score * settings.score_weights.kpi_score
                + document_boost * settings.score_weights.document_boost
                + expected_kpi * 0.10,
                2,
            )
            scored_product["final_score"] = final_score

            if category == "loan" and propensity_score < 55.0:
                policy_flags.append(
                    f"{product_id} removed because propensity is below the loan threshold."
                )
                blocked_ids.add(product_id)
                continue
            if category == "investment":
                requires_human_review = True
                policy_flags.append(
                    f"{product_id} requires suitability confirmation before advisor approval."
                )
            if float(scored_product.get("expected_kpi", 0.0)) < 25.0:
                requires_human_review = True
                policy_flags.append(
                    f"{product_id} has low expected KPI and should be manually reviewed."
                )

            scored_product["requires_human_review"] = requires_human_review
            filtered_scored_products.append(scored_product)

        filtered_scored_products.sort(
            key=lambda product: float(product.get("final_score", 0.0)),
            reverse=True,
        )

        filtered_top_products = [
            Recommendation(
                product_id=str(product["product_id"]),
                product_name=str(product["product_name"]),
                category=str(product["category"]),
                customer_fit_score=float(product["customer_fit_score"]),
                kpi_score=float(product["kpi_score"]),
                document_boost=float(product["document_boost"]),
                total_score=float(product["final_score"]),
                reasons=list(product.get("reasons", [])),
            )
            for product in filtered_scored_products[: settings.top_k_recommendations]
            if str(product["product_id"]) not in blocked_ids
        ]

        approval_required = bool(filtered_top_products)
        if any(product.get("requires_human_review", False) for product in filtered_scored_products):
            approval_required = True

        # TODO: replace rule-based guard checks with policy retrieval and compliance rules over source documents.

        return {
            "scored_products": filtered_scored_products,
            "top_products": [item.model_dump() for item in filtered_top_products],
            "recommendations": [item.model_dump() for item in filtered_top_products],
            "policy_flags": policy_flags,
            "approval_required": approval_required,
            "review_status": "pending",
        }

    return policy_guard_node
