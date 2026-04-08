"""Role: Data access exports for the bank sales agent."""

from bank_sales_agent.data.loaders import load_demo_bundle
from bank_sales_agent.data.product_knowledge_retriever import (
    DeterministicProductKnowledgeRetriever,
    ProductKnowledgeRetriever,
)

__all__ = [
    "DeterministicProductKnowledgeRetriever",
    "ProductKnowledgeRetriever",
    "load_demo_bundle",
]
