"""Agent graph construction — compiled locally with a fake model, no LLM call."""

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.graphs.cv_agent import MODEL_CALL_LIMIT, SYSTEM_PROMPT, build_cv_agent, render_system_prompt
from app.schemas.cv import ParsedCv, ReferenceContext


class FakeBindableModel(GenericFakeChatModel):
    """Stands in for Gemini: records calls, never produces the structured output.

    create_agent calls bind_tools at run time even when no tools are bound, and
    every call must yield a *fresh* AIMessage — the same id twice would collapse
    in langgraph's add_messages reducer instead of appending.
    """

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


def test_agent_compiles_into_a_structured_extraction_loop():
    agent = build_cv_agent(model=_fake_model())

    assert type(agent).__name__ == "CompiledStateGraph"
    assert set(agent.nodes) == {
        "__start__",
        "model",
        "ModelCallLimitMiddleware.before_model",
        "ModelCallLimitMiddleware.after_model",
    }
    assert "structured_response" in agent.stream_channels


def test_agent_loop_runs_offline_with_a_fake_model():
    """The compiled loop executes without any network call and stops at the call limit."""
    model = _fake_model("Nothing more to extract.")
    agent = build_cv_agent(model=model)

    result = agent.invoke(
        {"messages": [HumanMessage(content="Extract the following CV: Camille, engineer at Acme.")]}
    )

    assert result["messages"][0].type == "human"
    # The fake never produced the structured output: the run ends at the model
    # call ceiling, which is exactly the case parse_cv handles with its repair turn.
    assert model.call_count == MODEL_CALL_LIMIT
    assert result.get("structured_response") is None


def test_system_prompt_sets_the_hr_role_and_the_output_format():
    assert "HR assistant" in SYSTEM_PROMPT
    assert '"startDate": "2021-03"' in SYSTEM_PROMPT
    assert "'YYYY-MM'" in SYSTEM_PROMPT
    assert '"summary"' in SYSTEM_PROMPT
    assert ParsedCv.model_json_schema()["title"] == "ParsedCv"


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
    assert "- Degrees: Bachelor's degree" in prompt
    assert "- Study fields: Computer Science" in prompt
    assert "* Programming Languages: Java, Python" in prompt
    assert "* Software: Microsoft Excel" in prompt
    # Canonicalisation rules ride along and the example stays last.
    assert "'Français' -> 'French'" in prompt
    assert prompt.index("Software: Microsoft Excel") < prompt.index("Example of the expected result")


def test_build_cv_agent_accepts_a_reference_context():
    agent = build_cv_agent(model=_fake_model(), context=ReferenceContext(languages=["French"]))

    assert type(agent).__name__ == "CompiledStateGraph"


def test_json_schema_exposes_camel_case_fields_to_the_model():
    """The schema sent to the LLM and the wire format share one casing."""
    schema = ParsedCv.model_json_schema()
    experience_props = schema["$defs"]["CvExperience"]["properties"]

    assert "startDate" in experience_props
    assert "start_date" not in experience_props
