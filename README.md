# bank_sales_agent

Minimal LangGraph-first skeleton for a bank sales support multi-agent prototype.

## Included files

```text
pyproject.toml
README.md
.gitignore
.env.example
data/customers.csv
data/products.csv
data/kpi_table.csv
data/product_docs_sample.yaml
src/bank_sales_agent/__init__.py
src/bank_sales_agent/main.py
src/bank_sales_agent/config/settings.py
src/bank_sales_agent/data/loaders.py
src/bank_sales_agent/domain/schemas.py
src/bank_sales_agent/graph/state.py
src/bank_sales_agent/graph/build_graph.py
src/bank_sales_agent/graph/checkpointer.py
src/bank_sales_agent/graph/routes.py
src/bank_sales_agent/nodes/scoring_node.py
src/bank_sales_agent/nodes/kpi_node.py
src/bank_sales_agent/nodes/product_knowledge_node.py
src/bank_sales_agent/nodes/policy_guard_node.py
src/bank_sales_agent/nodes/explainer_node.py
src/bank_sales_agent/nodes/crm_node.py
src/bank_sales_agent/nodes/human_review_node.py
src/bank_sales_agent/llm/base.py
src/bank_sales_agent/llm/local_provider.py
src/bank_sales_agent/llm/upstage_provider.py
src/bank_sales_agent/ui/app.py
```

## Run

```bash
poetry install
poetry run python -m bank_sales_agent.main --customer-id C001 --thread-id demo-001
poetry run python -m bank_sales_agent.main --thread-id demo-001 --resume-approval P001
poetry run streamlit run src/bank_sales_agent/ui/app.py
```

## Notes

- The graph uses `StateGraph`, `START`, `END`, and a conditional edge after human review.
- The default checkpointer is in-memory.
- SQLite checkpoint support is left as a TODO in the skeleton.
- The current flow is deterministic and ready for later local or Upstage LLM integration.
