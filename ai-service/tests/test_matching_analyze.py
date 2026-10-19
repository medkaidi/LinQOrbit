"""Matching pipeline: orchestration, coverage check and repair turn. The agent is stubbed."""

import json
import logging

import pytest
from langchain.agents.structured_output import MultipleStructuredOutputsError, StructuredOutputValidationError
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.errors import GraphRecursionError
from pydantic import ValidationError

from app.agents.matching_analyze import (
    NO_OUTPUT_MESSAGE,
    RECURSION_LIMIT,
    RUN_NAME,
    MatchingAnalyzeError,
    analyze_matching,
    clarification_gaps,
    coverage_gaps,
    evidence_gaps,
)
from app.graphs.matching_policy import POLICY_VERSION
from app.schemas.matching import SCHEMA_VERSION, MatchingAnalysis, MatchingAnalyzeRequest


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


def _request(*keys: str) -> MatchingAnalyzeRequest:
    return MatchingAnalyzeRequest(
        matching_id="m-42",
        candidate={"schemaVersion": "3"},
        offer={"schemaVersion": "2"},
        criteria=[{"key": key, "section": "required_skills", "label": key} for key in keys],
    )


def _analysis(*keys: str) -> MatchingAnalysis:
    return MatchingAnalysis(
        assessments=[
            {"criterion_key": key, "score": 50, "rationale": "Partly shown.", "evidence": [{"source": "bio"}]}
            for key in keys
        ]
    )


def _install(monkeypatch, stub):
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", lambda **_: stub)


def test_returns_the_analysis_stamped_with_schema_and_policy_versions(monkeypatch):
    stub = StubAgent([{"structured_response": _analysis("a", "b"), "messages": []}])
    _install(monkeypatch, stub)

    result = analyze_matching(_request("a", "b"))

    assert result.schema_version == SCHEMA_VERSION
    assert result.policy_version == POLICY_VERSION
    assert len(stub.calls) == 1


def test_tags_the_run_as_a_thread_and_keeps_the_recursion_backstop(monkeypatch):
    stub = StubAgent([{"structured_response": _analysis("a"), "messages": []}])
    _install(monkeypatch, stub)

    analyze_matching(_request("a"))

    assert stub.calls[0]["config"] == {
        "recursion_limit": RECURSION_LIMIT,
        "run_name": RUN_NAME,
        "metadata": {"thread_id": "m-42"},
    }


def test_sends_the_whole_context_in_the_first_message(monkeypatch):
    stub = StubAgent([{"structured_response": _analysis("a"), "messages": []}])
    _install(monkeypatch, stub)

    analyze_matching(_request("a"))

    content = stub.calls[0]["payload"]["messages"][0].content
    assert '"criteria"' in content and '"offer"' in content and '"candidate"' in content
    assert '"schemaVersion": "3"' in content


def test_empty_criteria_is_rejected_before_any_call(monkeypatch):
    stub = StubAgent([])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request())

    assert caught.value.code == "empty_criteria"
    assert stub.calls == []


def test_missing_output_gets_one_repair_turn_replaying_the_history(monkeypatch):
    history = [HumanMessage(content="first")]
    stub = StubAgent([
        {"structured_response": None, "messages": history},
        {"structured_response": _analysis("a"), "messages": []},
    ])
    _install(monkeypatch, stub)

    result = analyze_matching(_request("a"))

    assert result.assessments[0].criterion_key == "a"
    repair_messages = stub.calls[1]["payload"]["messages"]
    assert repair_messages[0] is history[0]
    assert "strictly following the schema" in repair_messages[-1].content


def test_wrong_coverage_gets_a_repair_turn_naming_the_keys(monkeypatch):
    stub = StubAgent([
        {"structured_response": _analysis("a", "zzz"), "messages": []},
        {"structured_response": _analysis("a", "b"), "messages": []},
    ])
    _install(monkeypatch, stub)

    result = analyze_matching(_request("a", "b"))

    assert {assessment.criterion_key for assessment in result.assessments} == {"a", "b"}
    instruction = stub.calls[1]["payload"]["messages"][-1].content
    assert "Missing criterion keys: b." in instruction
    assert "zzz" in instruction


