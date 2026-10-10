"""Agent graph construction — compiled locally with a fake model, no LLM call."""

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.graphs.normalize_agent import (
    MODEL_CALL_LIMIT,
    SYSTEM_PROMPT,
    build_normalize_agent,
    render_system_prompt,
)
from app.schemas.cv import ReferenceContext
from app.schemas.normalize import NormalizedProfile


class FakeBindableModel(GenericFakeChatModel):
    """Stands in for Gemini: records calls, never produces the structured output."""

    replies: tuple[str, ...] = ()
    call_count: int = 0

    def bind_tools(self, tools, **kwargs):  # noqa: ANN001 - signature mirrors the real API
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):  # noqa: ANN001
        self.call_count += 1
        reply = AIMessage(content=self.replies[(self.call_count - 1) % len(self.replies)])
        return ChatResult(generations=[ChatGeneration(message=reply)])


def _fake_model(*replies: str) -> FakeBindableModel:
    return FakeBindableModel(replies=replies, messages=iter([]))


def test_agent_compiles_into_a_structured_canonicalisation_loop():
    agent = build_normalize_agent(model=_fake_model())

    assert type(agent).__name__ == "CompiledStateGraph"
    assert set(agent.nodes) == {
        "__start__",
        "model",
        "ModelCallLimitMiddleware.before_model",
        "ModelCallLimitMiddleware.after_model",
    }
    assert "structured_response" in agent.stream_channels


def test_agent_loop_runs_offline_with_a_fake_model():
    model = _fake_model("Nothing to normalise.")
    agent = build_normalize_agent(model=model)

    result = agent.invoke(
        {"messages": [HumanMessage(content="Normalize the following candidate profile: {}")]}
    )

    assert result["messages"][0].type == "human"
    assert model.call_count == MODEL_CALL_LIMIT
    assert result.get("structured_response") is None


def test_system_prompt_sets_the_hr_role_and_the_canonical_rules():
    assert "HR assistant" in SYSTEM_PROMPT
    assert "'YYYY-MM'" in SYSTEM_PROMPT
    assert '"schemaVersion": "2"' in SYSTEM_PROMPT
    assert "Never invent" in SYSTEM_PROMPT
    assert "no UUIDs" in SYSTEM_PROMPT
    assert '"summary"' in SYSTEM_PROMPT
    assert "origin \"inferred\"" in SYSTEM_PROMPT
    assert "certifications[]" in SYSTEM_PROMPT
    assert NormalizedProfile.model_json_schema()["title"] == "NormalizedProfile"


def test_render_system_prompt_without_context_is_the_default_prompt():
    assert render_system_prompt(None) == SYSTEM_PROMPT


def test_render_system_prompt_injects_the_reference_lists():
    context = ReferenceContext(
        languages=["Arabic", "French"],
        degrees=["Bachelor's degree"],
        study_fields=["Computer Science"],
        skills={"Software": ["Microsoft Excel"], "Programming Languages": ["Java", "Python"]},
    )

    prompt = render_system_prompt(context)

    assert "Reference lists (the platform database is the source of truth)" in prompt
    assert "- Languages: Arabic, French" in prompt
    assert "* Programming Languages: Java, Python" in prompt
    assert "'Français' -> 'French'" in prompt
    assert prompt.index("Software: Microsoft Excel") < prompt.index("Example of the expected result")


def test_build_normalize_agent_accepts_a_reference_context():
    agent = build_normalize_agent(model=_fake_model(), context=ReferenceContext(languages=["French"]))

    assert type(agent).__name__ == "CompiledStateGraph"
