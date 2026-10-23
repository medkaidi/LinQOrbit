"""Education scored in code (D67 bands, D68): score_education, the deterministic/model split of
analyze_matching and the education schemas. No LLM call: the education path is deterministic."""

import json
from pathlib import Path

import pytest
from langchain_core.messages import HumanMessage
from pydantic import ValidationError

from app.agents.matching_analyze import MatchingAnalyzeError, analyze_matching
from app.graphs.matching_policy import POLICY_VERSION, EducationRequirement, score_education
from app.schemas.matching import (
    EDUCATION_CRITERION_KEY,
    CriterionAssessment,
    MatchingAnalysis,
    MatchingAnalyzeRequest,
    MatchingCriterion,
)

FIXTURE = Path(__file__).resolve().parents[1] / "scripts" / "golden" / "matching_education_cases.json"
MASTER_CS = EducationRequirement(degree_levels=("Master's degree",), credentials=(), fields=("Computer Science",))


def _diploma(degree, field, end="2020-06"):
    return {"title": "Diploma", "degreeLabel": degree, "studyFieldLabel": field, "startDate": "2015-09", "endDate": end}


def _candidate(*diplomas, **extra):
    return {"schemaVersion": "3", "diplomas": list(diplomas), **extra}


def _no_model(**kwargs):
    raise AssertionError("the education criterion is scored in code, never by the model")


# --- The ten golden scenarios, through the real pipeline ----------------------


def _scenarios():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))["scenarios"]


@pytest.mark.parametrize("scenario", _scenarios(), ids=lambda scenario: f"{scenario['id']}-{scenario['name']}")
def test_the_golden_education_scenarios_score_as_expected_without_the_model(monkeypatch, scenario):
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", _no_model)

    analysis = analyze_matching(
        MatchingAnalyzeRequest(
            matching_id="golden",
            candidate=scenario["candidate"],
            offer=scenario["offer"],
            criteria=scenario["criteria"],
        )
    )

    [assessment] = analysis.assessments
    expected = scenario["expected"]
    assert assessment.criterion_key == EDUCATION_CRITERION_KEY
    assert assessment.score == expected["exact"]
    if expected.get("noEvidence"):
        assert assessment.evidence == []
    else:
        assert [(evidence.source, evidence.index) for evidence in assessment.evidence] == [("diploma", 0)]
    assert analysis.policy_version == POLICY_VERSION


def test_the_golden_fixture_expectations_are_the_d67_bands():
    assert [scenario["expected"]["exact"] for scenario in _scenarios()] == [100, 100, 65, 35, 25, 75, 50, 0, 0, 0]


# --- score_education: bands and selection --------------------------------------


@pytest.mark.parametrize(
    ("degree", "expected"),
    [
        ("Doctorate", 100),
        ("PhD", 100),
        ("Master's degree", 100),
        ("MSc", 100),
        ("Bachelor's degree", 65),
        ("bachelors degree", 65),
        ("Associate degree", 35),
        ("High school", 0),
    ],
)
def test_the_degree_band_follows_the_level_gap(degree, expected):
    result = score_education(_candidate(_diploma(degree, "Computer Science")), MASTER_CS)

    assert result.score == expected


def test_the_required_level_is_the_lowest_listed_alternative():
    requirement = EducationRequirement(degree_levels=("Doctorate", "Bachelor's degree"), credentials=(), fields=())

    assert score_education(_candidate(_diploma("Bachelor's degree", None)), requirement).score == 100
    assert score_education(_candidate(_diploma("Associate degree", None)), requirement).score == 65


def test_an_absent_or_unknown_degree_label_is_partial_50_never_guessed():
    for degree in (None, "", "Diplôme d'ingénieur", 42):
        result = score_education(_candidate(_diploma(degree, "Computer Science")), MASTER_CS)
        assert result.score == 50
        assert result.diploma_index == 0


@pytest.mark.parametrize(
    ("field", "expected"),
    [
        ("Computer Science", 100),
        ("computer  science", 100),
        ("Computer-Science", 100),
        ("Software Engineering", 75),
        ("Information Systems", 75),
        ("Business Administration", 25),
        ("Underwater Basket Weaving", 25),
        (None, 50),
        ("", 50),
    ],
)
def test_the_field_band_caps_the_diploma(field, expected):
    result = score_education(_candidate(_diploma("Doctorate", field)), MASTER_CS)

    assert result.score == expected


def test_finance_and_accounting_are_close_fields():
    requirement = EducationRequirement(degree_levels=(), credentials=(), fields=("Finance",))

    assert score_education(_candidate(_diploma("Master's degree", "Accounting")), requirement).score == 75
    assert score_education(_candidate(_diploma("Master's degree", "Computer Science")), requirement).score == 25


