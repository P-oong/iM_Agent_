"""Role: Create the LangGraph checkpointer used for prototype thread persistence."""

from __future__ import annotations

from pathlib import Path

from langgraph.checkpoint.memory import InMemorySaver

from bank_sales_agent.config.settings import AppSettings


def create_checkpointer(settings: AppSettings):
    """Return the configured checkpointer for the current environment."""
    if settings.checkpointer_backend == "memory":
        return InMemorySaver()

    if settings.checkpointer_backend == "sqlite":
        # TODO: enable SQLite saver after adding `langgraph-checkpoint-sqlite`.
        sqlite_path = Path(settings.sqlite_db_path)
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        raise RuntimeError(
            "SQLite checkpointer is not enabled in this skeleton yet. "
            "Install the optional dependency and implement the saver here."
        )

    raise ValueError(f"Unsupported checkpointer backend: {settings.checkpointer_backend}")
