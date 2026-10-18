"""Matching agent graph and prompt — compiled locally with a fake model, no LLM call."""

import json

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.graphs.matching_agent import (
    MODEL_CALL_LIMIT,
    PROMPT_EXAMPLE,
    SYSTEM_PROMPT,
    build_matching_agent,
)
from app.graphs.matching_policy import POLICY_RULES, POLICY_VERSION
from app.schemas.matching import MatchingAnalysis


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


def test_agent_compiles_into_a_structured_loop_without_checkpointer():
    agent = build_matching_agent(model=_fake_model())

    assert type(agent).__name__ == "CompiledStateGraph"
    assert set(agent.nodes) == {
        "__start__",
        "model",
        "ModelCallLimitMiddleware.before_model",
        "ModelCallLimitMiddleware.after_model",
    }
    assert "structured_response" in agent.stream_channels
    assert agent.checkpointer is None


def test_agent_loop_ends_cleanly_at_the_call_limit_offline():
    model = _fake_model("I cannot score this.")
    agent = build_matching_agent(model=model)

    result = agent.invoke({"messages": [HumanMessage(content="Score: {}")]})

    assert model.call_count == MODEL_CALL_LIMIT
    assert result.get("structured_response") is None


def test_prompt_carries_the_contract_and_the_relevant_experience_rule():
    assert "exactly one assessment per criterion" in SYSTEM_PROMPT
    assert "Score 0 when the candidate sheet does not show the criterion" in SYSTEM_PROMPT
    assert "Never use the candidate's\n  yearsOfExperience as is" in SYSTEM_PROMPT
    assert "Count overlapping periods\n  once" in SYSTEM_PROMPT
    assert "never\n  recommend hiring or rejecting" in SYSTEM_PROMPT
    assert "never weigh criteria" in SYSTEM_PROMPT


def test_prompt_embeds_the_replaceable_policy_between_rules_and_example():
    assert POLICY_VERSION
    assert POLICY_RULES in SYSTEM_PROMPT
    assert SYSTEM_PROMPT.index(POLICY_RULES) < SYSTEM_PROMPT.index(PROMPT_EXAMPLE)


def test_prompt_example_matches_the_output_schema():
    payload = json.loads(PROMPT_EXAMPLE[PROMPT_EXAMPLE.index("{") : PROMPT_EXAMPLE.rindex("}") + 1])

    analysis = MatchingAnalysis.model_validate(payload)

    assert [assessment.criterion_key for assessment in analysis.assessments] == [
        "skill:java",
        "experience:total",
        "language:german",
    ]
    zero = analysis.assessments[2]
    assert zero.score == 0
    assert zero.evidence == []