def test_the_best_diploma_wins_and_two_diplomas_are_never_mixed():
    # Doctorate in Business (25) and Bachelor in CS (65): never "Doctorate + CS" = 100.
    candidate = _candidate(
        _diploma("Doctorate", "Business Administration", "2022-06"),
        _diploma("Bachelor's degree", "Computer Science", "2015-06"),
    )

    result = score_education(candidate, MASTER_CS)

    assert result.score == 65
    assert result.diploma_index == 1
    assert "Bachelor's degree in Computer Science" in result.rationale


def test_ties_prefer_the_higher_degree_then_the_more_recent_end_then_the_first_index():
    requirement = EducationRequirement(degree_levels=("Bachelor's degree",), credentials=(), fields=())
    higher = _candidate(_diploma("Master's degree", None, "2010-06"), _diploma("Doctorate", None, "2008-06"))
    recent = _candidate(_diploma("Master's degree", None, "2010-06"), _diploma("Master's degree", None, "2019-06"))
    same = _candidate(_diploma("Master's degree", None, "2019-06"), _diploma("Master's degree", None, "2019-06"))

    assert score_education(higher, requirement).diploma_index == 1
    assert score_education(recent, requirement).diploma_index == 1
    assert score_education(same, requirement).diploma_index == 0


def test_only_obtained_diplomas_count():
    ongoing = _candidate(_diploma("Doctorate", "Computer Science", None))
    blank_end = _candidate(_diploma("Doctorate", "Computer Science", "  "))
    mixed = _candidate(
        _diploma("Doctorate", "Computer Science", None), _diploma("Bachelor's degree", "Computer Science")
    )

    assert score_education(ongoing, MASTER_CS).score == 0
    assert score_education(ongoing, MASTER_CS).diploma_index is None
    assert "in progress" in score_education(ongoing, MASTER_CS).rationale
    assert score_education(blank_end, MASTER_CS).score == 0
    # The ongoing Doctorate is ignored; the obtained Bachelor keeps its own index.
    assert (score_education(mixed, MASTER_CS).score, score_education(mixed, MASTER_CS).diploma_index) == (65, 1)


def test_no_diploma_is_0_with_no_evidence():
    result = score_education(_candidate(), MASTER_CS)

    assert (result.score, result.diploma_index) == (0, None)
    assert result.rationale == "The candidate sheet lists no obtained diploma."


def test_a_professional_certificate_is_a_credential_never_a_degree_level():
    candidate = _candidate(_diploma("Professional certificate", "Computer Science"))
    credential = EducationRequirement(degree_levels=(), credentials=("Professional certificate",), fields=())
    both = EducationRequirement(
        degree_levels=("Master's degree",), credentials=("Professional certificate",), fields=("Computer Science",)
    )

    # Against a degree level: 0, no evidence.
    assert (score_education(candidate, MASTER_CS).score, score_education(candidate, MASTER_CS).diploma_index) == (
        0,
        None,
    )
    # Against the listed credential: 100 with the diploma as evidence.
    assert score_education(candidate, credential).score == 100
    assert score_education(candidate, credential).diploma_index == 0
    # Level and credential are alternatives of one dimension: the best one counts.
    assert score_education(candidate, both).score == 100
    assert score_education(_candidate(_diploma("Master's degree", "Computer Science")), both).score == 100


def test_a_higher_degree_never_replaces_a_required_credential():
    credential = EducationRequirement(degree_levels=(), credentials=("Professional certificate",), fields=())

    result = score_education(_candidate(_diploma("Doctorate", "Computer Science")), credential)

    assert (result.score, result.diploma_index) == (0, None)


def test_one_stated_dimension_is_used_alone():
    fields_only = EducationRequirement(degree_levels=(), credentials=(), fields=("Computer Science",))
    levels_only = EducationRequirement(degree_levels=("Master's degree",), credentials=(), fields=())

    # An Associate degree does not matter when only the field is required.
    assert score_education(_candidate(_diploma("Associate degree", "Computer Science")), fields_only).score == 100
    # A distant field does not matter when only the level is required.
    assert score_education(_candidate(_diploma("Master's degree", "History")), levels_only).score == 100


def test_an_unknown_required_level_is_partial_50():
    requirement = EducationRequirement(degree_levels=("Diplôme d'ingénieur",), credentials=(), fields=())

    assert score_education(_candidate(_diploma("Master's degree", None)), requirement).score == 50


