"""Clarification agent graph and prompt — compiled locally with a fake model, no LLM call."""

import json

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.graphs.matching_clarify_agent import (
    CLARIFY_EXAMPLE,
    CLARIFY_PROMPT_RULES,
    CLARIFY_SYSTEM_PROMPT,
    MODEL_CALL_LIMIT,
    build_matching_clarify_agent,
)
from app.schemas.matching import ClarificationQuestion, ClarificationSuggestion


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
    agent = build_matching_clarify_agent(model=_fake_model())

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
    model = _fake_model("I have no question.")
    agent = build_matching_clarify_agent(model=model)

    result = agent.invoke({"messages": [HumanMessage(content="Clarify: {}")]})

    assert model.call_count == MODEL_CALL_LIMIT
    assert result.get("structured_response") is None


def test_system_prompt_is_the_rules_then_the_example():
    assert CLARIFY_SYSTEM_PROMPT == "\n\n".join((CLARIFY_PROMPT_RULES, CLARIFY_EXAMPLE))


def test_prompt_carries_the_one_question_contract_and_the_forbidden_topics():
    assert CLARIFY_PROMPT_RULES.startswith(
        "You are a senior technical recruiter working for LinQOrbit, a\nrecruitment platform."
    )
    assert "- Ask ONE question at a time, never a list." in CLARIFY_PROMPT_RULES
    assert "including a question the candidate skipped: a skip means move on to another\n  gap." in CLARIFY_PROMPT_RULES
    assert "Keep it under 40\n  words." in CLARIFY_PROMPT_RULES
    assert "Keep it under 60 words. Never mention scores,\n  weights, the assessment rationale" in CLARIFY_PROMPT_RULES
    assert "Never ask about protected or sensitive characteristics: age, date of birth," in CLARIFY_PROMPT_RULES
    assert "Never ask for salary expectations" in CLARIFY_PROMPT_RULES
    assert CLARIFY_PROMPT_RULES.endswith(
        "- If no valuable question remains, or the remaining budget is 0, return no\n  question (null)."
    )


def test_example_outputs_are_complete_suggestions_of_the_output_schema():
    # TD-059 : l'exemple positif est le wrapper complet {"question": {...}} — même forme que la sortie
    # structurée ; on le lit en entier (raw_decode), jamais jusqu'au premier « } ».
    positive, null_case = CLARIFY_EXAMPLE.split("No question left:")
    decoder = json.JSONDecoder()
    question_wrapper, _ = decoder.raw_decode(positive[positive.index("{") :])
    null_wrapper, _ = decoder.raw_decode(null_case[null_case.index("{") :])

    suggestion = ClarificationSuggestion.model_validate_json(json.dumps(question_wrapper))
    assert isinstance(suggestion.question, ClarificationQuestion)
    assert suggestion.question.question.startswith("The offer requires 5 years of backend development")
    assert suggestion.question.rationale.startswith("Relevant experience is the main gap")
    assert ClarificationSuggestion.model_validate_json(json.dumps(null_wrapper)).question is None


def test_example_is_the_nested_wrapper_never_a_flat_question():
    positive = CLARIFY_EXAMPLE.split("No question left:")[0]
    wrapper, _ = json.JSONDecoder().raw_decode(positive[positive.index("{") :])

    assert set(wrapper) == {"question"}
    assert set(wrapper["question"]) == {"question", "rationale"}


def test_clarify_agent_keeps_the_provider_default_sampling(monkeypatch):
    requested = []
    monkeypatch.setattr(
        "app.graphs.matching_clarify_agent.get_model", lambda **kwargs: requested.append(kwargs) or object()
    )
    monkeypatch.setattr("app.graphs.matching_clarify_agent.create_agent", lambda **kwargs: kwargs)

    build_matching_clarify_agent()

    # Température 0 réservée au matching : la clarification ne demande aucune température.
    assert requested == [{}]


def test_clarify_prompt_never_asks_about_education():
    # D68: education is scored from the candidate sheet only; a clarification can never change it.
    assert "an unclear degree or field" not in CLARIFY_PROMPT_RULES
    assert (
        "- Education is scored from the candidate sheet only: a clarification can never\n"
        "  change it. Never ask about a degree, a diploma or a field of study.\n" in CLARIFY_PROMPT_RULES
    )
