"""Role: Merge KPI signals into scored products and compute expected KPI."""

from __future__ import annotations

from bank_sales_agent.config.settings import AppSettings
from bank_sales_agent.domain.schemas import DemoDataBundle, KpiMetric
from bank_sales_agent.graph.state import AgentState


def build_kpi_node(bundle: DemoDataBundle, settings: AppSettings):
    """Create a node that adds KPI and expected KPI information to products."""

    def kpi_node(state: AgentState) -> AgentState:
        if state.get("errors"):
            return {}

        scored_products = [dict(item) for item in state.get("scored_products", [])]

        enriched_products: list[dict[str, object]] = []
        for scored_product in scored_products:
            metric = bundle.kpi_table.get(str(scored_product["product_id"])) or KpiMetric(
                product_id=str(scored_product["product_id"]),
                kpi_score=50.0,
                revenue_score=50.0,
                strategic_score=50.0,
                retention_score=50.0,
            )
            propensity_score = float(scored_product.get("propensity_score", 0.0))
            expected_kpi = round((propensity_score / 100.0) * metric.kpi_score, 2)
            scored_product["kpi_score"] = metric.kpi_score
            scored_product["expected_kpi"] = expected_kpi
            scored_product["reasons"] = [
                *list(scored_product.get("reasons", [])),
                "KPI score reflects revenue, strategic, and retention priorities.",
                f"Expected KPI is estimated at {expected_kpi:.2f} from propensity and KPI score.",
            ]
            enriched_products.append(scored_product)

        # TODO: replace heuristic KPI combination with a learned ranking model when training data is ready.
        return {
            "scored_products": enriched_products,
        }

    return kpi_node
