"""Pipeline tests: orchestration and repair turn. The agent is stubbed."""

import pytest
from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError

from app.agents.profile_normalize import (
    RECURSION_LIMIT,
    ProfileNormalizeError,
    has_content,
    normalize_profile,
)
from app.schemas.cv import ReferenceContext
from app.schemas.normalize import (
    CandidateProfile,
    NormalizedProfile,
    ProfileAbout,
    ProfileLocation,
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


def _profile() -> CandidateProfile:
    return CandidateProfile(
        about=ProfileAbout(title="Full Stack Developer", bio="Six years of APIs."),
        skills=[{"name": "Java", "level": 4, "years_experience": 6}],
        projects=[{"name": "Portfolio", "start_date": "2023-01-01"}],
    )


def test_has_content_detects_about_and_sections():
    assert has_content(CandidateProfile(about=ProfileAbout(title="Dev")))
    assert has_content(CandidateProfile(skills=[{"name": "Java"}]))
    assert has_content(CandidateProfile(projects=[{"name": "Portfolio"}]))
    assert not has_content(CandidateProfile())
    assert not has_content(CandidateProfile(about=ProfileAbout()))


def test_normalize_profile_rejects_an_empty_snapshot():
    with pytest.raises(ProfileNormalizeError) as exc:
        normalize_profile(CandidateProfile())

    assert exc.value.code == "empty_profile"
    assert exc.value.message == "The profile has no content to normalize."


def test_normalize_profile_sends_the_snapshot_and_returns_the_result(monkeypatch):
    expected = NormalizedProfile(title="Full Stack Developer", summary="I build APIs.")
    stub = StubAgent([{"structured_response": expected}])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    result = normalize_profile(_profile())

    assert result == expected
    assert len(stub.calls) == 1
    sent = stub.calls[0]["payload"]["messages"][0].content
    assert "Normalize the following candidate profile" in sent
    assert "Full Stack Developer" in sent
    assert stub.calls[0]["config"] == {"recursion_limit": RECURSION_LIMIT}


def test_normalize_profile_forces_the_schema_version(monkeypatch):
    stub = StubAgent([{"structured_response": NormalizedProfile(schema_version="99")}])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    result = normalize_profile(_profile())

    assert result.schema_version == "3"


def test_normalize_profile_forwards_the_reference_context(monkeypatch):
    captured = {}

    def fake_build(context=None):
        captured["context"] = context
        return StubAgent([{"structured_response": NormalizedProfile(title="Dev")}])

    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", fake_build)
    reference = ReferenceContext(languages=["French"])

    normalize_profile(_profile(), context=reference)

    assert captured["context"] is reference


def test_normalize_profile_includes_the_location_in_the_payload(monkeypatch):
    stub = StubAgent([{"structured_response": NormalizedProfile(title="Dev")}])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    normalize_profile(_profile(), location=ProfileLocation(current_city="Paris", current_country="FR"))

    sent = stub.calls[0]["payload"]["messages"][0].content
    assert "Paris" in sent


def test_normalize_profile_omits_a_null_location_from_the_payload(monkeypatch):
    stub = StubAgent([{"structured_response": NormalizedProfile(title="Dev")}])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    normalize_profile(_profile(), location=None)

    sent = stub.calls[0]["payload"]["messages"][0].content
    assert "Paris" not in sent


def test_normalize_profile_repairs_a_missing_output(monkeypatch):
    expected = NormalizedProfile(title="Full Stack Developer")
    first_turn = {
        "messages": [HumanMessage(content="Normalize the following candidate profile:\n\n{}")]
    }
    stub = StubAgent([first_turn, {"structured_response": expected}])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    result = normalize_profile(_profile())

    assert result == expected
    assert len(stub.calls) == 2
    repair_messages = stub.calls[1]["payload"]["messages"]
    assert repair_messages[0].content == first_turn["messages"][0].content
    assert "structured output" in repair_messages[-1].content


def test_normalize_profile_fails_when_repair_also_fails(monkeypatch):
    stub = StubAgent([{"messages": []}, {"messages": []}])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    with pytest.raises(ProfileNormalizeError) as exc:
        normalize_profile(_profile())

    assert exc.value.code == "no_output"


def test_normalize_profile_bounds_the_agent_and_maps_recursion_to_no_output(monkeypatch):
    stub = StubAgent([GraphRecursionError("recursion limit reached")])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    with pytest.raises(ProfileNormalizeError) as exc:
        normalize_profile(_profile())

    assert exc.value.code == "no_output"
    assert stub.calls[0]["config"]["recursion_limit"] == RECURSION_LIMIT


def test_normalize_profile_maps_recursion_during_repair_to_no_output(monkeypatch):
    stub = StubAgent([{"messages": []}, GraphRecursionError("recursion limit reached")])
    monkeypatch.setattr("app.agents.profile_normalize.build_normalize_agent", lambda **_: stub)

    with pytest.raises(ProfileNormalizeError) as exc:
        normalize_profile(_profile())

    assert exc.value.code == "no_output"
    assert len(stub.calls) == 2
