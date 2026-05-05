"""Role: Load dummy CSV and YAML data into validated domain objects."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

import yaml

from bank_sales_agent.domain.schemas import Customer, DemoDataBundle, KpiMetric, Product, ProductDocument


def _split_values(value: str) -> list[str]:
    """Parse semicolon separated values from the product table."""
    return [item.strip() for item in value.split(";") if item.strip()]


def _read_csv(path: Path) -> list[dict[str, Any]]:
    """Read a CSV file and return a list of dicts with auto-cast numeric values."""
    rows: list[dict[str, Any]] = []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for raw in reader:
            record: dict[str, Any] = {}
            for k, v in raw.items():
                try:
                    record[k] = int(v)
                except ValueError:
                    try:
                        record[k] = float(v)
                    except ValueError:
                        record[k] = v
            rows.append(record)
    return rows


def load_customers(data_dir: Path) -> list[Customer]:
    """Load customer records from the demo CSV."""
    return [Customer(**row) for row in _read_csv(data_dir / "customers.csv")]


def load_products(data_dir: Path) -> list[Product]:
    """Load product records from the demo CSV."""
    return [
        Product(
            **{
                **record,
                "target_segments": _split_values(str(record["target_segments"])),
                "priority_tags": _split_values(str(record["priority_tags"])),
            }
        )
        for record in _read_csv(data_dir / "products.csv")
    ]


def load_kpi_table(data_dir: Path) -> dict[str, KpiMetric]:
    """Load KPI metrics keyed by product ID."""
    metrics = [KpiMetric(**row) for row in _read_csv(data_dir / "kpi_table.csv")]
    return {metric.product_id: metric for metric in metrics}


def load_product_documents(data_dir: Path) -> list[ProductDocument]:
    """Load sample product documents and notices from YAML."""
    with (data_dir / "product_docs_sample.yaml").open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle) or {}
    documents = payload.get("documents", [])
    return [ProductDocument(**document) for document in documents]


def load_demo_bundle(data_dir: Path) -> DemoDataBundle:
    """Load all demo resources in one shot for the orchestrator."""
    return DemoDataBundle(
        customers=load_customers(data_dir),
        products=load_products(data_dir),
        kpi_table=load_kpi_table(data_dir),
        product_documents=load_product_documents(data_dir),
    )
