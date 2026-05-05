"""Role: Build the LangGraph StateGraph for the bank sales agent skeleton."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from bank_sales_agent.config.settings import AppSettings
from bank_sales_agent.data.loaders import load_demo_bundle
from bank_sales_agent.graph.checkpointer import create_checkpointer
from bank_sales_agent.graph.routes import route_after_human_review
from bank_sales_agent.graph.state import AgentState
from bank_sales_agent.llm.factory import create_llm_provider
from bank_sales_agent.nodes.crm_node import build_crm_node
from bank_sales_agent.nodes.explainer_node import build_explainer_node
from bank_sales_agent.nodes.human_review_node import build_human_review_node
from bank_sales_agent.nodes.kpi_node import build_kpi_node
from bank_sales_agent.nodes.policy_guard_node import build_policy_guard_node
from bank_sales_agent.nodes.product_knowledge_node import build_product_knowledge_node
from bank_sales_agent.nodes.scoring_node import build_scoring_node


def build_sales_graph(settings: AppSettings):
    """Compile the multi-agent StateGraph that acts as the workflow orchestrator."""
    bundle = load_demo_bundle(settings.data_dir)
    provider = create_llm_provider(settings)

    builder = StateGraph(AgentState)
    builder.add_node("scoring_node", build_scoring_node(bundle))
    builder.add_node("kpi_node", build_kpi_node(bundle, settings))
    builder.add_node("product_knowledge_node", build_product_knowledge_node(bundle))
    builder.add_node("policy_guard_node", build_policy_guard_node(settings))
    builder.add_node("explainer_node", build_explainer_node(provider))
    builder.add_node("human_review_node", build_human_review_node())
    builder.add_node("crm_node", build_crm_node(provider))

    builder.add_edge(START, "scoring_node")
    builder.add_edge("scoring_node", "kpi_node")
    builder.add_edge("kpi_node", "product_knowledge_node")
    builder.add_edge("product_knowledge_node", "policy_guard_node")
    builder.add_edge("policy_guard_node", "explainer_node")
    builder.add_edge("explainer_node", "human_review_node")
    builder.add_conditional_edges(
        "human_review_node",
        route_after_human_review,
        {
            "crm_node": "crm_node",
            "hold": END,
            "end": END,
        },
    )
    builder.add_edge("crm_node", END)

    return builder.compile(checkpointer=create_checkpointer(settings))
