"""Matching pipeline: orchestration, coverage check and repair turn. The agent is stubbed."""

import pytest
from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError

from app.agents.matching_analyze import (
    RECURSION_LIMIT,
    RUN_NAME,
    MatchingAnalyzeError,
    analyze_matching,
    coverage_gaps,
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
        assessments=[{"criterion_key": key, "score": 50, "rationale": "Partly shown."} for key in keys]
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
