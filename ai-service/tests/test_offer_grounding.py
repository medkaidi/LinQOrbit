"""Grounding of the offer facts (D109): what the offer's own texts support.

No LLM call: the sheets are built by hand.
"""

from app.agents.offer_grounding import ground_offer
from app.schemas.job_offer import (
    JobOfferSnapshot,
    NormalizedJobOffer,
    OfferCertification,
    OfferRequirementEntry,
    OfferSkillEvidence,
    OfferSkillRequirement,
    JobOfferLanguageRequirement,
)

DESCRIPTION = (
    "You will own our public API built with Java and PostgreSQL, and operate our "
    "Kubernetes platform. 5 years of professional experience required. English at C1."
)


def _offer(description: str = DESCRIPTION) -> JobOfferSnapshot:
    return JobOfferSnapshot(
        title="Senior Backend Engineer",
        description=description,
        company={"name": "Acme", "description": "We build payment infrastructure."},
    )


def _skill(name: str, origin: str = "inferred", **kwargs) -> OfferSkillRequirement:
    return OfferSkillRequirement(
        name=name,
        category=kwargs.pop("category", "tool"),
        weight=kwargs.pop("weight", 3),
        origin=origin,
        **kwargs,
    )


def test_an_inferred_skill_the_offer_does_not_name_is_dropped():
    sheet = NormalizedJobOffer(
        required_skills=[_skill("Java"), _skill("Rust")],
        responsibilities=[
            {"text": "Own the public API", "importance": "mandatory", "weight": 5},
        ],
    )

    grounded, report = ground_offer(sheet, _offer())

    assert [skill.name for skill in grounded.required_skills] == ["Java"]
    assert report.dropped == 1
    assert report.nullified == 0


def test_a_declared_skill_is_never_touched():
    sheet = NormalizedJobOffer(required_skills=[_skill("Rust", origin="declared")])

    grounded, report = ground_offer(sheet, _offer())

    assert [skill.name for skill in grounded.required_skills] == ["Rust"]
    assert report.touched == 0


def test_the_responsibilities_are_never_amputated():
    sheet = NormalizedJobOffer(
        responsibilities=[
            {"text": "Own the public API", "importance": "mandatory", "weight": 5},
            {"text": "Operate the Kubernetes platform", "importance": "optional", "weight": 2},
        ],
        required_skills=[
            _skill("Kubernetes", evidence=[OfferSkillEvidence(source="responsibility", index=1)]),
        ],
    )

    grounded, _ = ground_offer(sheet, _offer())

    assert len(grounded.responsibilities) == 2
    assert grounded.required_skills[0].evidence[0].index == 1


def test_an_inferred_language_the_offer_does_not_name_is_dropped():
    sheet = NormalizedJobOffer(
        languages=[
            JobOfferLanguageRequirement(name="English", level="C1", origin="inferred"),
            JobOfferLanguageRequirement(name="German", level=None, origin="inferred"),
        ]
    )

    grounded, report = ground_offer(sheet, _offer())

    assert [language.name for language in grounded.languages] == ["English"]
    assert report.dropped == 1


def test_a_declared_language_is_never_touched():
    sheet = NormalizedJobOffer(
        languages=[JobOfferLanguageRequirement(name="German", level="B2", origin="declared")]
    )

    grounded, report = ground_offer(sheet, _offer())

    assert [language.name for language in grounded.languages] == ["German"]
    assert report.touched == 0


def test_a_level_the_offer_does_not_state_is_erased_but_the_language_stays():
    sheet = NormalizedJobOffer(
        languages=[
            JobOfferLanguageRequirement(name="English", level="C2", origin="inferred"),
        ]
    )

    grounded, report = ground_offer(sheet, _offer())

    assert grounded.languages[0].name == "English"
    assert grounded.languages[0].level is None
    assert report.nullified == 1


def test_an_inferred_degree_the_offer_does_not_name_is_dropped():
    sheet = NormalizedJobOffer(
        required_degrees=[
            OfferRequirementEntry(label="Master's degree", source="inferred"),
            OfferRequirementEntry(label="PhD in Quantum Physics", source="inferred"),
        ]
    )

    grounded, report = ground_offer(
        sheet, _offer("A Master's degree in Computer Science is required.")
    )

    assert [entry.label for entry in grounded.required_degrees] == ["Master's degree"]
    assert report.dropped == 1


