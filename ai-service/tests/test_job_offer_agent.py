"""Agent graph construction — compiled locally with a fake model, no LLM call."""

import json

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.graphs.job_offer_normalize_agent import (
    MODEL_CALL_LIMIT,
    PROMPT_EXAMPLE,
    SYSTEM_PROMPT,
    build_job_offer_normalize_agent,
    render_system_prompt,
)
from app.schemas.cv import ReferenceContext
from app.schemas.job_offer import NormalizedJobOffer


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
    agent = build_job_offer_normalize_agent(model=_fake_model())

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
    agent = build_job_offer_normalize_agent(model=model)

    result = agent.invoke(
        {"messages": [HumanMessage(content="Normalize the following job offer: {}")]}
    )

    assert result["messages"][0].type == "human"
    assert model.call_count == MODEL_CALL_LIMIT
    assert result.get("structured_response") is None


def test_system_prompt_sets_the_hr_role_and_the_canonical_rules():
    assert "HR assistant" in SYSTEM_PROMPT
    assert '"schemaVersion": "2"' in SYSTEM_PROMPT
    assert "Never invent" in SYSTEM_PROMPT
    assert "no UUIDs" in SYSTEM_PROMPT
    assert '"summary"' in SYSTEM_PROMPT
    assert "never reclassify" in SYSTEM_PROMPT
    assert "requiredSkills" in SYSTEM_PROMPT
    assert "preferredSkills" in SYSTEM_PROMPT
    assert "permanent, fixed_term, freelance" in SYSTEM_PROMPT
    assert "remote, hybrid, on_site" in SYSTEM_PROMPT
    assert NormalizedJobOffer.model_json_schema()["title"] == "NormalizedJobOffer"


def test_system_prompt_teaches_weights_and_mined_requirements():
    """v2: every criterion is weighed, declared values are never overwritten."""
    assert "weight 1-5" in SYSTEM_PROMPT
    assert "keeps the recruiter's" in SYSTEM_PROMPT
    assert "minYearsSource" in SYSTEM_PROMPT
    assert "requiredYearsSource" in SYSTEM_PROMPT
    assert "never overwrite it" in SYSTEM_PROMPT
    assert "certifications[]" in SYSTEM_PROMPT
    assert 'carries origin: "declared"' in SYSTEM_PROMPT
    assert "when a text of the offer names it" in SYSTEM_PROMPT


def test_render_system_prompt_without_context_is_the_default_prompt():
    assert render_system_prompt(None) == SYSTEM_PROMPT


def test_system_prompt_mines_the_mined_sections_and_maps_stored_labels():
    # The mined sections are the mission, not an invention (never a bare
    # "don't create responsibilities" that would empty the sheet).
    assert "responsibilities, benefits, summary, alternateTitles" in SYSTEM_PROMPT
    assert "mining them is the mission" in SYSTEM_PROMPT
    # Stored labels carry the recruiter's choice: mapped, not re-guessed.
    assert "contractTypeLabel, employmentTypeLabel and workModeLabel" in SYSTEM_PROMPT
    assert "'Fixed-term' -> fixed_term" in SYSTEM_PROMPT
    assert "source 'responsibility'" in SYSTEM_PROMPT


def test_prompt_example_matches_the_output_schema():
    # Golden test: the example is part of the prompt the model sees — it must
    # stay a valid NormalizedJobOffer or it would teach a wrong shape.
    payload = json.loads(PROMPT_EXAMPLE[PROMPT_EXAMPLE.index("{") : PROMPT_EXAMPLE.rindex("}") + 1])

    offer = NormalizedJobOffer.model_validate(payload)

    assert offer.schema_version == "2"
    assert offer.responsibilities[0].importance == "mandatory"
    assert offer.responsibilities[0].weight == 5
    assert offer.required_skills[0].weight == 5
    assert offer.required_skills[0].min_years_source == "declared"
    assert offer.required_years == 5
    assert offer.required_years_source == "inferred"
    assert offer.required_degrees[0].source == "inferred"
    assert offer.languages[1].origin == "inferred"
    assert offer.certifications[0].name == "AWS Solutions Architect"
    assert offer.required_skills[0].evidence[0].source == "responsibility"


def test_render_system_prompt_injects_the_reference_lists():
    context = ReferenceContext(
        languages=["Arabic", "French"],
        skills={"Software": ["Microsoft Excel"], "Programming Languages": ["Java", "Python"]},
    )

    prompt = render_system_prompt(context)

    assert "Reference lists (the platform database is the source of truth)" in prompt
    assert "- Languages: Arabic, French" in prompt
    assert "* Programming Languages: Java, Python" in prompt
    assert "'Français' -> 'French'" in prompt
    assert prompt.index("Software: Microsoft Excel") < prompt.index("Example of the expected result")


def test_build_job_offer_normalize_agent_accepts_a_reference_context():
    agent = build_job_offer_normalize_agent(
        model=_fake_model(), context=ReferenceContext(languages=["French"])
    )

    assert type(agent).__name__ == "CompiledStateGraph"
