"""Role: CLI entrypoint for the LangGraph-based bank sales prototype."""

from __future__ import annotations

import argparse
import json
from uuid import uuid4

from bank_sales_agent.config.settings import get_settings
from bank_sales_agent.graph.build_graph import build_sales_graph

try:
    from langgraph.types import Command
except ImportError:  # pragma: no cover
    Command = None  # type: ignore[assignment]


def build_parser() -> argparse.ArgumentParser:
    """Build a CLI for starting or resuming a LangGraph thread."""
    parser = argparse.ArgumentParser(description="Run the bank sales LangGraph prototype.")
    parser.add_argument(
        "--customer-id",
        help="Customer ID to evaluate when starting a new thread.",
    )
    parser.add_argument(
        "--thread-id",
        help="Existing thread ID to resume, or omit to generate a new one.",
    )
    parser.add_argument(
        "--resume-approval",
        help="Approved product ID to resume the human approval step.",
    )
    parser.add_argument(
        "--review-action",
        choices=["approve", "hold", "end"],
        help="Review action to resume from human_review_node.",
    )
    parser.add_argument(
        "--approval-note",
        default="Approved from CLI.",
        help="Optional reviewer note for the approval resume step.",
    )
    return parser


def _normalize_result(result: object) -> object:
    """Convert LangGraph runtime objects into a JSON-friendly payload."""
    if not isinstance(result, dict):
        return result

    normalized: dict[str, object] = {}
    for key, value in result.items():
        if key == "__interrupt__":
            normalized[key] = [getattr(item, "value", str(item)) for item in value]
        else:
            normalized[key] = value
    return normalized


def run() -> None:
    """Execute or resume a graph thread and print a JSON snapshot.

    Example:
    config = {"configurable": {"thread_id": "demo-001"}}
    graph.invoke({"thread_id": "demo-001", "customer_id": "C001"}, config=config)
    """
    settings = get_settings()
    graph = build_sales_graph(settings)

    args = build_parser().parse_args()
    thread_id = args.thread_id or uuid4().hex
    config = {"configurable": {"thread_id": thread_id}}

    if args.resume_approval or args.review_action:
        if Command is None:
            raise SystemExit("LangGraph is required. Run `poetry install` first.")
        if args.review_action == "approve" and not args.resume_approval:
            raise SystemExit("`--resume-approval` is required when `--review-action approve`.")
        result = graph.invoke(
            Command(
                resume={
                    "approved_product_id": args.resume_approval,
                    "review_action": args.review_action or "approve",
                    "approval_note": args.approval_note,
                }
            ),
            config=config,
        )
    else:
        if not args.customer_id:
            raise SystemExit("`--customer-id` is required when starting a new thread.")
        result = graph.invoke(
            {
                "thread_id": thread_id,
                "customer_id": args.customer_id,
            },
            config=config,
        )

    snapshot = graph.get_state(config)
    payload = {
        "thread_id": thread_id,
        "result": _normalize_result(result),
        "state": snapshot.values if snapshot is not None else {},
    }
    print(json.dumps(payload, indent=2, default=str))


if __name__ == "__main__":
    run()