@pytest.mark.parametrize(
    "second",
    [
        {"structured_response": None, "messages": []},
        {"structured_response": _analysis("a"), "messages": []},
        GraphRecursionError("loop"),
    ],
)
def test_a_failed_repair_turn_is_no_output(monkeypatch, second):
    stub = StubAgent([{"structured_response": None, "messages": []}, second])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request("a", "b"))

    assert caught.value.code == "no_output"
    assert len(stub.calls) == 2


def test_recursion_on_the_first_call_is_no_output(monkeypatch):
    stub = StubAgent([GraphRecursionError("loop")])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request("a"))

    assert caught.value.code == "no_output"


def test_coverage_gaps_lists_missing_in_request_order_and_extra_sorted():
    missing, unexpected = coverage_gaps(_analysis("c", "y", "x"), _request("a", "b", "c"))

    assert missing == ["a", "b"]
    assert unexpected == ["x", "y"]


def _with_evidence(key: str, source: str, index: int | None) -> MatchingAnalysis:
    evidence = [{"source": source} if index is None else {"source": source, "index": index}]
    return MatchingAnalysis(
        assessments=[{"criterion_key": key, "score": 70, "rationale": "Shown.", "evidence": evidence}]
    )


def _request_with_sheet(sheet: dict, *keys: str) -> MatchingAnalyzeRequest:
    return MatchingAnalyzeRequest(
        matching_id="m-42",
        candidate={"schemaVersion": "3", **sheet},
        offer={"schemaVersion": "2"},
        criteria=[{"key": key, "section": "required_skills", "label": key} for key in keys],
    )


def test_evidence_gaps_flags_indexes_outside_the_candidate_sheet():
    request = _request_with_sheet({"experiences": [{}, {}], "skills": [{}]}, "a")

    assert evidence_gaps(_with_evidence("a", "experience", 1), request.candidate) == []
    assert evidence_gaps(_with_evidence("a", "bio", None), request.candidate) == []
    assert evidence_gaps(_with_evidence("a", "experience", 2), request.candidate) == ["a -> experience[2]"]
    # Missing or malformed array: no entry exists.
    assert evidence_gaps(_with_evidence("a", "project", 0), request.candidate) == ["a -> project[0]"]
    bad_array = _request_with_sheet({"languages": "English"}, "a")
    assert evidence_gaps(_with_evidence("a", "language", 0), bad_array.candidate) == ["a -> language[0]"]


def test_out_of_range_evidence_gets_a_repair_turn_naming_it(monkeypatch):
    request = _request_with_sheet({"experiences": [{}]}, "a")
    stub = StubAgent([
        {"structured_response": _with_evidence("a", "experience", 5), "messages": []},
        {"structured_response": _with_evidence("a", "experience", 0), "messages": []},
    ])
    _install(monkeypatch, stub)

    result = analyze_matching(request)

    assert result.assessments[0].evidence[0].index == 0
    instruction = stub.calls[1]["payload"]["messages"][-1].content
    assert "do not exist in the candidate sheet" in instruction
    assert "a -> experience[5]" in instruction
    assert "Missing criterion keys" not in instruction


def test_evidence_still_out_of_range_after_the_repair_is_no_output(monkeypatch):
    request = _request_with_sheet({"experiences": []}, "a")
    stub = StubAgent([
        {"structured_response": _with_evidence("a", "experience", 0), "messages": []},
        {"structured_response": _with_evidence("a", "experience", 0), "messages": []},
    ])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(request)

    assert caught.value.code == "no_output"


