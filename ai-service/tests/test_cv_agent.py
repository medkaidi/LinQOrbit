"""Agent graph construction — compiled locally with a fake model, no LLM call."""

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage

from app.agents.tools import CV_TOOLS
from app.graphs.cv_agent import SYSTEM_PROMPT, build_cv_agent
from app.schemas.cv import ParsedCv


class FakeToolModel(GenericFakeChatModel):
    """GenericFakeChatModel does not implement bind_tools; the agent node calls it."""

    def bind_tools(self, tools, **kwargs):  # noqa: ANN001 - signature mirrors the real API
        return self


def _fake_model(*replies: str) -> FakeToolModel:
    return FakeToolModel(messages=iter([AIMessage(content=reply) for reply in replies]))


def test_agent_compiles_into_a_react_loop():
    agent = build_cv_agent(model=_fake_model())

    assert type(agent).__name__ == "CompiledStateGraph"
    assert set(agent.nodes) == {"__start__", "model", "tools"}
    assert "structured_response" in agent.stream_channels


def test_agent_binds_every_cv_tool():
    agent = build_cv_agent(model=_fake_model())

    bound_tool_names = set(agent.nodes["tools"].bound.tools_by_name)
    assert bound_tool_names == {tool.name for tool in CV_TOOLS}


def test_agent_loop_runs_offline_with_a_fake_model():
    """The compiled ReAct loop executes without any network call."""
    agent = build_cv_agent(model=_fake_model("Nothing more to extract."))

    result = agent.invoke(
        {"messages": [HumanMessage(content="Extract the following CV: Camille, engineer at Acme.")]},
        config={"configurable": {"thread_id": "offline-loop"}},
    )

    assert [message.type for message in result["messages"]] == ["human", "ai"]
    # The fake model never called the structured-output tool: no typed result,
    # which is exactly the case parse_cv handles with its repair turn.
    assert result.get("structured_response") is None


def test_system_prompt_sets_the_hr_role_and_the_output_example():
    assert "HR assistant" in SYSTEM_PROMPT
    assert '"start_date": "2021-03"' in SYSTEM_PROMPT
    assert '"summary"' in SYSTEM_PROMPT
    assert ParsedCv.model_json_schema()["title"] == "ParsedCv"
