"""Grounding of the candidate facts (D109): what the candidate's own texts support.

No LLM call: the profiles and the sheets are built by hand.
"""

from app.agents.candidate_grounding import ground_candidate
from app.schemas.normalize import (
    CandidateProfile,
    NormalizedCertification,
    NormalizedDiploma,
    NormalizedLanguage,
    NormalizedProfile,
    NormalizedSkill,
    ProfileAbout,
    ProfileDiploma,
    ProfileExperience,
    ProfileLink,
    ProfileLocation,
    ProfileProject,
    SkillEvidence,
)

BIO = "Backend developer with six years of APIs and PostgreSQL. English at C1."
EXPERIENCE = "Owned the public API in Java and PostgreSQL."
PROJECT = "Rebuilt the dashboard in React."


def _profile() -> CandidateProfile:
    return CandidateProfile(
        about=ProfileAbout(bio=BIO),
        experiences=[ProfileExperience(position_title="Backend Engineer", description=EXPERIENCE)],
        projects=[ProfileProject(name="Dashboard", description=PROJECT)],
        diplomas=[ProfileDiploma(title="MSc Computer Science")],
        links=[ProfileLink(label="AWS Solutions Architect", link_type="certification")],
    )


def _skill(name: str, origin: str = "inferred", evidence=None) -> NormalizedSkill:
    return NormalizedSkill(
        name=name,
        category="tool",
        origin=origin,
        evidence=list(evidence or []),
    )


def _diploma(title: str, origin: str = "inferred", evidence=None) -> NormalizedDiploma:
    return NormalizedDiploma(
        title=title,
        institution="Sorbonne University",
        start_date="2016-09",
        end_date="2018-06",
        origin=origin,
        evidence=list(evidence or []),
    )


def _certification(name: str, origin: str = "inferred", evidence=None) -> NormalizedCertification:
    return NormalizedCertification(
        name=name,
        origin=origin,
        evidence=list(evidence or []),
    )


def test_an_inferred_skill_the_profile_does_not_name_is_dropped():
    sheet = NormalizedProfile(skills=[_skill("PostgreSQL"), _skill("Rust")])

    grounded, report = ground_candidate(sheet, _profile())

    assert [skill.name for skill in grounded.skills] == ["PostgreSQL"]
    assert report.dropped == 1


def test_a_declared_skill_is_never_touched():
    sheet = NormalizedProfile(skills=[_skill("Rust", origin="declared")])

    grounded, report = ground_candidate(sheet, _profile())

    assert [skill.name for skill in grounded.skills] == ["Rust"]
    assert report.touched == 0


def test_every_text_of_the_profile_can_anchor_a_skill():
    sheet = NormalizedProfile(
        skills=[_skill("React"), _skill("Java"), _skill("MSc Computer Science")]
    )

    grounded, _ = ground_candidate(sheet, _profile())

    assert [skill.name for skill in grounded.skills] == ["React", "Java", "MSc Computer Science"]


def test_an_inferred_language_the_profile_does_not_name_is_dropped():
    sheet = NormalizedProfile(
        languages=[
            NormalizedLanguage(name="English", level="C1", origin="inferred"),
            NormalizedLanguage(name="German", level=None, origin="inferred"),
        ]
    )

    grounded, report = ground_candidate(sheet, _profile())

    assert [language.name for language in grounded.languages] == ["English"]
    assert report.dropped == 1


def test_a_level_the_profile_does_not_state_is_erased_but_the_language_stays():
    sheet = NormalizedProfile(
        languages=[NormalizedLanguage(name="English", level="C2", origin="inferred")]
    )

    grounded, report = ground_candidate(sheet, _profile())

    assert grounded.languages[0].name == "English"
    assert grounded.languages[0].level is None
    assert report.nullified == 1


def test_a_declared_language_is_never_touched():
    sheet = NormalizedProfile(
        languages=[NormalizedLanguage(name="German", level="B2", origin="declared")]
    )

    grounded, report = ground_candidate(sheet, _profile())

    assert grounded.languages[0].level == "B2"
    assert report.touched == 0


def test_an_inferred_diploma_the_profile_does_not_name_is_dropped():
    sheet = NormalizedProfile(
        diplomas=[
            _diploma("MSc Computer Science"),
            _diploma("PhD in Quantum Physics"),
        ]
    )

    grounded, report = ground_candidate(sheet, _profile())

    assert [diploma.title for diploma in grounded.diplomas] == ["MSc Computer Science"]
    assert report.dropped == 1


