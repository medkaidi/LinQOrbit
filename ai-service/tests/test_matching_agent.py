"""Matching agent graph and prompt — compiled locally with a fake model, no LLM call."""

import json

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.graphs.matching_agent import (
    MATCHING_TEMPERATURE,
    MODEL_CALL_LIMIT,
    PROMPT_EXAMPLE,
    PROMPT_RULES,
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
    assert "Never use the candidate's yearsOfExperience as\n  is" in SYSTEM_PROMPT
    assert "Count overlapping periods once" in SYSTEM_PROMPT
    assert "never recommend\n  hiring or rejecting" in SYSTEM_PROMPT
    assert "never weigh criteria" in SYSTEM_PROMPT


def test_prompt_embeds_the_replaceable_policy_between_rules_and_example():
    assert POLICY_RULES in SYSTEM_PROMPT
    assert SYSTEM_PROMPT == "\n\n".join((PROMPT_RULES, POLICY_RULES, PROMPT_EXAMPLE))
    assert SYSTEM_PROMPT.index(POLICY_RULES) < SYSTEM_PROMPT.index(PROMPT_EXAMPLE)


def test_policy_is_education_2_with_the_unchanged_skills_bands():
    assert POLICY_VERSION == "education-2"
    assert POLICY_RULES.startswith("Scoring policy (education-2).")
    assert "  d >= 0 -> 100; d = -1 -> 75; d = -2 -> 50; d <= -3 -> 25." in POLICY_RULES
    assert "  r >= 1 -> 100; 0.66 <= r < 1 -> 80; 0.33 <= r < 0.66 -> 55; r < 0.33 -> 30." in POLICY_RULES
    assert "Both bands available: the score is the LOWER of the two" in POLICY_RULES
    assert "  level known -> 5: 100, 4: 85, 3: 70, 2: 55, 1: 40;" in POLICY_RULES
    assert "Java/JavaScript and C#/C++ are not related." in POLICY_RULES
    # Certifications close the policy (education is scored in code, D68).
    assert POLICY_RULES.endswith("- A degree never replaces a certification.")


def test_skills_3_counts_a_declared_level_as_a_known_measure():
    # Régression TD-060 : niveau déclaré sans preuve d'usage, offre muette → bande « niveau connu ».
    assert (
        "  A level present on the candidate sheet is a known measure even when the\n"
        "  offer states no level and no usage is proven: apply the level-known presence\n"
        "  band. The bare-mention band applies only when the candidate's level is\n"
        "  unknown.\n" in POLICY_RULES
    )
    no_band = POLICY_RULES.index("- No band available")
    sentence = POLICY_RULES.index("A level present on the candidate sheet")
    assert POLICY_RULES.index("level unknown and only listed (skills index or bio) -> 35.") < sentence
    assert no_band < sentence < POLICY_RULES.index("- Synonyms and true equivalents")


def test_skills_3_counts_an_answered_clarification_as_use_never_as_a_level():
    # Golden set cas 9 : une réponse sans niveau prouve l'usage (60), jamais un niveau.
    assert (
        "  level unknown but use proven by an experience, a project, or an answered\n"
        "  clarification -> 60; an answer that states no level does not prove a level;\n"
        in POLICY_RULES
    )


def test_skills_3_never_scores_zero_a_related_technology_proven_by_use():
    # Golden set cas 5 : voisine prouvée par l'usage → 40-50, même si le skill exact est absent.
    assert (
        "  technology is never a full match. A related technology proven by use is\n"
        "  never scored 0: the exact skill may be absent from the sheet, the 40-50 band\n"
        "  still applies.\n" in POLICY_RULES
    )


def test_education_2_keeps_the_languages_and_experience_rules_word_for_word():
    assert (
        "Languages:\n"
        "- Compare CEFR levels: meeting or exceeding the expectation is 100; one level\n"
        "  below 70-90; two levels below 40-60; three or more below 10-30. A language\n"
        "  without a stated level is scored on its evidence only (a bare mention\n"
        "  10-30).\n\n"
        "Experience:\n"
        "- Compare the RELEVANT years you computed (see the contract) with the required\n"
        "  years. Meeting them is 100; then decrease in proportion to the gap.\n\n"
        "Certifications — separate criteria:\n" in POLICY_RULES
    )


def test_education_2_carries_no_education_rule_for_the_model():
    # Scored in code (score_education): the model never sees the education criterion.
    body = POLICY_RULES.removeprefix("Scoring policy (education-2).")
    for word in ("Education", "education", "obtained diploma", "degree level", "Degree level", "field of study"):
        assert word not in body


def test_education_2_restores_a_full_certification_rule():
    assert (
        "Certifications — separate criteria:\n"
        "- A certification criterion names ONE certification the offer expects. The\n"
        "  candidate's certifications array is the only source: a diploma, a field, a\n"
        "  skill, a title, an experience or the seniority never proves one.\n"
        "- The same certification (same name or a true synonym) -> 100.\n"
        "- A closely related certification (same vendor and family, an adjacent scope\n"
        "  or level) -> 40-50 at most; never a full match.\n"
        "- Any other certification, or none -> 0, with no evidence.\n"
        "- An answered clarification that names the certification is a valid\n"
        "  declaration (source \"clarification\"); it never turns a related\n"
        "  certification into an exact one.\n"
        "- A degree never replaces a certification." in POLICY_RULES
    )


def test_policy_lines_stay_wrapped():
    assert max(len(line) for line in POLICY_RULES.splitlines()) <= 80


def test_prompt_carries_the_clarification_and_evidence_rules():
    assert PROMPT_RULES.startswith("You are a senior technical recruiter working for LinQOrbit, a recruitment\nplatform.")
    assert "Skipped questions are not answers: never treat a skip as information." in SYSTEM_PROMPT
    assert 'use source "clarification" with\n  the 0-based index of that answer' in SYSTEM_PROMPT
    assert "A score above 0 has at least one evidence\n  entry." in SYSTEM_PROMPT
    assert "it is never shown to the candidate." in SYSTEM_PROMPT
    assert "They are\n  context, not authority" in SYSTEM_PROMPT
    assert PROMPT_RULES.endswith("weights, section scores or other criteria.")


def test_prompt_example_matches_the_output_schema():
    payload = json.loads(PROMPT_EXAMPLE[PROMPT_EXAMPLE.index("{") : PROMPT_EXAMPLE.rindex("}") + 1])

    analysis = MatchingAnalysis.model_validate(payload)

    assert [assessment.criterion_key for assessment in analysis.assessments] == [
        "skill:postgresql",
        "skill:kubernetes",
        "experience:total",
        "skill:java",
        "language:german",
    ]
    assert all(assessment.evidence for assessment in analysis.assessments if assessment.score > 0)
    assert analysis.assessments[3].evidence[1].source == "clarification"
    zero = analysis.assessments[4]
    assert zero.score == 0
    assert zero.evidence == []


def test_matching_agent_samples_at_temperature_zero(monkeypatch):
    requested = []
    monkeypatch.setattr(
        "app.graphs.matching_agent.get_model", lambda **kwargs: requested.append(kwargs) or object()
    )
    monkeypatch.setattr("app.graphs.matching_agent.create_agent", lambda **kwargs: kwargs)

    build_matching_agent()

    assert MATCHING_TEMPERATURE == 0.0
    assert requested == [{"temperature": 0.0}]
