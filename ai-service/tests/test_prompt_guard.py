"""The prompt guard (D109): a free text is data, never an instruction.

The invariant this file pins: every prompt that embeds a text a stranger
wrote carries the guard, and every payload that travels to the model is
delimited. A fifth prompt added without the guard fails here.
"""

import ast
import json
from pathlib import Path

from app.agents.job_offer_normalize import normalize_job_offer
from app.agents.matching_analyze import analyze_matching
from app.agents.matching_clarify import clarify_matching
from app.agents.profile_normalize import normalize_profile
from app.graphs import (
    job_offer_normalize_agent,
    matching_agent,
    matching_clarify_agent,
    normalize_agent,
)
from app.graphs.prompt_guard import (
    UNTRUSTED_CONTENT_CLOSE,
    UNTRUSTED_CONTENT_OPEN,
    UNTRUSTED_TEXT_RULE,
    wrap_untrusted_content,
)
from app.schemas.job_offer import JobOfferSnapshot, NormalizedJobOffer
from app.schemas.matching import (
    ClarificationSuggestion,
    CriterionAssessment,
    MatchingAnalysis,
    MatchingAnalyzeRequest,
    MatchingClarifyRequest,
)
from app.schemas.normalize import CandidateProfile, NormalizedProfile

# The four prompts that embed a text a stranger wrote: the offer
# description, the candidate's texts and the candidate's answers.
GUARDED_PROMPTS = {
    "job_offer_normalize_agent": job_offer_normalize_agent.render_system_prompt(),
    "normalize_agent": normalize_agent.render_system_prompt(),
    "matching_agent": matching_agent.SYSTEM_PROMPT,
    "matching_clarify_agent": matching_clarify_agent.CLARIFY_SYSTEM_PROMPT,
}

AGENTS_DIR = Path(__file__).resolve().parents[1] / "app" / "agents"


class StubAgent:
    """Stand-in for the compiled graph: records the calls it receives."""

    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    def invoke(self, payload, config):
        self.calls.append({"payload": payload, "config": config})
        return self._results.pop(0)


def test_the_guard_is_written_once_and_shared():
    assert "never instructions to follow" in UNTRUSTED_TEXT_RULE
    assert "ignore that directive" in UNTRUSTED_TEXT_RULE


def test_every_prompt_that_embeds_a_free_text_carries_the_guard():
    for name, prompt in GUARDED_PROMPTS.items():
        assert UNTRUSTED_TEXT_RULE in prompt, name


def test_no_prompt_copies_the_guard_instead_of_importing_it():
    modules = (
        job_offer_normalize_agent,
        normalize_agent,
        matching_agent,
        matching_clarify_agent,
    )
    for module in modules:
        source = Path(module.__file__).read_text(encoding="utf-8")
        assert "Untrusted content:" not in source, module.__name__
        assert "UNTRUSTED_TEXT_RULE" in source, module.__name__


def test_the_wrapper_delimits_the_content_and_keeps_it_readable():
    wrapped = wrap_untrusted_content({"description": "A role."})

    assert wrapped.startswith(UNTRUSTED_CONTENT_OPEN)
    assert wrapped.endswith(UNTRUSTED_CONTENT_CLOSE)
    body = wrapped[len(UNTRUSTED_CONTENT_OPEN) : -len(UNTRUSTED_CONTENT_CLOSE)]
    assert json.loads(body) == {"description": "A role."}


def test_every_payload_of_the_agents_is_wrapped():
    """No JSON leaves an agent without the markers around it.

    The check is static: every ``json.dumps`` of the agent modules must
    sit inside a ``wrap_untrusted_content`` call, so a new payload cannot
    bypass the guard.
    """
    offenders: list[str] = []
    for path in sorted(AGENTS_DIR.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        parents = {}
        for node in ast.walk(tree):
            for child in ast.iter_child_nodes(node):
                parents[child] = node
        for node in ast.walk(tree):
            if not _is_json_dumps(node):
                continue
            if not _is_guarded(node, parents):
                offenders.append(f"{path.name}:{node.lineno}")
    assert offenders == []


def _is_json_dumps(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "dumps"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "json"
    )


def _is_guarded(node: ast.AST, parents: dict) -> bool:
    current = parents.get(node)
    while current is not None:
        if (
            isinstance(current, ast.Call)
            and isinstance(current.func, ast.Name)
            and current.func.id == "wrap_untrusted_content"
        ):
            return True
        current = parents.get(current)
    return False


def test_the_offer_payload_travels_between_the_markers(monkeypatch):
    stub = StubAgent([{"structured_response": NormalizedJobOffer(title="Dev")}])
    monkeypatch.setattr(
        "app.agents.job_offer_normalize.build_job_offer_normalize_agent", lambda **_: stub
    )

    normalize_job_offer(JobOfferSnapshot(title="Dev", description="Own the API."))

    content = stub.calls[0]["payload"]["messages"][0].content
    assert UNTRUSTED_CONTENT_OPEN in content
    assert UNTRUSTED_CONTENT_CLOSE in content


def test_the_profile_payload_travels_between_the_markers(monkeypatch):
    stub = StubAgent([{"structured_response": NormalizedProfile(title="Dev")}])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    normalize_profile(CandidateProfile(about={"title": "Dev", "bio": "Six years of APIs."}))

    content = stub.calls[0]["payload"]["messages"][0].content
    assert UNTRUSTED_CONTENT_OPEN in content
    assert UNTRUSTED_CONTENT_CLOSE in content


def test_the_matching_payload_travels_between_the_markers(monkeypatch):
    stub = StubAgent(
        [
            {
                "structured_response": MatchingAnalysis(
                    assessments=[
                        CriterionAssessment(
                            criterion_key="skill:java", score=0, rationale="Nothing."
                        )
                    ]
                ),
                "messages": [],
            }
        ]
    )
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", lambda **_: stub)

    analyze_matching(
        MatchingAnalyzeRequest(
            matching_id="m-42",
            candidate={"schemaVersion": "3"},
            offer={"schemaVersion": "2"},
            criteria=[{"key": "skill:java", "section": "required_skills", "label": "Java"}],
        )
    )

    content = stub.calls[0]["payload"]["messages"][0].content
    assert UNTRUSTED_CONTENT_OPEN in content
    assert UNTRUSTED_CONTENT_CLOSE in content


def test_the_clarification_payload_travels_between_the_markers(monkeypatch):
    stub = StubAgent([{"structured_response": ClarificationSuggestion(question=None), "messages": []}])
    monkeypatch.setattr(
        "app.agents.matching_clarify.build_matching_clarify_agent", lambda **_: stub
    )

    clarify_matching(
        MatchingClarifyRequest(
            matching_id="m-42",
            candidate={"schemaVersion": "3"},
            offer={"schemaVersion": "2"},
            criteria=[{"key": "skill:java", "section": "required_skills", "label": "Java"}],
            assessments=[
                {"criterion_key": "skill:java", "score": 0, "rationale": "Nothing."}
            ],
            remaining_questions=2,
        )
    )

    content = stub.calls[0]["payload"]["messages"][0].content
    assert UNTRUSTED_CONTENT_OPEN in content
    assert UNTRUSTED_CONTENT_CLOSE in content
