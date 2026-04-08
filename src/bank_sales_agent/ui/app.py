"""Role: Streamlit UI that runs and resumes the LangGraph sales workflow."""

from __future__ import annotations

from uuid import uuid4

import streamlit as st
from langgraph.types import Command

from bank_sales_agent.config import AppSettings, get_settings
from bank_sales_agent.data.loaders import load_demo_bundle
from bank_sales_agent.graph.build_graph import build_sales_graph


def _build_runtime_settings() -> AppSettings:
    """Create runtime settings from env defaults plus sidebar overrides."""
    base_settings = get_settings()

    provider_choice = st.sidebar.selectbox(
        "LLM Provider",
        ["mock", "local", "upstage"],
        index=0,
        help="Choose which provider the explainer and CRM nodes should use.",
    )

    local_endpoint = base_settings.local_model_endpoint
    local_model_name = base_settings.local_model_name
    local_model_api_key = base_settings.local_model_api_key
    upstage_api_key = base_settings.upstage_api_key
    upstage_model_name = base_settings.upstage_model_name
    upstage_base_url = base_settings.upstage_base_url

    if provider_choice == "local":
        local_endpoint = st.sidebar.text_input(
            "Local Endpoint",
            value=base_settings.local_model_endpoint,
        )
        local_model_name = st.sidebar.text_input(
            "Local Model",
            value=base_settings.local_model_name or "local-model",
        )
        local_model_api_key = st.sidebar.text_input(
            "Local API Key",
            value=base_settings.local_model_api_key,
            type="password",
        )
    elif provider_choice == "upstage":
        upstage_api_key = st.sidebar.text_input(
            "Upstage API Key",
            value=base_settings.upstage_api_key,
            type="password",
        )
        upstage_model_name = st.sidebar.text_input(
            "Upstage Model",
            value=base_settings.upstage_model_name,
        )
        upstage_base_url = st.sidebar.text_input(
            "Upstage Base URL",
            value=base_settings.upstage_base_url,
        )

    return base_settings.model_copy(
        update={
            "llm_provider": "none" if provider_choice == "mock" else provider_choice,
            "local_model_endpoint": local_endpoint,
            "local_model_name": local_model_name,
            "local_model_api_key": local_model_api_key,
            "upstage_api_key": upstage_api_key,
            "upstage_model_name": upstage_model_name,
            "upstage_base_url": upstage_base_url,
        }
    )


@st.cache_resource
def get_graph(
    llm_provider: str,
    local_endpoint: str,
    local_model_name: str,
    local_model_api_key: str,
    upstage_api_key: str,
    upstage_model_name: str,
    upstage_base_url: str,
    checkpointer_backend: str,
):
    """Build the compiled graph once per provider/checkpointer configuration."""
    settings = get_settings().model_copy(
        update={
            "llm_provider": llm_provider,
            "local_model_endpoint": local_endpoint,
            "local_model_name": local_model_name,
            "local_model_api_key": local_model_api_key,
            "upstage_api_key": upstage_api_key,
            "upstage_model_name": upstage_model_name,
            "upstage_base_url": upstage_base_url,
            "checkpointer_backend": checkpointer_backend,
        }
    )
    return build_sales_graph(settings)


def _render_scores(product: dict[str, object], scored_lookup: dict[str, dict[str, object]]) -> None:
    """Render the score summary for one recommended product."""
    scored_product = scored_lookup.get(str(product["product_id"]), {})
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Propensity", f"{float(scored_product.get('propensity_score', 0.0)):.1f}")
    col2.metric("KPI", f"{float(scored_product.get('kpi_score', product.get('kpi_score', 0.0))):.1f}")
    col3.metric("Expected KPI", f"{float(scored_product.get('expected_kpi', 0.0)):.1f}")
    col4.metric("Final", f"{float(scored_product.get('final_score', product.get('total_score', 0.0))):.1f}")


def _render_product_knowledge(scored_product: dict[str, object]) -> None:
    """Render deterministic product knowledge details for one scored product."""
    knowledge = scored_product.get("product_knowledge")
    if not isinstance(knowledge, dict):
        return

    with st.expander("Product knowledge", expanded=False):
        st.write("Eligibility")
        for item in knowledge.get("eligibility_conditions", []):
            st.write(f"- {item}")

        st.write("Required documents")
        for item in knowledge.get("required_documents", []):
            st.write(f"- {item}")

        st.write("Benefits")
        for item in knowledge.get("benefits", []):
            st.write(f"- {item}")

        st.write("Cautions")
        for item in knowledge.get("cautions", []):
            st.write(f"- {item}")

        st.write("Event notes")
        for item in knowledge.get("event_notes", []):
            st.write(f"- {item}")


