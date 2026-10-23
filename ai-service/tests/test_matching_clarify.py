"""Clarification pipeline: budget, orchestration and repair turn. The agent is stubbed."""

import json
import logging

import pytest
from langchain.agents.structured_output import StructuredOutputValidationError
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.errors import GraphRecursionError
from pydantic import ValidationError

from app.agents.matching_clarify import (
    NO_OUTPUT_MESSAGE,
    RECURSION_LIMIT,
    RUN_NAME,
    MatchingClarifyError,
    clarify_matching,
)
from app.schemas.matching import ClarificationSuggestion, MatchingClarifyRequest


class StubAgent:
    """Stand-in for the compiled graph: records calls, replays canned results."""

    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    def invoke(self, payload, config):
        self.calls.append({"payload": payload, "config": config})
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


ANSWERED = {"question": "Java backend?", "rationale": "Why.", "answer": "Yes, SECRET-ANSWER.", "status": "answered"}
SKIPPED = {"question": "Kubernetes?", "rationale": "Why.", "status": "skipped"}


def _request(remaining: int = 2, keys=("skill:java", "experience:total"), clarifications=()) -> MatchingClarifyRequest:
    return MatchingClarifyRequest(
        matching_id="m-42",
        candidate={"schemaVersion": "3", "bio": "SECRET-BIO"},
        offer={"schemaVersion": "2"},
        criteria=[{"key": key, "section": "required_skills", "label": key} for key in keys],
        assessments=[{"criterion_key": key, "score": 0, "rationale": "Not shown."} for key in keys],
        clarifications=list(clarifications),
        remaining_questions=remaining,
    )


def _question() -> ClarificationSuggestion:
    return ClarificationSuggestion(
        question={"question": "Could you describe your Java backend work?", "rationale": "Java is required."}
    )


def _install(monkeypatch, stub):
    monkeypatch.setattr("app.agents.matching_clarify.build_matching_clarify_agent", lambda **_: stub)


def test_returns_the_suggested_question(monkeypatch):
    stub = StubAgent([{"structured_response": _question(), "messages": []}])
    _install(monkeypatch, stub)

    result = clarify_matching(_request())

    assert result.question.question == "Could you describe your Java backend work?"
    assert result.question.rationale == "Java is required."
    assert len(stub.calls) == 1


def test_returns_no_question_when_the_agent_finds_none(monkeypatch):
    stub = StubAgent([{"structured_response": ClarificationSuggestion(question=None), "messages": []}])
    _install(monkeypatch, stub)

    assert clarify_matching(_request()).question is None
    assert len(stub.calls) == 1


def test_no_question_left_returns_null_without_calling_the_agent(monkeypatch):
    stub = StubAgent([])
    _install(monkeypatch, stub)

    result = clarify_matching(_request(remaining=0))

    assert result.question is None
    assert stub.calls == []


def test_the_last_remaining_question_still_calls_the_agent(monkeypatch):
    stub = StubAgent([{"structured_response": _question(), "messages": []}])
    _install(monkeypatch, stub)

    assert clarify_matching(_request(remaining=1)).question is not None
    assert len(stub.calls) == 1


def test_empty_criteria_is_rejected_before_any_call(monkeypatch):
    stub = StubAgent([])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingClarifyError) as caught:
        clarify_matching(_request(keys=()))

    assert caught.value.code == "empty_criteria"
    assert stub.calls == []


def test_tags_the_run_as_the_matching_thread_and_keeps_the_recursion_backstop(monkeypatch):
    stub = StubAgent([{"structured_response": _question(), "messages": []}])
    _install(monkeypatch, stub)

    clarify_matching(_request())

    assert RUN_NAME == "matching-clarify"
    assert stub.calls[0]["config"] == {
        "recursion_limit": RECURSION_LIMIT,
        "run_name": RUN_NAME,
        "metadata": {"thread_id": "m-42"},
    }


def test_sends_the_whole_context_in_camel_case(monkeypatch):
    stub = StubAgent([{"structured_response": _question(), "messages": []}])
    _install(monkeypatch, stub)

    clarify_matching(_request(remaining=3, clarifications=[ANSWERED, SKIPPED]))

    content = stub.calls[0]["payload"]["messages"][0].content
    payload = json.loads(content[content.index("{") :])
    assert set(payload) == {"criteria", "offer", "candidate", "assessments", "clarifications", "remainingQuestions"}
    assert payload["remainingQuestions"] == 3
    assert payload["assessments"][0] == {
        "criterionKey": "skill:java",
        "score": 0,
        "rationale": "Not shown.",
        "evidence": [],
    }
    assert payload["clarifications"] == [ANSWERED, {**SKIPPED, "answer": None}]
    assert payload["candidate"]["schemaVersion"] == "3"
    assert "requirement" not in payload["criteria"][0]