def test_a_declared_degree_is_never_touched():
    sheet = NormalizedJobOffer(
        required_degrees=[OfferRequirementEntry(label="Master's degree", source="declared")]
    )

    grounded, report = ground_offer(sheet, _offer())

    assert [entry.label for entry in grounded.required_degrees] == ["Master's degree"]
    assert report.touched == 0


def test_a_study_field_the_offer_does_not_name_is_dropped():
    sheet = NormalizedJobOffer(
        required_study_fields=[OfferRequirementEntry(label="Quantum Physics", source="inferred")]
    )

    grounded, report = ground_offer(sheet, _offer())

    assert grounded.required_study_fields == []
    assert report.dropped == 1


def test_a_certification_the_offer_does_not_name_is_dropped():
    sheet = NormalizedJobOffer(
        certifications=[
            OfferCertification(name="AWS Solutions Architect"),
            OfferCertification(name="Certified Kubernetes Administrator"),
        ]
    )

    grounded, report = ground_offer(sheet, _offer())

    # The offer mentions Kubernetes: the name shares that token, so it is
    # anchored. The anchoring proves that the offer names the fact, not
    # that the fact is a requirement — a directive inside the text is
    # handled by the prompt guard, not here.
    assert [certification.name for certification in grounded.certifications] == [
        "Certified Kubernetes Administrator"
    ]
    assert report.dropped == 1


def test_an_inferred_total_experience_the_offer_does_not_state_is_erased():
    sheet = NormalizedJobOffer(required_years=10, required_years_source="inferred")

    grounded, report = ground_offer(sheet, _offer())

    assert grounded.required_years is None
    assert grounded.required_years_source is None
    assert report.nullified == 1


def test_an_inferred_total_experience_the_offer_states_is_kept():
    sheet = NormalizedJobOffer(required_years=5, required_years_source="inferred")

    grounded, report = ground_offer(sheet, _offer())

    assert grounded.required_years == 5
    assert grounded.required_years_source == "inferred"
    assert report.touched == 0


def test_a_declared_total_experience_is_never_touched():
    sheet = NormalizedJobOffer(required_years=10, required_years_source="declared")

    grounded, report = ground_offer(sheet, _offer())

    assert grounded.required_years == 10
    assert report.touched == 0


def test_an_inferred_minimum_years_the_offer_does_not_state_is_erased():
    sheet = NormalizedJobOffer(
        required_skills=[
            _skill("Java", min_years=8, min_years_source="inferred"),
        ]
    )

    grounded, report = ground_offer(sheet, _offer())

    assert grounded.required_skills[0].min_years is None
    assert grounded.required_skills[0].min_years_source is None
    assert report.nullified == 1


def test_a_declared_minimum_years_is_never_touched():
    sheet = NormalizedJobOffer(
        required_skills=[
            _skill("Java", min_years=8, min_years_source="declared"),
        ]
    )

    grounded, report = ground_offer(sheet, _offer())

    assert grounded.required_skills[0].min_years == 8
    assert report.touched == 0


def test_the_mined_lists_are_never_checked():
    sheet = NormalizedJobOffer(
        summary="A role that does not exist.",
        benefits=["A yacht"],
        alternate_titles=["Backend Wizard"],
        responsibilities=[
            {"text": "Nothing of the offer", "importance": "optional", "weight": 1},
        ],
    )

    grounded, report = ground_offer(sheet, _offer())

    assert grounded.summary == "A role that does not exist."
    assert grounded.benefits == ["A yacht"]
    assert grounded.alternate_titles == ["Backend Wizard"]
    assert len(grounded.responsibilities) == 1
    assert report.touched == 0


def test_the_grounding_is_idempotent():
    sheet = NormalizedJobOffer(
        required_skills=[_skill("Java"), _skill("Rust")],
        languages=[JobOfferLanguageRequirement(name="English", level="C1", origin="inferred")],
    )

    once, _ = ground_offer(sheet, _offer())
    twice, _ = ground_offer(once, _offer())

    assert once == twice


def test_an_offer_without_any_text_keeps_only_the_declared_facts():
    sheet = NormalizedJobOffer(
        required_skills=[_skill("Java", origin="declared"), _skill("Rust")],
    )

    grounded, report = ground_offer(sheet, JobOfferSnapshot())

    assert [skill.name for skill in grounded.required_skills] == ["Java"]
    assert report.dropped == 1