@pytest.mark.parametrize(
    "candidate",
    [
        {"schemaVersion": "3"},
        {"schemaVersion": "3", "diplomas": None},
        {"schemaVersion": "3", "diplomas": "Master"},
        {"schemaVersion": "3", "diplomas": ["Master", 3, None]},
        {"schemaVersion": "3", "diplomas": [{"degreeLabel": "Master", "endDate": 2020}]},
        {"schemaVersion": "3", "diplomas": [{"degreeLabel": ["Master"], "studyFieldLabel": {}, "endDate": ""}]},
    ],
)
def test_malformed_diplomas_are_absent_never_an_exception(candidate):
    result = score_education(candidate, MASTER_CS)

    assert (result.score, result.diploma_index) == (0, None)


def test_malformed_labels_of_an_obtained_diploma_are_unknown():
    candidate = _candidate({"degreeLabel": ["Master"], "studyFieldLabel": 7, "endDate": "2020-06"})

    result = score_education(candidate, MASTER_CS)

    # Unknown degree 50, unknown field 50: the lower is 50, with the diploma as evidence.
    assert (result.score, result.diploma_index) == (50, 0)


def test_the_rationale_is_factual_and_never_reads_the_title_bio_or_certifications():
    candidate = _candidate(
        _diploma("Bachelor's degree", "Software Engineering"),
        title="Senior Staff Engineer, PhD",
        bio="Holds a Doctorate in Computer Science.",
        certifications=[{"name": "AWS Solutions Architect"}],
    )

    result = score_education(candidate, MASTER_CS)

    assert result.score == 65
    assert result.rationale == (
        "Bachelor's degree in Software Engineering: its degree is one level below the required level; "
        "its field of study is close to the required one."
    )


# --- analyze_matching: deterministic / model split ---------------------------


class StubAgent:
    """Stand-in for the compiled graph: records calls, replays canned results."""

    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    def invoke(self, payload, config):
        self.calls.append(payload)
        return self._results.pop(0)


def _education_criterion():
    return {
        "key": EDUCATION_CRITERION_KEY,
        "section": "education",
        "label": "Education",
        "requirement": "Degree level (one of, or above): Master's degree; Field of study (one of): Computer Science",
        "education": {"degreeLevels": ["Master's degree"], "credentials": [], "fields": ["Computer Science"]},
    }


def _request(**extra):
    return MatchingAnalyzeRequest(
        matching_id="m-42",
        candidate=_candidate(_diploma("Master's degree", "Computer Science"), skills=[{"name": "Java"}]),
        offer={"schemaVersion": "2"},
        criteria=[
            {"key": "skill:java", "section": "required_skills", "label": "Java"},
            _education_criterion(),
            {"key": "certification:aws", "section": "education", "label": "Certification: AWS"},
        ],
        **extra,
    )


def _assessment(key, score=50):
    evidence = [{"source": "skill", "index": 0}] if score > 0 else []
    return {"criterion_key": key, "score": score, "rationale": "Model.", "evidence": evidence}


def _model_analysis(*keys):
    return MatchingAnalysis(assessments=[_assessment(key) for key in keys])


def test_the_model_never_sees_the_education_criterion_and_the_results_are_merged_in_request_order(monkeypatch):
    stub = StubAgent([{"structured_response": _model_analysis("certification:aws", "skill:java"), "messages": []}])
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", lambda **_: stub)

    analysis = analyze_matching(_request())

    content = stub.calls[0]["messages"][0].content
    sent = json.loads(content[content.index("{") :])
    assert [criterion["key"] for criterion in sent["criteria"]] == ["skill:java", "certification:aws"]
    assert EDUCATION_CRITERION_KEY not in content
    assert "degreeLevels" not in content
    assert [assessment.criterion_key for assessment in analysis.assessments] == [
        "skill:java",
        EDUCATION_CRITERION_KEY,
        "certification:aws",
    ]
    education = analysis.assessments[1]
    assert (education.score, [(e.source, e.index) for e in education.evidence]) == (100, [("diploma", 0)])
    assert analysis.policy_version == POLICY_VERSION


def test_previous_assessments_sent_to_the_model_leave_out_education_and_clarifications_stay_whole(monkeypatch):
    stub = StubAgent([{"structured_response": _model_analysis("skill:java", "certification:aws"), "messages": []}])
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", lambda **_: stub)
    clarifications = [
        {"question": "Degree?", "answer": "A PhD.", "status": "answered"},
        {"question": "AWS?", "answer": None, "status": "skipped"},
    ]

    analysis = analyze_matching(
        _request(
            previous_assessments=[
                CriterionAssessment.model_validate(_assessment("skill:java", 40)),
                CriterionAssessment.model_validate(_assessment(EDUCATION_CRITERION_KEY, 0)),
                CriterionAssessment.model_validate(_assessment("certification:aws", 0)),
            ],
            clarifications=clarifications,
        )
    )

    content = stub.calls[0]["messages"][0].content
    sent = json.loads(content[content.index("{") :])
    assert [assessment["criterionKey"] for assessment in sent["previousAssessments"]] == [
        "skill:java",
        "certification:aws",
    ]
    assert len(sent["clarifications"]) == 2
    # An answered clarification never changes the education score (sheet only).
    assert analysis.assessments[1].score == 100