def test_wrong_coverage_then_no_output_on_the_repair_is_no_output(monkeypatch):
    stub = StubAgent([
        {"structured_response": _analysis("a"), "messages": []},
        {"structured_response": None, "messages": []},
    ])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request("a", "b"))

    assert caught.value.code == "no_output"


def test_wrong_coverage_still_wrong_after_the_repair_is_no_output(monkeypatch):
    stub = StubAgent([
        {"structured_response": _analysis("a"), "messages": []},
        {"structured_response": _analysis("a", "zzz"), "messages": []},
    ])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request("a", "b"))

    assert caught.value.code == "no_output"


def test_repair_message_mentions_only_the_kind_of_gap_found(monkeypatch):
    only_missing = StubAgent([
        {"structured_response": _analysis("a"), "messages": []},
        {"structured_response": _analysis("a", "b"), "messages": []},
    ])
    _install(monkeypatch, only_missing)
    analyze_matching(_request("a", "b"))
    instruction = only_missing.calls[1]["payload"]["messages"][-1].content
    assert "Missing criterion keys: b." in instruction
    assert "not criteria" not in instruction

    only_extra = StubAgent([
        {"structured_response": _analysis("a", "zzz"), "messages": []},
        {"structured_response": _analysis("a"), "messages": []},
    ])
    _install(monkeypatch, only_extra)
    analyze_matching(_request("a"))
    instruction = only_extra.calls[1]["payload"]["messages"][-1].content
    assert "zzz" in instruction
    assert "Missing" not in instruction


def test_the_repair_turn_replays_the_history_with_the_same_config(monkeypatch):
    history = [HumanMessage(content="first"), HumanMessage(content="second")]
    stub = StubAgent([
        {"structured_response": _analysis("a", "zzz"), "messages": history},
        {"structured_response": _analysis("a"), "messages": []},
    ])
    _install(monkeypatch, stub)

    analyze_matching(_request("a"))

    repair_messages = stub.calls[1]["payload"]["messages"]
    assert repair_messages[:2] == history
    assert stub.calls[1]["config"] == stub.calls[0]["config"]


def test_versions_set_by_the_model_are_overwritten(monkeypatch):
    analysis = _analysis("a")
    analysis.schema_version = "99"
    analysis.policy_version = "made-up"
    stub = StubAgent([{"structured_response": analysis, "messages": []}])
    _install(monkeypatch, stub)

    result = analyze_matching(_request("a"))

    assert result.schema_version == SCHEMA_VERSION
    assert result.policy_version == POLICY_VERSION


def test_an_absent_requirement_is_not_sent_to_the_agent(monkeypatch):
    stub = StubAgent([{"structured_response": _analysis("a"), "messages": []}])
    _install(monkeypatch, stub)

    analyze_matching(_request("a"))

    assert '"requirement"' not in stub.calls[0]["payload"]["messages"][0].content


def test_repair_logs_counts_only_never_the_sheets(monkeypatch, caplog):
    request = _request_with_sheet({"bio": "SECRET-BIO", "experiences": []}, "a", "b")
    stub = StubAgent([
        {"structured_response": _analysis("a"), "messages": []},
        {"structured_response": _analysis("a", "b"), "messages": []},
    ])
    _install(monkeypatch, stub)

    with caplog.at_level(logging.INFO, logger="app.agents.matching_analyze"):
        analyze_matching(request)

    assert "missing=1, unexpected=0, bad_evidence=0" in caplog.text
    assert "repair turn recovered" in caplog.text
    assert "SECRET-BIO" not in caplog.text


# --- T-62/T-63: re-evaluation context and clarification evidence --------------

ANSWERED = {"question": "Java backend?", "rationale": "Why.", "answer": "Yes, SECRET-ANSWER.", "status": "answered"}
SKIPPED = {"question": "Kubernetes?", "rationale": "Why.", "status": "skipped"}


