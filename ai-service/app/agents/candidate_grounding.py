"""Grounding of the mined facts of a candidate profile (D109).

The candidate sheet is the evidence the matching scores: a skill, a
language, a diploma or a certification it carries can be cited against a
criterion. A fact the candidate's own texts do not name has no business
there.

What is checked, and what is not:

- an inferred skill, language, diploma or certification is kept only when
  the profile's texts name it;
- a CEFR level is kept only when the profile's texts state it;
- the mined lists (responsibilities, achievements, technologies), the
  summary and the seniority are never checked: the prompt itself asks the
  model to compose them from the profile's wording, so a coverage
  threshold would arbitrate between a rewrite and an invention.

The declared facts are never touched: they come from the candidate's own
stored sections, not from the texts.

Removing an entry shifts the indices the other entries point to: the
diplomas and the certifications are mixed (declared and mined), so the
evidence pointers are re-indexed after the removals. A pointer whose
target is gone is dropped — the matcher rejects an evidence that leaves
the sheet.
"""

from __future__ import annotations

from app.agents.grounding import Corpus, GroundingReport, remap_evidence
from app.schemas.normalize import CandidateProfile, NormalizedDiploma, NormalizedProfile

# The links whose type the backend resolves to a certification.
CERTIFICATION_LINK_TYPE = "certification"


def candidate_corpus(profile: CandidateProfile) -> Corpus:
    """The candidate's own texts: bio, descriptions, diploma titles, certifications.

    The stored skills, languages and levels are left out: they are the
    candidate's structured sections, not something the texts may prove.
    """
    texts: list[str] = []
    if profile.about is not None and profile.about.bio:
        texts.append(profile.about.bio)
    for experience in profile.experiences:
        if experience.description:
            texts.append(experience.description)
    for project in profile.projects:
        if project.description:
            texts.append(project.description)
    for diploma in profile.diplomas:
        if diploma.title:
            texts.append(diploma.title)
    for link in profile.links:
        if link.label and (link.link_type or "").lower() == CERTIFICATION_LINK_TYPE:
            texts.append(link.label)
    return Corpus(texts)


def _diploma_label(diploma: NormalizedDiploma) -> str:
    """The wording of a diploma that the texts must name."""
    return diploma.title or diploma.study_field_label or diploma.degree_label or ""


def _ground_diplomas(
    sheet: NormalizedProfile, corpus: Corpus, report: GroundingReport
) -> dict[int, int | None]:
    """Keep only the mined diplomas the profile names, and map their indices."""
    kept: list[NormalizedDiploma] = []
    index_map: dict[int, int | None] = {}
    for index, diploma in enumerate(sheet.diplomas):
        if diploma.origin == "inferred" and not corpus.anchors(_diploma_label(diploma)):
            report.dropped += 1
            index_map[index] = None
            continue
        index_map[index] = len(kept)
        kept.append(diploma)
    sheet.diplomas = kept
    return index_map


def _ground_certifications(
    sheet: NormalizedProfile, corpus: Corpus, report: GroundingReport
) -> dict[int, int | None]:
    """Keep only the mined certifications the profile names, and map their indices."""
    kept = []
    index_map: dict[int, int | None] = {}
    for index, certification in enumerate(sheet.certifications):
        if certification.origin == "inferred" and not corpus.anchors(certification.name):
            report.dropped += 1
            index_map[index] = None
            continue
        index_map[index] = len(kept)
        kept.append(certification)
    sheet.certifications = kept
    return index_map


def _remap_evidence(sheet: NormalizedProfile, index_maps: dict[str, dict[int, int | None]]) -> None:
    """Re-index every evidence pointer of the sheet after the removals."""
    for skill in sheet.skills:
        skill.evidence = remap_evidence(skill.evidence, index_maps)
    for language in sheet.languages:
        language.evidence = remap_evidence(language.evidence, index_maps)
    for diploma in sheet.diplomas:
        diploma.evidence = remap_evidence(diploma.evidence, index_maps)
    for certification in sheet.certifications:
        certification.evidence = remap_evidence(certification.evidence, index_maps)


def _ground_skills(sheet: NormalizedProfile, corpus: Corpus, report: GroundingReport) -> None:
    """Keep only the mined skills the profile names."""
    kept = []
    for skill in sheet.skills:
        if skill.origin == "inferred" and not corpus.anchors(skill.name):
            report.dropped += 1
            continue
        kept.append(skill)
    sheet.skills = kept


def _ground_languages(sheet: NormalizedProfile, corpus: Corpus, report: GroundingReport) -> None:
    """Keep only the mined languages the profile names, with a stated level."""
    kept = []
    for language in sheet.languages:
        if language.origin == "inferred":
            if not corpus.anchors(language.name):
                report.dropped += 1
                continue
            if language.level is not None and not corpus.mentions_level(language.level):
                language.level = None
                report.nullified += 1
        kept.append(language)
    sheet.languages = kept


def ground_candidate(
    sheet: NormalizedProfile, profile: CandidateProfile
) -> tuple[NormalizedProfile, GroundingReport]:
    """Ground the mined facts of a candidate sheet in the candidate's own texts.

    Returns the grounded sheet and what was removed. The sheet is modified
    in place: the pipeline hands it straight to the backend.
    """
    corpus = candidate_corpus(profile)
    report = GroundingReport()
    diploma_map = _ground_diplomas(sheet, corpus, report)
    certification_map = _ground_certifications(sheet, corpus, report)
    _remap_evidence(sheet, {"diploma": diploma_map, "certification": certification_map})
    _ground_skills(sheet, corpus, report)
    _ground_languages(sheet, corpus, report)
    return sheet, report