def test_without_any_model_criterion_no_agent_is_built(monkeypatch):
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", _no_model)

    analysis = analyze_matching(
        MatchingAnalyzeRequest(
            matching_id="m-42",
            candidate=_candidate(),
            offer={"schemaVersion": "2"},
            criteria=[_education_criterion()],
        )
    )

    assert [(a.criterion_key, a.score, a.evidence) for a in analysis.assessments] == [(EDUCATION_CRITERION_KEY, 0, [])]
    # Aucun appel au modèle : aucune provenance inventée.
    assert analysis.model_name is None


def test_an_education_key_invented_by_the_model_is_repaired_against_the_model_subset(monkeypatch):
    invented = _model_analysis("skill:java", "certification:aws", EDUCATION_CRITERION_KEY)
    stub = StubAgent(
        [
            {"structured_response": invented, "messages": [HumanMessage(content="history")]},
            {"structured_response": _model_analysis("skill:java", "certification:aws"), "messages": []},
        ]
    )
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", lambda **_: stub)

    analysis = analyze_matching(_request())

    assert len(stub.calls) == 2
    instruction = stub.calls[1]["messages"][-1].content
    assert f"Keys that are not criteria of this request (remove them): {EDUCATION_CRITERION_KEY}." in instruction
    # The deterministic score wins, never the model's.
    assert analysis.assessments[1].score == 100
    assert analysis.assessments[1].rationale != "Model."


def test_an_education_key_kept_by_the_model_after_the_repair_is_no_output(monkeypatch):
    invented = _model_analysis("skill:java", "certification:aws", EDUCATION_CRITERION_KEY)
    stub = StubAgent(
        [
            {"structured_response": invented, "messages": []},
            {"structured_response": invented, "messages": []},
        ]
    )
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", lambda **_: stub)

    with pytest.raises(MatchingAnalyzeError) as caught:
        analyze_matching(_request())

    assert caught.value.code == "no_output"
    assert len(stub.calls) == 2


def test_coverage_is_checked_against_the_model_subset_only(monkeypatch):
    # The model scores only its own criteria: education is never "missing" from its answer.
    stub = StubAgent(
        [
            {"structured_response": _model_analysis("skill:java"), "messages": []},
            {"structured_response": _model_analysis("skill:java", "certification:aws"), "messages": []},
        ]
    )
    monkeypatch.setattr("app.agents.matching_analyze.build_matching_agent", lambda **_: stub)

    analyze_matching(_request())

    instruction = stub.calls[1]["messages"][-1].content
    assert "Missing criterion keys: certification:aws." in instruction
    assert EDUCATION_CRITERION_KEY not in instruction


# --- Schemas -----------------------------------------------------------------


def test_the_education_criterion_needs_its_structured_requirement():
    criterion = _education_criterion()
    del criterion["education"]

    with pytest.raises(ValidationError, match="needs its structured education requirement"):
        MatchingCriterion.model_validate(criterion)


def test_no_other_criterion_carries_an_education_requirement():
    with pytest.raises(ValidationError, match="only the education:requirement criterion"):
        MatchingCriterion.model_validate(
            {
                "key": "certification:aws",
                "section": "education",
                "label": "Certification: AWS",
                "education": {"degreeLevels": ["Master's degree"]},
            }
        )
    # null is accepted: the backend sends "education": null for every other criterion.
    assert MatchingCriterion.model_validate(
        {"key": "certification:aws", "section": "education", "label": "AWS", "education": None}
    ).education is None


def test_an_education_requirement_needs_at_least_one_dimension():
    criterion = _education_criterion()
    criterion["education"] = {"degreeLevels": [], "credentials": [], "fields": []}

    with pytest.raises(ValidationError, match="at least one dimension"):
        MatchingCriterion.model_validate(criterion)


@pytest.mark.parametrize(
    "education",
    [
        {"degreeLevels": [""]},
        {"degreeLevels": [" "]},
        {"credentials": [""]},
        {"fields": [""]},
    ],
)
def test_an_education_requirement_rejects_blank_values(education):
    # The backend strips empty catalogue labels, so production never sends one;
    # the contract refuses them instead of scoring a dimension that is not one.
    criterion = _education_criterion()
    criterion["education"] = education

    with pytest.raises(ValidationError, match="must not be blank"):
        MatchingCriterion.model_validate(criterion)


def test_the_education_criterion_belongs_to_the_education_section():
    criterion = _education_criterion()
    criterion["section"] = "required_skills"

    with pytest.raises(ValidationError, match="belongs to the education section"):
        MatchingCriterion.model_validate(criterion)
