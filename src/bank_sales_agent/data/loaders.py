"""Role: Load dummy CSV and YAML data into validated domain objects."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import yaml

from bank_sales_agent.domain.schemas import Customer, DemoDataBundle, KpiMetric, Product, ProductDocument


def _split_values(value: str) -> list[str]:
    """Parse semicolon separated values from the product table."""
    return [item.strip() for item in value.split(";") if item.strip()]


def load_customers(data_dir: Path) -> list[Customer]:
    """Load customer records from the demo CSV."""
    frame = pd.read_csv(data_dir / "customers.csv")
    return [Customer(**row) for row in frame.to_dict(orient="records")]


def load_products(data_dir: Path) -> list[Product]:
    """Load product records from the demo CSV."""
    frame = pd.read_csv(data_dir / "products.csv")
    records = frame.to_dict(orient="records")
    return [
        Product(
            **{
                **record,
                "target_segments": _split_values(str(record["target_segments"])),
                "priority_tags": _split_values(str(record["priority_tags"])),
            }
        )
        for record in records
    ]


def load_kpi_table(data_dir: Path) -> dict[str, KpiMetric]:
    """Load KPI metrics keyed by product ID."""
    frame = pd.read_csv(data_dir / "kpi_table.csv")
    metrics = [KpiMetric(**row) for row in frame.to_dict(orient="records")]
    return {metric.product_id: metric for metric in metrics}


def load_product_documents(data_dir: Path) -> list[ProductDocument]:
    """Load sample product documents and notices from YAML."""
    with (data_dir / "product_docs_sample.yaml").open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle) or {}
    documents = payload.get("documents", [])
    return [ProductDocument(**document) for document in documents]


def load_demo_bundle(data_dir: Path) -> DemoDataBundle:
    """Load all demo resources in one shot for the orchestrator."""
    # TODO: split into repository classes if data sources become external.
    return DemoDataBundle(
        customers=load_customers(data_dir),
        products=load_products(data_dir),
        kpi_table=load_kpi_table(data_dir),
        product_documents=load_product_documents(data_dir),
    )
