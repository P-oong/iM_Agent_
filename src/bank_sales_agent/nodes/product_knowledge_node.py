"""Role: Load product knowledge for each scored product through a retriever boundary."""

from __future__ import annotations

from bank_sales_agent.data.product_knowledge_retriever import (
    DeterministicProductKnowledgeRetriever,
    ProductKnowledgeRetriever,
)
from bank_sales_agent.domain.schemas import Customer, DemoDataBundle, Product
from bank_sales_agent.graph.state import AgentState


def build_product_knowledge_node(
    bundle: DemoDataBundle,
    retriever: ProductKnowledgeRetriever | None = None,
):
    """Create a node that enriches products with retrieved knowledge and event context."""
    knowledge_retriever = retriever or DeterministicProductKnowledgeRetriever(
        bundle.product_documents
    )

    def product_knowledge_node(state: AgentState) -> AgentState:
        if state.get("errors"):
            return {}

        customer = Customer.model_validate(state["customer_profile"])
        scored_products = [dict(item) for item in state.get("scored_products", [])]
        products_by_id = {product.product_id: product for product in bundle.products}

        enriched: list[dict[str, object]] = []
        product_knowledge_records: list[dict[str, object]] = []
        for scored_product in scored_products:
            product = products_by_id.get(str(scored_product["product_id"]))
            if product is None:
                enriched.append(scored_product)
                continue

            knowledge = knowledge_retriever.retrieve(customer=customer, product=product)
            scored_product["document_boost"] = min(float(knowledge.retrieval_score), 20.0)
            scored_product["product_knowledge"] = knowledge.to_dict()
            product_knowledge_records.append(knowledge.to_dict())

            if knowledge.matched_doc_titles:
                scored_product["reasons"] = [
                    *list(scored_product.get("reasons", [])),
                    f"Deterministic retrieval matched {len(knowledge.matched_doc_titles)} product notes.",
                ]
            else:
                scored_product["reasons"] = [
                    *list(scored_product.get("reasons", [])),
                    "No matching product note was found, using metadata-only product knowledge.",
                ]
            enriched.append(scored_product)

        # TODO: swap the deterministic retriever with a RAG-backed retriever over vector search.
        return {
            "product_knowledge": product_knowledge_records,
            "scored_products": enriched,
        }

    return product_knowledge_node
