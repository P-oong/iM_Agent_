"""Role: Deterministic product knowledge retrieval with a future RAG replacement boundary."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np

from bank_sales_agent.domain.schemas import Customer, Product, ProductDocument


@dataclass
class ProductKnowledgeRecord:
    """Structured product knowledge returned to the graph node."""

    product_id: str
    retrieval_score: float
    eligibility_conditions: list[str]
    required_documents: list[str]
    benefits: list[str]
    cautions: list[str]
    event_notes: list[str]
    matched_doc_titles: list[str]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable representation for graph state."""
        return {
            "product_id": self.product_id,
            "retrieval_score": self.retrieval_score,
            "eligibility_conditions": self.eligibility_conditions,
            "required_documents": self.required_documents,
            "benefits": self.benefits,
            "cautions": self.cautions,
            "event_notes": self.event_notes,
            "matched_doc_titles": self.matched_doc_titles,
        }


class ProductKnowledgeRetriever(Protocol):
    """Retrieval interface that can later be replaced by a RAG-backed retriever."""

    def retrieve(self, customer: Customer, product: Product) -> ProductKnowledgeRecord:
        """Return structured product knowledge for one customer-product pair."""


class DeterministicProductKnowledgeRetriever:
    """Retrieve product knowledge from YAML docs and product metadata with fixed rules."""

    def __init__(self, product_documents: list[ProductDocument]) -> None:
        self.product_documents = product_documents

    def retrieve(self, customer: Customer, product: Product) -> ProductKnowledgeRecord:
        related_docs = [
            document for document in self.product_documents if document.product_id == product.product_id
        ]
        retrieval_score = self._calculate_retrieval_score(customer, product, related_docs)
        return ProductKnowledgeRecord(
            product_id=product.product_id,
            retrieval_score=retrieval_score,
            eligibility_conditions=self._build_eligibility_conditions(customer, product),
            required_documents=self._build_required_documents(product),
            benefits=self._build_benefits(product, related_docs),
            cautions=self._build_cautions(customer, product),
            event_notes=self._build_event_notes(related_docs),
            matched_doc_titles=[document.title for document in related_docs],
        )

    def _calculate_retrieval_score(
        self,
        customer: Customer,
        product: Product,
        related_docs: list[ProductDocument],
    ) -> float:
        score = 0.0
        for document in related_docs:
            score += 10.0
            if document.channel_hint == customer.preferred_channel:
                score += 5.0
            if any(tag in product.priority_tags for tag in document.tags):
                score += 4.0
            if customer.segment in document.tags:
                score += 3.0
        return float(np.clip(score, 0.0, 25.0))

    def _build_eligibility_conditions(self, customer: Customer, product: Product) -> list[str]:
        conditions = [f"Age should be between {product.min_age} and {product.max_age}."]
        if customer.segment in product.target_segments:
            conditions.append(f"Target customer segment includes {customer.segment}.")
        if product.category == "loan":
            conditions.append("Income and repayment capacity review required.")
        if product.category == "investment":
            conditions.append("Investor suitability confirmation required.")
        if "retirement" in product.priority_tags:
            conditions.append("Retirement planning suitability should be discussed.")
        return conditions

    def _build_required_documents(self, product: Product) -> list[str]:
        if product.category == "loan":
            return ["ID", "income proof", "existing loan statement"]
        if product.category == "investment":
            return ["ID", "risk profile form", "account verification"]
        if product.category == "card":
            return ["ID", "card application form"]
        return ["ID", "basic application form"]

    def _build_benefits(
        self,
        product: Product,
        related_docs: list[ProductDocument],
    ) -> list[str]:
        benefits = [product.customer_value]
        if any("campaign" in document.tags for document in related_docs):
            benefits.append("Current campaign messaging can strengthen the offer.")
        if "premium" in product.priority_tags:
            benefits.append("Premium positioning can improve perceived value.")
        if "digital" in product.priority_tags:
            benefits.append("Digital onboarding can reduce friction for the customer.")
        return benefits

    def _build_cautions(self, customer: Customer, product: Product) -> list[str]:
        cautions: list[str] = []
        if product.category == "loan":
            cautions.append("Explain repayment burden and refinancing assumptions carefully.")
        if product.category == "investment":
            cautions.append("Do not proceed without explaining principal risk and suitability.")
        if customer.digital_engagement == "low" and "digital" in product.priority_tags:
            cautions.append("Digital-heavy onboarding may need additional advisor support.")
        if customer.age >= 55 and product.category == "card":
            cautions.append("Lifestyle reward fit should be validated before recommending.")
        return cautions or ["Use standard suitability and disclosure checks."]

    def _build_event_notes(self, related_docs: list[ProductDocument]) -> list[str]:
        if not related_docs:
            return ["No active product event note found in the sample YAML."]
        return [f"{document.title}: {document.summary}" for document in related_docs]


# TODO: add a RAGProductKnowledgeRetriever that queries a vector store instead of YAML files.