def _request_with_history(clarifications=(), previous=(), sheet=None, keys=("a",)) -> MatchingAnalyzeRequest:
    return MatchingAnalyzeRequest(
        matching_id="m-42",
        candidate={"schemaVersion": "3", **(sheet or {})},
        offer={"schemaVersion": "2"},
        criteria=[{"key": key, "section": "required_skills", "label": key} for key in keys],
        previous_assessments=list(previous),
        clarifications=list(clarifications),
    )


def _sent_payload(stub) -> dict:
    content = stub.calls[0]["payload"]["messages"][0].content
    return json.loads(content[content.index("{") :])


def test_the_initial_analysis_sends_empty_history_arrays(monkeypatch):
    stub = StubAgent([{"structured_response": _analysis("a"), "messages": []}])
    _install(monkeypatch, stub)

    analyze_matching(_request("a"))

    payload = _sent_payload(stub)
    assert payload["previousAssessments"] == []
    assert payload["clarifications"] == []


def test_a_re_evaluation_sends_previous_assessments_and_every_clarification_in_camel_case(monkeypatch):
    previous = [{"criterion_key": "a", "score": 40, "rationale": "Partly.", "evidence": [{"source": "bio"}]}]
    request = _request_with_history(clarifications=[ANSWERED, SKIPPED], previous=previous)
    stub = StubAgent([{"structured_response": _analysis("a"), "messages": []}])
    _install(monkeypatch, stub)

    analyze_matching(request)

    payload = _sent_payload(stub)
    assert payload["previousAssessments"] == [
        {"criterionKey": "a", "score": 40, "rationale": "Partly.", "evidence": [{"source": "bio", "index": None}]}
    ]
    # Skips included, in request order: a "clarification" index is the position in this array.
    assert payload["clarifications"] == [ANSWERED, {**SKIPPED, "answer": None}]


def _clarification_evidence(index: int) -> MatchingAnalysis:
    return MatchingAnalysis(
        assessments=[
            {
                "criterion_key": "a",
                "score": 80,
                "rationale": "Confirmed by the answer.",
                "evidence": [{"source": "clarification", "index": index}],
            }
        ]
    )


def test_clarification_gaps_flags_missing_and_skipped_clarifications():
    clarifications = _request_with_history(clarifications=[ANSWERED, SKIPPED]).clarifications

    assert clarification_gaps(_clarification_evidence(0), clarifications) == []
    assert clarification_gaps(_clarification_evidence(1), clarifications) == ["a -> clarification[1] (skipped)"]
    assert clarification_gaps(_clarification_evidence(2), clarifications) == ["a -> clarification[2] (does not exist)"]
    assert clarification_gaps(_clarification_evidence(0), []) == ["a -> clarification[0] (does not exist)"]
    # Sheet evidence is not its business.
    assert clarification_gaps(_with_evidence("a", "experience", 9), clarifications) == []


def test_evidence_gaps_ignores_clarification_evidence():
    # No "clarification" array in the sheet: it must neither crash nor be flagged here.
    assert evidence_gaps(_clarification_evidence(5), {"schemaVersion": "3"}) == []


def test_valid_clarification_evidence_needs_no_repair(monkeypatch):
    stub = StubAgent([{"structured_response": _clarification_evidence(0), "messages": []}])
    _install(monkeypatch, stub)

    result = analyze_matching(_request_with_history(clarifications=[ANSWERED]))

    assert result.assessments[0].evidence[0].source == "clarification"
    assert len(stub.calls) == 1


def test_an_out_of_range_clarification_index_gets_a_repair_turn_naming_it(monkeypatch):
    stub = StubAgent([
        {"structured_response": _clarification_evidence(3), "messages": []},
        {"structured_response": _clarification_evidence(0), "messages": []},
    ])
    _install(monkeypatch, stub)

    result = analyze_matching(_request_with_history(clarifications=[ANSWERED]))

    assert result.assessments[0].evidence[0].index == 0
    instruction = stub.calls[1]["payload"]["messages"][-1].content
    assert "a -> clarification[3] (does not exist)" in instruction
    assert "a skipped question is never evidence" in instruction
    assert "do not exist in the candidate sheet" not in instruction
    assert "Missing criterion keys" not in instruction


