"""Golden set script (TD-058, D67, D68): a dated report on every run, aborted runs included. No LLM call."""

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
    assert report["policyVersion"] == "education-2"
    assert report["fixture"] == "skills"
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
            policy_version="education-2",
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
    assert report["analysisPolicyVersions"] == ["education-2"]
    assert report["total"] == 9


# --- Legacy two-round fixture, scored as expected ----------------------------


def _expected_score(expected: dict) -> int:
    return expected["exact"] if "exact" in expected else expected["min"]


def _assessment(key: str, expected: dict) -> dict:
    score = _expected_score(expected)
    if score == 0:
        evidence = []
    elif expected.get("evidenceSource") == "clarification":
        evidence = [{"source": "clarification", "index": 0}]
    else:
        evidence = [{"source": "skill", "index": 0}]
    return {"criterion_key": key, "score": score, "rationale": "As expected.", "evidence": evidence}


def test_the_legacy_skills_fixture_passes_9_of_9_when_scored_as_expected(monkeypatch, tmp_path):
    script = _load_script()
    fixture = json.loads(script.CASES_FILE.read_text(encoding="utf-8"))
    round_1 = {case["key"]: case["expected"] for case in fixture["cases"] if case["round"] == 1}
    round_2 = {**round_1, **{case["key"]: case["expected"] for case in fixture["cases"] if case["round"] == 2}}
    calls = []

    def analyze(request):
        calls.append(request)
        expectations = round_1 if len(calls) == 1 else round_2
        return MatchingAnalysis(
            policy_version="education-2",
            assessments=[_assessment(criterion.key, expectations[criterion.key]) for criterion in request.criteria],
        )

    monkeypatch.setattr(script, "analyze_matching", analyze)
    monkeypatch.setattr(script, "RESULTS_DIR", tmp_path)

    assert script.main() == 0

    [report] = _reports(tmp_path)
    assert report["verdict"] == "PASS"
    assert (report["passed"], report["total"]) == (9, 9)
    assert report["fixture"] == "skills"
    assert report["analysisPolicyVersions"] == ["education-2", "education-2"]
    assert len(calls) == 2
    [output] = list(tmp_path.glob("matching-golden-skills-*.json"))
    assert output.is_file()


# --- Scenario fixtures (education) -------------------------------------------


def _scenario(scenario_id: int, name: str, expected: dict) -> dict:
    return {
        "id": scenario_id,
        "name": name,
        "why": "Test scenario.",
        "candidate": {"schemaVersion": "3", "diplomas": []},
        "offer": {"schemaVersion": "2", "title": "Backend Developer"},
        "criteria": [
            {
                "key": "education:requirement",
                "section": "education",
                "label": "Education",
                "requirement": "Degree level (one of, or above): Master's degree",
                "education": {"degreeLevels": ["Master's degree"], "credentials": [], "fields": []},
            }
        ],
        "expected": expected,
    }


def _scenario_fixture(directory: Path, policy_version: str = "education-2") -> Path:
    path = directory / "matching_demo_cases.json"
    path.write_text(
        json.dumps(
            {
                "description": "Two scenarios.",
                "policyVersion": policy_version,
                "scenarios": [
                    _scenario(1, "Exact", {"exact": 100, "evidenceSource": "diploma"}),
                    _scenario(2, "None", {"exact": 0, "noEvidence": True}),
                ],
            }
        ),
        encoding="utf-8",
    )
    return path


def _scored(score: int) -> MatchingAnalysis:
    evidence = [{"source": "diploma", "index": 0}] if score > 0 else []
    return MatchingAnalysis(
        policy_version="education-2",
        assessments=[
            {"criterion_key": "education:requirement", "score": score, "rationale": "Scored.", "evidence": evidence}
        ],
    )


def test_a_scenario_fixture_runs_one_analysis_per_scenario_without_round_2(monkeypatch, tmp_path):
    script = _load_script()
    fixture_path = _scenario_fixture(tmp_path)
    results = tmp_path / "results"
    requests = []

    def analyze(request):
        requests.append(request)
        return _scored(100 if len(requests) == 1 else 0)

    monkeypatch.setattr(script, "analyze_matching", analyze)
    monkeypatch.setattr(script, "RESULTS_DIR", results)

    assert script.main(fixture_path) == 0

    [report] = _reports(results)
    assert report["verdict"] == "PASS"
    assert (report["passed"], report["total"]) == (2, 2)
    assert report["fixture"] == "demo"
    assert report["analysisPolicyVersions"] == ["education-2", "education-2"]
    assert [case["key"] for case in report["cases"]] == ["education:requirement"] * 2
    assert [case["round"] for case in report["cases"]] == [1, 1]
    assert [request.matching_id for request in requests] == ["golden-set-demo-1", "golden-set-demo-2"]
    assert all(request.clarifications == [] and request.previous_assessments == [] for request in requests)
    assert len(list(results.glob("matching-golden-demo-*.json"))) == 1


