"""Pipeline tests: pypdf extraction + orchestration. The agent is stubbed."""

import pytest
from langgraph.errors import GraphRecursionError

from app.agents.cv_parse import RECURSION_LIMIT, CVParseError, extract_text, parse_cv
from app.schemas.cv import ParsedCv

CV_SAMPLE = (
    "Camille Martin, Backend Engineer based in Lyon. Seven years of experience "
    "designing APIs with Java, Spring Boot and Kubernetes. Led the migration to "
    "event-driven architecture at Acme and mentored three junior developers. "
    "MSc Computer Science, Sorbonne University, 2016 to 2018."
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


def test_extract_text_reads_the_text_layer(make_pdf):
    text = extract_text(make_pdf(CV_SAMPLE))

    assert "Camille Martin" in text
    assert "Sorbonne" in text


def test_extract_text_rejects_corrupt_bytes():
    with pytest.raises(CVParseError) as exc:
        extract_text(b"definitely not a pdf")

    assert exc.value.code == "invalid_pdf"


def test_parse_cv_rejects_pdf_without_text(make_pdf):
    with pytest.raises(CVParseError) as exc:
        parse_cv(make_pdf("tiny"))

    assert exc.value.code == "no_text"


def test_parse_cv_returns_structured_response(make_pdf, monkeypatch):
    expected = ParsedCv(title="Backend Engineer", summary="I build APIs.")
    stub = StubAgent([{"structured_response": expected}])
    monkeypatch.setattr("app.agents.cv_parse.build_cv_agent", lambda: stub)

    parsed = parse_cv(make_pdf(CV_SAMPLE))

    assert parsed == expected
    assert len(stub.calls) == 1
    sent = stub.calls[0]["payload"]["messages"][0].content
    assert "Extract the following CV" in sent
    assert "Camille Martin" in sent
    assert stub.calls[0]["config"]["configurable"]["thread_id"]


def test_parse_cv_repairs_a_missing_output(make_pdf, monkeypatch):
    expected = ParsedCv(title="Backend Engineer")
    stub = StubAgent([{}, {"structured_response": expected}])
    monkeypatch.setattr("app.agents.cv_parse.build_cv_agent", lambda: stub)

    parsed = parse_cv(make_pdf(CV_SAMPLE))

    assert parsed == expected
    assert len(stub.calls) == 2
    repair_message = stub.calls[1]["payload"]["messages"][0].content
    assert "structured output" in repair_message
    # Same thread: the checkpointer carries the history across both calls.
    assert stub.calls[0]["config"] == stub.calls[1]["config"]


def test_parse_cv_fails_when_repair_also_fails(make_pdf, monkeypatch):
    stub = StubAgent([{}, {}])
    monkeypatch.setattr("app.agents.cv_parse.build_cv_agent", lambda: stub)

    with pytest.raises(CVParseError) as exc:
        parse_cv(make_pdf(CV_SAMPLE))

    assert exc.value.code == "no_output"


def test_parse_cv_bounds_the_agent_and_maps_recursion_to_no_output(make_pdf, monkeypatch):
    stub = StubAgent([GraphRecursionError("recursion limit reached")])
    monkeypatch.setattr("app.agents.cv_parse.build_cv_agent", lambda: stub)

    with pytest.raises(CVParseError) as exc:
        parse_cv(make_pdf(CV_SAMPLE))

    assert exc.value.code == "no_output"
    assert stub.calls[0]["config"]["recursion_limit"] == RECURSION_LIMIT


def test_parse_cv_maps_recursion_during_repair_to_no_output(make_pdf, monkeypatch):
    stub = StubAgent([{}, GraphRecursionError("recursion limit reached")])
    monkeypatch.setattr("app.agents.cv_parse.build_cv_agent", lambda: stub)

    with pytest.raises(CVParseError) as exc:
        parse_cv(make_pdf(CV_SAMPLE))

    assert exc.value.code == "no_output"
    assert len(stub.calls) == 2
