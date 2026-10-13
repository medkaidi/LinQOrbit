"""Pipeline tests: orchestration and repair turn. The agent is stubbed."""

import pytest
from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError

from app.agents.job_offer_normalize import (
    RECURSION_LIMIT,
    JobOfferNormalizeError,
    has_content,
    normalize_job_offer,
)
from app.schemas.cv import ReferenceContext
from app.schemas.job_offer import (
    JobOfferSnapshot,
    NormalizedJobOffer,
)


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


def _offer() -> JobOfferSnapshot:
    return JobOfferSnapshot(
        title="Senior Backend Engineer",
        description="You will own the public API.",
        skills=[{"name": "Java", "requirement_type": "mandatory", "weight": 5}],
        languages=[{"name": "English", "level": "B2", "is_required": True}],
    )


def test_has_content_detects_scalars_company_and_sections():
    assert has_content(JobOfferSnapshot(title="Dev"))
    assert has_content(JobOfferSnapshot(description="Own the API."))
    assert has_content(JobOfferSnapshot(company={"name": "Acme"}))
    assert has_content(JobOfferSnapshot(skills=[{"name": "Java"}]))
    assert has_content(JobOfferSnapshot(degree_labels=["Master"]))
    assert has_content(JobOfferSnapshot(salary_min=60000))
    assert not has_content(JobOfferSnapshot())
    assert not has_content(JobOfferSnapshot(company={}))


def test_normalize_job_offer_rejects_an_empty_snapshot():
    with pytest.raises(JobOfferNormalizeError) as exc:
        normalize_job_offer(JobOfferSnapshot())

    assert exc.value.code == "empty_offer"
    assert exc.value.message == "The offer has no content to normalize."


def test_normalize_job_offer_sends_the_snapshot_and_returns_the_result(monkeypatch):
    expected = NormalizedJobOffer(title="Senior Backend Engineer", summary="Own the API.")
    stub = StubAgent([{"structured_response": expected}])
    monkeypatch.setattr(
        "app.agents.job_offer_normalize.build_job_offer_normalize_agent", lambda **_: stub
    )

    result = normalize_job_offer(_offer())

    assert result == expected
    assert len(stub.calls) == 1
    sent = stub.calls[0]["payload"]["messages"][0].content
    assert "Normalize the following job offer" in sent
    assert "Senior Backend Engineer" in sent
    assert stub.calls[0]["config"] == {"recursion_limit": RECURSION_LIMIT}


def test_normalize_job_offer_forces_the_schema_version(monkeypatch):
    stub = StubAgent([{"structured_response": NormalizedJobOffer(schema_version="99")}])
    monkeypatch.setattr(
        "app.agents.job_offer_normalize.build_job_offer_normalize_agent", lambda **_: stub
    )

    result = normalize_job_offer(_offer())

    assert result.schema_version == "1"


def test_normalize_job_offer_forwards_the_reference_context(monkeypatch):
    captured = {}

    def fake_build(context=None):
        captured["context"] = context
        return StubAgent([{"structured_response": NormalizedJobOffer(title="Dev")}])

    monkeypatch.setattr("app.agents.job_offer_normalize.build_job_offer_normalize_agent", fake_build)
    reference = ReferenceContext(languages=["French"])

    normalize_job_offer(_offer(), context=reference)

    assert captured["context"] is reference


def test_normalize_job_offer_repairs_a_missing_output(monkeypatch):
    expected = NormalizedJobOffer(title="Senior Backend Engineer")
    first_turn = {
        "messages": [HumanMessage(content="Normalize the following job offer:\n\n{}")]
    }
    stub = StubAgent([first_turn, {"structured_response": expected}])
    monkeypatch.setattr(
        "app.agents.job_offer_normalize.build_job_offer_normalize_agent", lambda **_: stub
    )

    result = normalize_job_offer(_offer())

    assert result == expected
    assert len(stub.calls) == 2
    repair_messages = stub.calls[1]["payload"]["messages"]
    assert repair_messages[0].content == first_turn["messages"][0].content
    assert "structured output" in repair_messages[-1].content


def test_normalize_job_offer_fails_when_repair_also_fails(monkeypatch):
    stub = StubAgent([{"messages": []}, {"messages": []}])
    monkeypatch.setattr(
        "app.agents.job_offer_normalize.build_job_offer_normalize_agent", lambda **_: stub
    )

    with pytest.raises(JobOfferNormalizeError) as exc:
        normalize_job_offer(_offer())

    assert exc.value.code == "no_output"


def test_normalize_job_offer_bounds_the_agent_and_maps_recursion_to_no_output(monkeypatch):
    stub = StubAgent([GraphRecursionError("recursion limit reached")])
    monkeypatch.setattr(
        "app.agents.job_offer_normalize.build_job_offer_normalize_agent", lambda **_: stub
    )

    with pytest.raises(JobOfferNormalizeError) as exc:
        normalize_job_offer(_offer())

    assert exc.value.code == "no_output"
    assert stub.calls[0]["config"]["recursion_limit"] == RECURSION_LIMIT


def test_normalize_job_offer_maps_recursion_during_repair_to_no_output(monkeypatch):
    stub = StubAgent([{"messages": []}, GraphRecursionError("recursion limit reached")])
    monkeypatch.setattr(
        "app.agents.job_offer_normalize.build_job_offer_normalize_agent", lambda **_: stub
    )

    with pytest.raises(JobOfferNormalizeError) as exc:
        normalize_job_offer(_offer())

    assert exc.value.code == "no_output"
    assert len(stub.calls) == 2