def test_clarification_evidence_without_any_clarification_gets_a_repair_turn(monkeypatch):
    stub = StubAgent([
        {"structured_response": _clarification_evidence(0), "messages": []},
        {"structured_response": _analysis("a"), "messages": []},
    ])
    _install(monkeypatch, stub)

    analyze_matching(_request_with_history())

    assert "a -> clarification[0] (does not exist)" in stub.calls[1]["payload"]["messages"][-1].content


def test_evidence_pointing_to_a_skipped_clarification_gets_a_repair_turn(monkeypatch):
    stub = StubAgent([
        {"structured_response": _clarification_evidence(1), "messages": []},
        {"structured_response": _clarification_evidence(0), "messages": []},
    ])
    _install(monkeypatch, stub)

    result = analyze_matching(_request_with_history(clarifications=[ANSWERED, SKIPPED]))

    assert result.assessments[0].evidence[0].index == 0
    assert "a -> clarification[1] (skipped)" in stub.calls[1]["payload"]["messages"][-1].content


def test_a_skipped_clarification_still_cited_after_the_repair_is_no_output(monkeypatch):
    stub = StubAgent([
        {"structured_response": _clarification_evidence(1), "messages": []},
        {"structured_response": _clarification_evidence(1), "messages": []},
    ])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request_with_history(clarifications=[ANSWERED, SKIPPED]))

    assert caught.value.code == "no_output"


def test_sheet_and_clarification_gaps_are_named_together_in_one_repair(monkeypatch):
    both = MatchingAnalysis(
        assessments=[
            {
                "criterion_key": "a",
                "score": 80,
                "rationale": "r",
                "evidence": [{"source": "experience", "index": 4}, {"source": "clarification", "index": 1}],
            }
        ]
    )
    stub = StubAgent([
        {"structured_response": both, "messages": []},
        {"structured_response": _clarification_evidence(0), "messages": []},
    ])
    _install(monkeypatch, stub)

    analyze_matching(_request_with_history(clarifications=[ANSWERED, SKIPPED], sheet={"experiences": []}))

    instruction = stub.calls[1]["payload"]["messages"][-1].content
    assert "a -> experience[4]" in instruction
    assert "a -> clarification[1] (skipped)" in instruction


def test_clarification_repair_logs_counts_only_never_the_answers(monkeypatch, caplog):
    stub = StubAgent([
        {"structured_response": _clarification_evidence(1), "messages": []},
        {"structured_response": _clarification_evidence(0), "messages": []},
    ])
    _install(monkeypatch, stub)

    with caplog.at_level(logging.INFO, logger="app.agents.matching_analyze"):
        analyze_matching(_request_with_history(clarifications=[ANSWERED, SKIPPED]))

    assert "bad_evidence=0, bad_clarification=1" in caplog.text
    assert "SECRET-ANSWER" not in caplog.text


# --- Output rejected by the schema: one repair turn, then no_output -----------


def _schema_rejection(rationale: str = "MySQL is of the same family.") -> StructuredOutputValidationError:
    """The real error of the agent: Pydantic rejects the output, the parser wraps it."""
    payload = {
        "assessments": [
            {"criterionKey": "skill:postgresql", "score": 40, "rationale": rationale, "evidence": []},
        ]
    }
    with pytest.raises(ValidationError) as rejected:
        MatchingAnalysis.model_validate(payload)
    source = ValueError(f"Failed to parse data to MatchingAnalysis: {rejected.value}")
    source.__cause__ = rejected.value
    return StructuredOutputValidationError("MatchingAnalysis", source, AIMessage(content=json.dumps(payload)))


