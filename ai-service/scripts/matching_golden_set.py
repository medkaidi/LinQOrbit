"""Golden sets of the matching policy (TD-058, D67, D68) — manual, OUTSIDE CI.

Replays a fixture of ``scripts/golden/`` against the REAL model: the
production pipeline ``analyze_matching`` (one agent built by
``build_matching_agent`` on ``get_model(temperature=0.0)``, plus its repair
turn), never a stub. pytest never collects this file (``testpaths = ["tests"]``).

Three fixtures, two shapes:

- ``matching_skills_cases.json`` (legacy, two rounds): round 1 scores the
  eight criteria; round 2 replays the same context with the answered
  clarification of the fixture and the round-1 assessments, like the backend
  worker does after an answer.
- ``matching_education_cases.json`` (``scenarios``): one analysis per scenario,
  each with its own candidate, offer and criteria, no round 2. Education is
  scored in code since education-2 (D68): this set never calls the model and
  is deterministic.
- ``matching_certifications_cases.json`` (``scenarios``): the certification
  rules, replayed against the real model like the skills set.

Usage, from ``ai-service/`` (needs ``GOOGLE_API_KEY`` in ``.env``):

    uv run python scripts/matching_golden_set.py            # skills
    uv run python scripts/matching_golden_set.py skills
    uv run python scripts/matching_golden_set.py education
    uv run python scripts/matching_golden_set.py certifications

Without uv (Windows virtualenv):
``.venv/Scripts/python scripts/matching_golden_set.py education``
(prefix ``PYTHONIOENCODING=utf-8`` on a cp1252 console).

Every run writes a dated report, completed or aborted:
``scripts/golden/results/matching-golden-<fixture>-<UTC timestamp, microseconds>.json``
(never overwritten). A completed run records date, fixture, model,
temperature, policy version, every case expected/obtained and the verdict
PASS or FAIL. A run that stops on an exception records the verdict ERROR, the
stage (round or scenario), the error (type, code when the pipeline gives one,
message) and the cases already scored. Prints a summary. Exit code 0 only
when every case passes; 1 on FAIL or ERROR; 2 when the fixture targets
another policy or the fixture name is unknown.
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.agents.matching_analyze import analyze_matching  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.graphs.matching_agent import MATCHING_TEMPERATURE  # noqa: E402
from app.graphs.matching_policy import POLICY_VERSION  # noqa: E402
from app.schemas.matching import CriterionAssessment, MatchingAnalyzeRequest  # noqa: E402

FIXTURES = {
    "skills": ROOT / "scripts" / "golden" / "matching_skills_cases.json",
    "education": ROOT / "scripts" / "golden" / "matching_education_cases.json",
    "certifications": ROOT / "scripts" / "golden" / "matching_certifications_cases.json",
}
# Default fixture (legacy two-round skills set).
CASES_FILE = FIXTURES["skills"]
RESULTS_DIR = ROOT / "scripts" / "golden" / "results"


def _evidence(assessment: CriterionAssessment) -> list[str]:
    return [
        evidence.source if evidence.index is None else f"{evidence.source}[{evidence.index}]"
        for evidence in assessment.evidence
    ]


def _verdict(expected: dict, assessment: CriterionAssessment) -> tuple[bool, str]:
    score = assessment.score
    if "exact" in expected and score != expected["exact"]:
        return False, f"score {score} != {expected['exact']}"
    if "min" in expected and not expected["min"] <= score <= expected["max"]:
        return False, f"score {score} outside {expected['min']}-{expected['max']}"
    if expected.get("noEvidence") and assessment.evidence:
        return False, "unexpected evidence on a zero score"
    source = expected.get("evidenceSource")
    if source and all(evidence.source != source for evidence in assessment.evidence):
        return False, f"no {source} evidence"
    return True, "ok"


def _case_result(case: dict, assessment: CriterionAssessment) -> dict:
    passed, detail = _verdict(case["expected"], assessment)
    return {
        "id": case["id"],
        "name": case["name"],
        "key": case["key"],
        "round": case["round"],
        "expected": case["expected"],
        "obtained": assessment.score,
        "evidence": _evidence(assessment),
        "rationale": assessment.rationale,
        "passed": passed,
        "detail": detail,
    }


def _write(report: dict, now: datetime, fixture_label: str) -> Path:
    """Write the dated report, named after its fixture; never overwrite an earlier one."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = now.strftime("%Y%m%dT%H%M%S%fZ")
    output = RESULTS_DIR / f"matching-golden-{fixture_label}-{stamp}.json"
    suffix = 1
    while output.exists():
        output = RESULTS_DIR / f"matching-golden-{fixture_label}-{stamp}-{suffix}.json"
        suffix += 1
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def _error(exc: Exception) -> dict:
    error = {"type": type(exc).__name__}
    code = getattr(exc, "code", None)
    if code is not None:
        error["code"] = code
    error["message"] = str(exc)
    return error