def test_a_declared_diploma_is_never_touched():
    sheet = NormalizedProfile(diplomas=[_diploma("PhD in Quantum Physics", origin="declared")])

    grounded, report = ground_candidate(sheet, _profile())

    assert [diploma.title for diploma in grounded.diplomas] == ["PhD in Quantum Physics"]
    assert report.touched == 0


def test_an_inferred_certification_the_profile_does_not_name_is_dropped():
    sheet = NormalizedProfile(
        certifications=[
            _certification("AWS Solutions Architect"),
            _certification("Certified Kubernetes Administrator"),
        ]
    )

    grounded, report = ground_candidate(sheet, _profile())

    assert [certification.name for certification in grounded.certifications] == [
        "AWS Solutions Architect"
    ]
    assert report.dropped == 1


def test_a_declared_certification_is_never_touched():
    sheet = NormalizedProfile(
        certifications=[_certification("Certified Kubernetes Administrator", origin="declared")]
    )

    grounded, report = ground_candidate(sheet, _profile())

    assert len(grounded.certifications) == 1
    assert report.touched == 0


def test_the_evidence_is_reindexed_after_a_diploma_is_dropped():
    sheet = NormalizedProfile(
        diplomas=[
            _diploma("PhD in Quantum Physics"),
            _diploma("MSc Computer Science"),
        ],
        skills=[
            _skill("PostgreSQL", evidence=[SkillEvidence(source="diploma", index=1)]),
        ],
    )

    grounded, _ = ground_candidate(sheet, _profile())

    assert len(grounded.diplomas) == 1
    assert grounded.skills[0].evidence[0].index == 0


def test_the_evidence_of_a_dropped_entry_is_dropped():
    sheet = NormalizedProfile(
        diplomas=[
            _diploma("PhD in Quantum Physics"),
            _diploma("MSc Computer Science"),
        ],
        skills=[
            _skill("PostgreSQL", evidence=[SkillEvidence(source="diploma", index=0)]),
        ],
    )

    grounded, _ = ground_candidate(sheet, _profile())

    assert grounded.skills[0].evidence == []


def test_the_evidence_of_a_certification_is_reindexed():
    sheet = NormalizedProfile(
        certifications=[
            _certification("Certified Kubernetes Administrator"),
            _certification("AWS Solutions Architect"),
        ],
        skills=[
            _skill("PostgreSQL", evidence=[SkillEvidence(source="certification", index=1)]),
        ],
    )

    grounded, _ = ground_candidate(sheet, _profile())

    assert len(grounded.certifications) == 1
    assert grounded.skills[0].evidence[0].index == 0


def test_the_evidence_that_points_nowhere_is_dropped():
    sheet = NormalizedProfile(
        skills=[
            _skill("PostgreSQL", evidence=[SkillEvidence(source="diploma", index=7)]),
            _skill("React", evidence=[SkillEvidence(source="bio")]),
        ],
    )

    grounded, _ = ground_candidate(sheet, _profile())

    assert grounded.skills[0].evidence == []
    assert [(entry.source, entry.index) for entry in grounded.skills[1].evidence] == [("bio", None)]


def test_the_mined_lists_are_never_checked():
    sheet = NormalizedProfile(
        summary="A summary the profile does not say.",
        experiences=[
            {
                "position_title": "Backend Engineer",
                "company_name": "Acme",
                "start_date": "2021-03",
                "responsibilities": ["Own things that do not exist"],
            }
        ],
    )

    grounded, report = ground_candidate(sheet, _profile())

    assert grounded.summary == "A summary the profile does not say."
    assert grounded.experiences[0].responsibilities == ["Own things that do not exist"]
    assert report.touched == 0


def test_the_grounding_is_idempotent():
    sheet = NormalizedProfile(
        skills=[_skill("PostgreSQL"), _skill("Rust")],
        diplomas=[_diploma("MSc Computer Science"), _diploma("PhD in Quantum Physics")],
    )

    once, _ = ground_candidate(sheet, _profile())
    twice, _ = ground_candidate(once, _profile())

    assert once == twice


def test_a_profile_without_any_text_keeps_only_the_declared_facts():
    sheet = NormalizedProfile(
        skills=[_skill("Rust", origin="declared"), _skill("Rust")],
        languages=[NormalizedLanguage(name="English", level="C1", origin="inferred")],
    )

    grounded, report = ground_candidate(sheet, CandidateProfile())

    assert [skill.name for skill in grounded.skills] == ["Rust"]
    assert grounded.languages == []
    assert report.dropped == 2