def test_missing_output_gets_one_repair_turn_replaying_the_history(monkeypatch):
    history = [HumanMessage(content="first")]
    stub = StubAgent([
        {"structured_response": None, "messages": history},
        {"structured_response": _question(), "messages": []},
    ])
    _install(monkeypatch, stub)

    result = clarify_matching(_request())

    assert result.question is not None
    repair_messages = stub.calls[1]["payload"]["messages"]
    assert repair_messages[0] is history[0]
    assert "strictly following the schema" in repair_messages[-1].content
    assert stub.calls[1]["config"] == stub.calls[0]["config"]


def test_a_null_question_on_the_repair_turn_is_a_valid_answer(monkeypatch):
    stub = StubAgent([
        {"structured_response": None, "messages": []},
        {"structured_response": ClarificationSuggestion(), "messages": []},
    ])
    _install(monkeypatch, stub)

    assert clarify_matching(_request()).question is None


def _schema_rejection(rationale: str = "SECRET-RATIONALE") -> StructuredOutputValidationError:
    """The real agent error when Pydantic rejects the clarification output."""
    payload = {"question": {"question": "", "rationale": rationale}}
    with pytest.raises(ValidationError) as rejected:
        ClarificationSuggestion.model_validate(payload)
    source = ValueError(f"Failed to parse data to ClarificationSuggestion: {rejected.value}")
    source.__cause__ = rejected.value
    return StructuredOutputValidationError("ClarificationSuggestion", source, AIMessage(content=json.dumps(payload)))


def test_schema_rejection_gets_one_repair_turn_from_the_request(monkeypatch):
    stub = StubAgent([
        _schema_rejection(),
        {"structured_response": _question(), "messages": []},
    ])
    _install(monkeypatch, stub)

    result = clarify_matching(_request())

    assert result.question is not None
    assert len(stub.calls) == 2
    original = stub.calls[0]["payload"]["messages"][0]
    repair_messages = stub.calls[1]["payload"]["messages"]
    # The rejected AIMessage is never replayed: request + repair instruction.
    assert repair_messages[0] is original
    assert len(repair_messages) == 2
    assert all(isinstance(message, HumanMessage) for message in repair_messages)
    assert "strictly following the schema" in repair_messages[1].content
    assert stub.calls[1]["config"] == stub.calls[0]["config"]


def test_schema_rejection_on_the_repair_is_no_output(monkeypatch):
    stub = StubAgent([_schema_rejection(), _schema_rejection()])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingClarifyError) as caught:
        clarify_matching(_request())

    assert caught.value.code == "no_output"
    assert caught.value.message == NO_OUTPUT_MESSAGE
    assert len(stub.calls) == 2


@pytest.mark.parametrize(
    "second",
    [
        {"structured_response": None, "messages": []},
        GraphRecursionError("loop"),
    ],
)
def test_schema_rejection_then_a_failed_repair_is_no_output(monkeypatch, second):
    stub = StubAgent([_schema_rejection(), second])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingClarifyError) as caught:
        clarify_matching(_request())

    assert caught.value.code == "no_output"
    assert len(stub.calls) == 2


def test_schema_rejection_logs_the_type_never_the_rejected_content(monkeypatch, caplog):
    stub = StubAgent([
        _schema_rejection(rationale="SECRET-REJECTED-RATIONALE"),
        {"structured_response": _question(), "messages": []},
    ])
    _install(monkeypatch, stub)

    with caplog.at_level(logging.INFO, logger="app.agents.matching_clarify"):
        clarify_matching(_request())

    assert "error=StructuredOutputValidationError" in caplog.text
    assert "SECRET-REJECTED-RATIONALE" not in caplog.text
    assert "SECRET-BIO" not in caplog.text


def test_a_provider_failure_is_not_turned_into_a_repair(monkeypatch):
    stub = StubAgent([RuntimeError("provider down")])
    _install(monkeypatch, stub)

    with pytest.raises(RuntimeError, match="provider down"):
        clarify_matching(_request())

    assert len(stub.calls) == 1


@pytest.mark.parametrize(
    "second",
    [
        {"structured_response": None, "messages": []},
        GraphRecursionError("loop"),
    ],
)
def test_a_failed_repair_turn_is_no_output(monkeypatch, second):
    stub = StubAgent([{"structured_response": None, "messages": []}, second])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingClarifyError) as caught:
        clarify_matching(_request())

    assert caught.value.code == "no_output"
    assert len(stub.calls) == 2


def test_recursion_on_the_first_call_is_no_output(monkeypatch):
    stub = StubAgent([GraphRecursionError("loop")])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingClarifyError) as caught:
        clarify_matching(_request())

    assert caught.value.code == "no_output"
    assert len(stub.calls) == 1


def test_repair_logs_never_the_context(monkeypatch, caplog):
    stub = StubAgent([
        {"structured_response": None, "messages": []},
        {"structured_response": _question(), "messages": []},
    ])
    _install(monkeypatch, stub)

    with caplog.at_level(logging.INFO, logger="app.agents.matching_clarify"):
        clarify_matching(_request(clarifications=[ANSWERED]))

    assert "running repair turn" in caplog.text
    assert "repair turn recovered" in caplog.text
    assert "SECRET-BIO" not in caplog.text
    assert "SECRET-ANSWER" not in caplog.text
    assert "Java backend work" not in caplog.text