def _run_rounds(fixture: dict) -> tuple[list[dict], list[str], str, dict | None, int]:
    """Legacy two-round fixture: one candidate and one offer, round 2 replays an answered clarification."""
    context = {"candidate": fixture["candidate"], "offer": fixture["offer"], "criteria": fixture["criteria"]}
    rounds: dict[int, dict[str, CriterionAssessment]] = {}
    versions: list[str] = []
    stage = "round 1"
    error: dict | None = None
    try:
        first = analyze_matching(MatchingAnalyzeRequest(matching_id="golden-set", **context))
        rounds[1] = {assessment.criterion_key: assessment for assessment in first.assessments}
        versions.append(first.policy_version)
        stage = "round 2"
        second = analyze_matching(
            MatchingAnalyzeRequest(
                matching_id="golden-set",
                previous_assessments=first.assessments,
                clarifications=fixture["clarifications"],
                **context,
            )
        )
        rounds[2] = {assessment.criterion_key: assessment for assessment in second.assessments}
        versions.append(second.policy_version)
    except Exception as exc:  # noqa: BLE001 - an aborted run still leaves its dated report
        error = _error(exc)

    cases = [
        _case_result(case, rounds[case["round"]][case["key"]]) for case in fixture["cases"] if case["round"] in rounds
    ]
    return cases, versions, stage, error, len(fixture["cases"])


def _run_scenarios(fixture: dict, fixture_label: str) -> tuple[list[dict], list[str], str, dict | None, int]:
    """Scenario fixture: one analysis per scenario (own candidate, offer and criteria), no round 2."""
    cases: list[dict] = []
    versions: list[str] = []
    stage = ""
    error: dict | None = None
    try:
        for scenario in fixture["scenarios"]:
            stage = f"scenario {scenario['id']} ({scenario['name']})"
            case = {
                "id": scenario["id"],
                "name": scenario["name"],
                "key": scenario["criteria"][0]["key"],
                "round": 1,
                "expected": scenario["expected"],
            }
            analysis = analyze_matching(
                MatchingAnalyzeRequest(
                    matching_id=f"golden-set-{fixture_label}-{scenario['id']}",
                    candidate=scenario["candidate"],
                    offer=scenario["offer"],
                    criteria=scenario["criteria"],
                )
            )
            versions.append(analysis.policy_version)
            assessments = {assessment.criterion_key: assessment for assessment in analysis.assessments}
            cases.append(_case_result(case, assessments[case["key"]]))
    except Exception as exc:  # noqa: BLE001 - an aborted run still leaves its dated report
        error = _error(exc)
    return cases, versions, stage, error, len(fixture["scenarios"])


def main(cases_file: Path | None = None, label: str | None = None) -> int:
    path = cases_file or CASES_FILE
    fixture_label = label or path.stem.removeprefix("matching_").removesuffix("_cases")
    fixture = json.loads(path.read_text(encoding="utf-8"))
    if fixture["policyVersion"] != POLICY_VERSION:
        print(f"Fixture targets {fixture['policyVersion']}, code is {POLICY_VERSION}: update the fixture first.")
        return 2

    if "scenarios" in fixture:
        cases, versions, stage, error, total = _run_scenarios(fixture, fixture_label)
    else:
        cases, versions, stage, error, total = _run_rounds(fixture)
    passed_count = sum(case["passed"] for case in cases)
    if error is not None:
        verdict = "ERROR"
    else:
        verdict = "PASS" if passed_count == total else "FAIL"
    now = datetime.now(UTC)
    report = {
        "date": now.isoformat(timespec="seconds"),
        "fixture": fixture_label,
        "model": settings.llm_model,
        "temperature": MATCHING_TEMPERATURE,
        "policyVersion": POLICY_VERSION,
        "analysisPolicyVersions": versions,
        "passed": passed_count,
        "total": total,
        "verdict": verdict,
    }
    if error is not None:
        report["stage"] = stage
        report["error"] = error
    report["cases"] = cases
    output = _write(report, now, fixture_label)

    print(
        f"{report['date']} fixture={fixture_label} model={report['model']} temperature={MATCHING_TEMPERATURE}"
        f" policy={POLICY_VERSION} -> {verdict} {passed_count}/{total}"
    )
    if error is not None:
        print(f"  [ERROR] {stage}: {error['type']}: {error['message']}")
    for case in cases:
        mark = "PASS" if case["passed"] else "FAIL"
        print(f"  [{mark}] {case['id']}. {case['name']}: {case['obtained']} ({case['detail']}) {case['evidence']}")
    print(f"Written to {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}")
    return 0 if verdict == "PASS" else 1


def _cli(argv: list[str]) -> int:
    if not argv:
        return main()
    name = argv[0]
    if name not in FIXTURES:
        print(f"Unknown fixture {name!r}: choose one of {', '.join(FIXTURES)}.")
        return 2
    return main(FIXTURES[name], name)


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