def test_schema_validation_error_gets_one_repair_turn_naming_the_evidence_rule(monkeypatch):
    stub = StubAgent([
        _schema_rejection(),
        {"structured_response": _analysis("skill:postgresql"), "messages": []},
    ])
    _install(monkeypatch, stub)

    result = analyze_matching(_request("skill:postgresql"))

    assert result.assessments[0].criterion_key == "skill:postgresql"
    assert len(stub.calls) == 2
    original = stub.calls[0]["payload"]["messages"][0]
    repair_messages = stub.calls[1]["payload"]["messages"]
    # The invalid AIMessage is never replayed: request + repair instruction only.
    assert repair_messages[0] is original
    assert len(repair_messages) == 2
    assert all(isinstance(message, HumanMessage) for message in repair_messages)
    instruction = repair_messages[1].content
    assert "rejected by the schema" in instruction
    assert "assessments.0: Value error, a score above 0 needs at least one evidence." in instruction
    assert '"criterionKey": "skill:postgresql", "score": 40' in instruction
    assert '"evidence": []' in instruction
    assert (
        "Cite the entry of the related technology (source 'skill' with its 0-based index) or the experience"
        " that proves it. If no such entry exists, use score 0. Never invent evidence." in instruction
    )
    assert stub.calls[1]["config"] == stub.calls[0]["config"]


def test_schema_validation_error_again_on_repair_is_no_output(monkeypatch):
    stub = StubAgent([_schema_rejection(), _schema_rejection()])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request("skill:postgresql"))

    assert caught.value.code == "no_output"
    assert caught.value.message == NO_OUTPUT_MESSAGE
    assert len(stub.calls) == 2


@pytest.mark.parametrize(
    "second",
    [
        {"structured_response": None, "messages": []},
        {"structured_response": _analysis("other"), "messages": []},
        GraphRecursionError("loop"),
    ],
)
def test_schema_validation_error_then_a_failed_repair_is_no_output(monkeypatch, second):
    stub = StubAgent([_schema_rejection(), second])
    _install(monkeypatch, stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request("skill:postgresql"))

    assert caught.value.code == "no_output"
    assert len(stub.calls) == 2


def test_multiple_structured_outputs_gets_one_repair_turn(monkeypatch):
    stub = StubAgent([
        MultipleStructuredOutputsError(["MatchingAnalysis", "MatchingAnalysis"], AIMessage(content="")),
        {"structured_response": _analysis("a"), "messages": []},
    ])
    _install(monkeypatch, stub)

    analyze_matching(_request("a"))

    assert len(stub.calls) == 2
    repair_messages = stub.calls[1]["payload"]["messages"]
    assert len(repair_messages) == 2
    assert "You returned multiple structured outputs (MatchingAnalysis, MatchingAnalysis)" in repair_messages[1].content
    assert "exactly one is expected" in repair_messages[1].content


def test_a_provider_failure_is_not_turned_into_a_repair_or_no_output(monkeypatch):
    # TD-056: only a rejected output is repaired; anything else stays a 500.
    stub = StubAgent([RuntimeError("provider down")])
    _install(monkeypatch, stub)

    with pytest.raises(RuntimeError, match="provider down"):
        analyze_matching(_request("a"))

    assert len(stub.calls) == 1


def test_schema_repair_logs_the_error_type_and_count_never_the_rationale(monkeypatch, caplog):
    stub = StubAgent([
        _schema_rejection(rationale="SECRET-RATIONALE"),
        {"structured_response": _analysis("skill:postgresql"), "messages": []},
    ])
    _install(monkeypatch, stub)

    with caplog.at_level(logging.INFO, logger="app.agents.matching_analyze"):
        analyze_matching(_request("skill:postgresql"))

    assert "error=StructuredOutputValidationError, rejected_assessments=1" in caplog.text
    assert "repair turn recovered" in caplog.text
    assert "SECRET-RATIONALE" not in caplog.text
    assert "skill:postgresql" not in caplog.text