def run() -> None:
    """Render the LangGraph execution frontend."""
    st.set_page_config(page_title="Bank Sales Agent", layout="wide")
    st.title("Bank Sales Agent Prototype")
    st.caption("LangGraph execution frontend with thread-aware demo flow.")

    runtime_settings = _build_runtime_settings()
    bundle = load_demo_bundle(runtime_settings.data_dir)
    graph = get_graph(
        runtime_settings.llm_provider,
        runtime_settings.local_model_endpoint,
        runtime_settings.local_model_name,
        runtime_settings.local_model_api_key,
        runtime_settings.upstage_api_key,
        runtime_settings.upstage_model_name,
        runtime_settings.upstage_base_url,
        runtime_settings.checkpointer_backend,
    )

    st.sidebar.markdown("### Thread control")
    if "thread_id" not in st.session_state:
        st.session_state.thread_id = uuid4().hex

    if st.sidebar.button("Generate new thread_id", use_container_width=True):
        st.session_state.thread_id = uuid4().hex

    thread_id = st.sidebar.text_input("thread_id", value=st.session_state.thread_id)
    st.session_state.thread_id = thread_id

    customer_options = {
        f"{customer.customer_id} - {customer.name}": customer.customer_id
        for customer in bundle.customers
    }
    selected_label = st.selectbox("Customer", list(customer_options.keys()))
    selected_customer_id = customer_options[selected_label]

    config = {"configurable": {"thread_id": thread_id}}

    run_col, state_col = st.columns([2, 1])
    if run_col.button("Run graph.invoke", use_container_width=True):
        graph.invoke(
            {
                "thread_id": thread_id,
                "customer_id": selected_customer_id,
            },
            config=config,
        )
    state_col.caption(f"Current thread: `{thread_id}`")

    snapshot = graph.get_state(config)
    state = snapshot.values if snapshot is not None else {}

    if not state:
        st.info("Run the graph to generate recommendations.")
        return

    if state.get("errors"):
        st.error("\n".join(state["errors"]))
        return

    scored_products = state.get("scored_products", [])
    scored_lookup = {
        str(product["product_id"]): product
        for product in scored_products
        if isinstance(product, dict) and "product_id" in product
    }
    top_products = state.get("top_products", state.get("recommendations", []))[:3]

    st.subheader("Recommended Top 3")
    for product in top_products:
        product_id = str(product["product_id"])
        scored_product = scored_lookup.get(product_id, {})
        with st.container(border=True):
            st.markdown(f"**{product['product_name']}** (`{product_id}`)")
            _render_scores(product, scored_lookup)

            description = product.get("customer_message") or "Explanation will appear after explainer_node runs."
            st.info(str(description))

            if product.get("reasons"):
                st.write("Reasons")
                for reason in product["reasons"]:
                    st.write(f"- {reason}")

            _render_product_knowledge(scored_product)

    st.subheader("Human Review Demo")
    st.write("Use the mock approval controls below to simulate the human_review_node step.")

    default_product_id = top_products[0]["product_id"] if top_products else ""
    selected_product_id = st.selectbox(
        "Product to review",
        [str(item["product_id"]) for item in top_products] if top_products else [""],
        index=0,
    )
    approval_note = st.text_input("Approval note", value="Approved from Streamlit demo.")

    approve_col, hold_col, end_col = st.columns(3)
    if approve_col.button("Mock Approve", use_container_width=True, disabled=not default_product_id):
        graph.invoke(
            Command(
                resume={
                    "approved_product_id": selected_product_id,
                    "review_action": "approve",
                    "approval_note": approval_note,
                }
            ),
            config=config,
        )
        snapshot = graph.get_state(config)
        state = snapshot.values if snapshot is not None else {}

    if hold_col.button("Mock Hold", use_container_width=True, disabled=not default_product_id):
        graph.invoke(
            Command(
                resume={
                    "review_action": "hold",
                    "approval_note": "Review held in Streamlit demo.",
                }
            ),
            config=config,
        )
        snapshot = graph.get_state(config)
        state = snapshot.values if snapshot is not None else {}

    if end_col.button("Mock End", use_container_width=True, disabled=not default_product_id):
        graph.invoke(
            Command(
                resume={
                    "review_action": "end",
                    "approval_note": "Review ended in Streamlit demo.",
                }
            ),
            config=config,
        )
        snapshot = graph.get_state(config)
        state = snapshot.values if snapshot is not None else {}

    st.caption(
        "This demo keeps thread_id and checkpointer structure in place so a full interrupt/resume flow can be expanded later."
    )

    crm_draft = state.get("crm_draft")
    if crm_draft:
        st.subheader("CRM Draft")
        st.write(crm_draft["title"])
        st.write(crm_draft["summary"])
        for action in crm_draft["next_actions"]:
            st.write(f"- {action['title']} | owner: {action['owner']} | due: {action['due_hint']}")
    else:
        st.subheader("CRM Draft")
        st.write("No CRM draft yet. Approve a product to continue the demo flow.")

    with st.expander("Current graph state", expanded=False):
        st.json(state)


if __name__ == "__main__":
    run()
