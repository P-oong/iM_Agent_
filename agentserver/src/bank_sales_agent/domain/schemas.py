"""Role: Pydantic schemas for demo data, scored results, recommendations, and CRM drafts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Customer(BaseModel):
    """Customer profile used by the recommender."""

    customer_id: str
    name: str
    age: int
    segment: str
    monthly_income: float
    assets: float
    digital_engagement: Literal["low", "medium", "high"]
    life_stage: str
    primary_goal: str
    preferred_channel: Literal["mobile", "branch", "hybrid"]


class Product(BaseModel):
    """Product metadata for candidate generation and scoring."""

    product_id: str
    name: str
    category: str
    target_segments: list[str]
    min_age: int
    max_age: int
    priority_tags: list[str]
    base_fit_score: float
    customer_value: str


class KpiMetric(BaseModel):
    """Business KPI snapshot for recommendation prioritization."""

    product_id: str
    kpi_score: float
    revenue_score: float
    strategic_score: float
    retention_score: float


class ProductDocument(BaseModel):
    """Lightweight product document or notice used as recent context."""

    doc_id: str
    product_id: str
    title: str
    summary: str
    channel_hint: str
    tags: list[str] = Field(default_factory=list)


class Recommendation(BaseModel):
    """Ranked recommendation returned to the user."""

    product_id: str
    product_name: str
    category: str
    customer_fit_score: float
    kpi_score: float
    document_boost: float
    total_score: float
    reasons: list[str] = Field(default_factory=list)
    customer_message: str = ""


class ScoredCandidate(BaseModel):
    """Intermediate scoring output before ranking into recommendations."""

    product_id: str
    product_name: str
    category: str
    customer_fit_score: float
    document_boost: float
    kpi_score: float = 0.0
    total_score: float = 0.0
    reasons: list[str] = Field(default_factory=list)


class FollowUpAction(BaseModel):
    """Simple next-step item for post-call execution."""

    title: str
    owner: str
    due_hint: str


class CrmDraft(BaseModel):
    """Draft note shown after a recommendation is approved."""

    title: str
    summary: str
    next_actions: list[FollowUpAction] = Field(default_factory=list)


class DemoDataBundle(BaseModel):
    """All in-memory demo resources loaded at startup."""

    customers: list[Customer]
    products: list[Product]
    kpi_table: dict[str, KpiMetric]
    product_documents: list[ProductDocument]
