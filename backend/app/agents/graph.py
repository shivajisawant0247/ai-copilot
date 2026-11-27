"""
LangGraph Multi-Agent Orchestrator Scaffold for AI Data Engineering Copilot.

Defines typed agent nodes matching the 6 agents tracked by the frontend UI:
- Data Cleaning Agent
- SQL Generation Agent
- Analytics & Dashboard Agent
- ETL Pipeline Agent
- Machine Learning Agent
- Report Generation Agent
"""

from typing import Any, Dict, List, TypedDict


class CopilotGraphState(TypedDict):
    dataset_id: str
    task_type: str
    prompt: str
    schema: List[Dict[str, Any]]
    result: Dict[str, Any]
    agent_status: Dict[str, str]


AGENT_REGISTRY = {
    "cleaning": "Data Cleaning Agent",
    "sql": "SQL Generation Agent",
    "analytics": "Analytics & Dashboard Agent",
    "etl": "ETL Pipeline Agent",
    "ml": "Machine Learning Agent",
    "report": "Report Generation Agent",
}


def build_langgraph_workflow():
    """
    Constructs a LangGraph StateGraph when `langgraph` is installed.
    Falls back cleanly if optional LLM API keys are not yet configured.
    """
    try:
        from langgraph.graph import END, StateGraph  # type: ignore

        graph = StateGraph(CopilotGraphState)

        def router_node(state: CopilotGraphState) -> CopilotGraphState:
            return state

        graph.add_node("router", router_node)
        graph.set_entry_point("router")
        graph.add_edge("router", END)
        return graph.compile()
    except ImportError:
        return None
