"""Golden set script (TD-058): a dated report on every run, aborted runs included. No LLM call."""

import importlib.util
import json
from pathlib import Path

from app.agents.matching_analyze import MatchingAnalyzeError
from app.schemas.matching import MatchingAnalysis

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "matching_golden_set.py"


def _load_script():
    spec = importlib.util.spec_from_file_location("matching_golden_set_script", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _reports(directory: Path) -> list[dict]:
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted(directory.glob("matching-golden-*.json"))]


def test_an_aborted_round_1_still_writes_a_dated_error_report(monkeypatch, tmp_path):
    script = _load_script()

    def fail(request):
        raise MatchingAnalyzeError("no_output", "boom")

    monkeypatch.setattr(script, "analyze_matching", fail)
    monkeypatch.setattr(script, "RESULTS_DIR", tmp_path)

    assert script.main() == 1
    assert script.main() == 1

    reports = _reports(tmp_path)
    # Two runs, two files: a report is never overwritten.
    assert len(reports) == 2
    report = reports[0]
    assert report["verdict"] == "ERROR"
    assert report["stage"] == "round 1"
    assert report["error"] == {"type": "MatchingAnalyzeError", "code": "no_output", "message": "boom"}
    assert report["temperature"] == 0.0
    assert report["policyVersion"] == "skills-3"
    assert report["date"]
    assert "model" in report
    assert report["cases"] == []
    assert report["passed"] == 0
    assert report["total"] == 9


def test_an_aborted_round_2_keeps_the_round_1_cases(monkeypatch, tmp_path):
    script = _load_script()
    fixture = json.loads(script.CASES_FILE.read_text(encoding="utf-8"))
    calls = []

    def analyze(request):
        calls.append(request)
        if len(calls) == 2:
            raise RuntimeError("provider down")
        return MatchingAnalysis(
            policy_version="skills-3",
            assessments=[
                {"criterion_key": criterion["key"], "score": 0, "rationale": "Not shown.", "evidence": []}
                for criterion in fixture["criteria"]
            ],
        )

    monkeypatch.setattr(script, "analyze_matching", analyze)
    monkeypatch.setattr(script, "RESULTS_DIR", tmp_path)

    assert script.main() == 1

    [report] = _reports(tmp_path)
    assert report["verdict"] == "ERROR"
    assert report["stage"] == "round 2"
    # No code on a non-pipeline error.
    assert report["error"] == {"type": "RuntimeError", "message": "provider down"}
    assert [case["round"] for case in report["cases"]] == [1] * 8
    assert report["analysisPolicyVersions"] == ["skills-3"]
    assert report["total"] == 9
