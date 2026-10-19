"""Golden set of the matching skills policy (TD-058) — manual, OUTSIDE CI.

Replays the nine cases of ``scripts/golden/matching_skills_cases.json`` against
the REAL model: the production pipeline ``analyze_matching`` (one agent built
by ``build_matching_agent`` on ``get_model(temperature=0.0)``, plus its repair
turn), never a stub. pytest never collects this file (``testpaths = ["tests"]``).

Round 1 scores the eight criteria; round 2 replays the same context with the
answered clarification of the fixture and the round-1 assessments, like the
backend worker does after an answer.

Usage, from ``ai-service/`` (needs ``GOOGLE_API_KEY`` in ``.env``):

    uv run python scripts/matching_golden_set.py

Without uv (Windows virtualenv): ``.venv/Scripts/python scripts/matching_golden_set.py``
(prefix ``PYTHONIOENCODING=utf-8`` on a cp1252 console).

Every run writes a dated report, completed or aborted:
``scripts/golden/results/matching-golden-<UTC timestamp, microseconds>.json``
(never overwritten). A completed run records date, model, temperature, policy
version, every case expected/obtained and the verdict PASS or FAIL. A run
that stops on an exception records the verdict ERROR, the stage (round 1 or
round 2), the error (type, code when the pipeline gives one, message) and the
cases already scored. Prints a summary. Exit code 0 only when every case
passes; 1 on FAIL or ERROR; 2 when the fixture targets another policy.
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

CASES_FILE = ROOT / "scripts" / "golden" / "matching_skills_cases.json"
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
        return False, "evidence present on an absent skill"
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


def _write(report: dict, now: datetime) -> Path:
    """Write the dated report; never overwrite an earlier one."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = now.strftime("%Y%m%dT%H%M%S%fZ")
    output = RESULTS_DIR / f"matching-golden-{stamp}.json"
    suffix = 1
    while output.exists():
        output = RESULTS_DIR / f"matching-golden-{stamp}-{suffix}.json"
        suffix += 1
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def main() -> int:
    fixture = json.loads(CASES_FILE.read_text(encoding="utf-8"))
    if fixture["policyVersion"] != POLICY_VERSION:
        print(f"Fixture targets {fixture['policyVersion']}, code is {POLICY_VERSION}: update the fixture first.")
        return 2

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
        error = {"type": type(exc).__name__}
        code = getattr(exc, "code", None)
        if code is not None:
            error["code"] = code
        error["message"] = str(exc)

    cases = [
        _case_result(case, rounds[case["round"]][case["key"]]) for case in fixture["cases"] if case["round"] in rounds
    ]
    passed_count = sum(case["passed"] for case in cases)
    total = len(fixture["cases"])
    if error is not None:
        verdict = "ERROR"
    else:
        verdict = "PASS" if passed_count == total else "FAIL"
    now = datetime.now(UTC)
    report = {
        "date": now.isoformat(timespec="seconds"),
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
    output = _write(report, now)

    print(
        f"{report['date']} model={report['model']} temperature={MATCHING_TEMPERATURE} policy={POLICY_VERSION}"
        f" -> {verdict} {passed_count}/{total}"
    )
    if error is not None:
        print(f"  [ERROR] {stage}: {error['type']}: {error['message']}")
    for case in cases:
        mark = "PASS" if case["passed"] else "FAIL"
        print(f"  [{mark}] {case['id']}. {case['name']}: {case['obtained']} ({case['detail']}) {case['evidence']}")
    print(f"Written to {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}")
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