def test_a_scenario_with_evidence_on_a_zero_score_fails(monkeypatch, tmp_path):
    script = _load_script()
    fixture_path = _scenario_fixture(tmp_path)
    results = tmp_path / "results"
    zero_with_evidence = MatchingAnalysis.model_construct(
        policy_version="education-2",
        assessments=[
            _scored(100).assessments[0].model_copy(update={"score": 0}),
        ],
    )
    answers = iter([_scored(100), zero_with_evidence])

    monkeypatch.setattr(script, "analyze_matching", lambda request: next(answers))
    monkeypatch.setattr(script, "RESULTS_DIR", results)

    assert script.main(fixture_path) == 1

    [report] = _reports(results)
    assert report["verdict"] == "FAIL"
    assert report["cases"][1]["detail"] == "unexpected evidence on a zero score"


def test_an_aborted_scenario_keeps_the_scenarios_already_scored(monkeypatch, tmp_path):
    script = _load_script()
    fixture_path = _scenario_fixture(tmp_path)
    results = tmp_path / "results"
    calls = []

    def analyze(request):
        calls.append(request)
        if len(calls) == 2:
            raise MatchingAnalyzeError("no_output", "boom")
        return _scored(100)

    monkeypatch.setattr(script, "analyze_matching", analyze)
    monkeypatch.setattr(script, "RESULTS_DIR", results)

    assert script.main(fixture_path, "education") == 1

    [report] = _reports(results)
    assert report["verdict"] == "ERROR"
    assert report["fixture"] == "education"
    assert report["stage"] == "scenario 2 (None)"
    assert report["error"] == {"type": "MatchingAnalyzeError", "code": "no_output", "message": "boom"}
    assert [case["id"] for case in report["cases"]] == [1]
    assert report["cases"][0]["passed"] is True
    assert report["total"] == 2
    assert len(list(results.glob("matching-golden-education-*.json"))) == 1


def test_a_fixture_targeting_another_policy_is_refused_without_any_call(monkeypatch, tmp_path):
    script = _load_script()
    fixture_path = _scenario_fixture(tmp_path, policy_version="skills-3")
    results = tmp_path / "results"

    def analyze(request):
        raise AssertionError("no analysis expected")

    monkeypatch.setattr(script, "analyze_matching", analyze)
    monkeypatch.setattr(script, "RESULTS_DIR", results)

    assert script.main(fixture_path) == 2
    assert not results.exists()


def test_the_cli_selects_a_fixture_by_name_and_refuses_an_unknown_one(monkeypatch):
    script = _load_script()
    calls = []
    monkeypatch.setattr(script, "main", lambda cases_file=None, label=None: calls.append((cases_file, label)) or 0)

    assert script._cli([]) == 0
    assert script._cli(["education"]) == 0
    assert script._cli(["languages"]) == 2

    assert calls == [(None, None), (script.FIXTURES["education"], "education")]
    assert set(script.FIXTURES) == {"skills", "education", "certifications"}
    expected_sizes = {"education": 10, "certifications": 3}
    for name, size in expected_sizes.items():
        fixture = json.loads(script.FIXTURES[name].read_text(encoding="utf-8"))
        assert fixture["policyVersion"] == "education-2"
        assert len(fixture["scenarios"]) == size
    skills = json.loads(script.FIXTURES["skills"].read_text(encoding="utf-8"))
    assert skills["policyVersion"] == "education-2"


def test_the_education_fixture_is_deterministic_and_passes_10_of_10_without_any_model_call(monkeypatch, tmp_path):
    script = _load_script()
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", _no_model)
    monkeypatch.setattr(script, "RESULTS_DIR", tmp_path)

    assert script._cli(["education"]) == 0

    [report] = _reports(tmp_path)
    assert report["verdict"] == "PASS"
    assert (report["passed"], report["total"]) == (10, 10)
    assert report["fixture"] == "education"
    assert [case["obtained"] for case in report["cases"]] == [100, 100, 65, 35, 25, 75, 50, 0, 0, 0]


def _no_model(**kwargs):
    raise AssertionError("the education criterion is scored in code, never by the model")
