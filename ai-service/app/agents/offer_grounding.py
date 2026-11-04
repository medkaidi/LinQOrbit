"""Grounding of the mined facts of a job offer (D109).

The offer sheet is the reference grid of the matching: every skill,
language, degree, certification and year of experience it carries becomes
a criterion the candidates are scored against. A fact that the offer's own
texts do not name has no business in that grid.

What is checked, and what is not:

- an inferred skill, language, degree, study field or certification is kept
  only when the offer's texts name it;
- a CEFR level and a number of years of experience are kept only when the
  offer's texts state them;
- the mined lists (responsibilities, technologies, achievements), the
  summary, the benefits and the alternate titles are never checked: the
  prompt itself asks the model to enrich them from the offer's wording, so
  a coverage threshold would arbitrate between a rewrite and an invention.
  They carry no weight in the grid either — the backend builds the criteria
  from the skills, the languages, the degrees, the certifications and the
  required years only.

The declared facts are never touched: they come from the recruiter's own
stored criteria, not from the texts.
"""

from __future__ import annotations

from app.agents.grounding import Corpus, GroundingReport
from app.schemas.job_offer import JobOfferSnapshot, NormalizedJobOffer


def offer_corpus(offer: JobOfferSnapshot) -> Corpus:
    """The offer's own texts: the title, the description and the company pitch.

    The stored skills, languages and labels are left out: they are the
    recruiter's structured criteria, not something the texts may prove.
    """
    return Corpus(
        [
            offer.title or "",
            offer.description or "",
            offer.company.description if offer.company is not None else "",
        ]
    )


def _ground_skills(sheet: NormalizedJobOffer, corpus: Corpus, report: GroundingReport) -> None:
    """Keep only the inferred skills the offer names, with a stated duration."""
    for group in (sheet.required_skills, sheet.preferred_skills):
        kept = []
        for skill in group:
            if skill.origin == "inferred" and not corpus.anchors(skill.name):
                report.dropped += 1
                continue
            if skill.min_years_source == "inferred" and skill.min_years is not None:
                if not corpus.mentions_duration(skill.min_years):
                    skill.min_years = None
                    skill.min_years_source = None
                    report.nullified += 1
            kept.append(skill)
        group[:] = kept


def _ground_languages(sheet: NormalizedJobOffer, corpus: Corpus, report: GroundingReport) -> None:
    """Keep only the inferred languages the offer names, with a stated level."""
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


def _ground_requirements(sheet: NormalizedJobOffer, corpus: Corpus, report: GroundingReport) -> None:
    """Keep only the education requirements the offer states."""
    for requirements in (sheet.required_degrees, sheet.required_study_fields):
        kept = []
        for requirement in requirements:
            if requirement.source == "inferred" and not corpus.anchors(requirement.label):
                report.dropped += 1
                continue
            kept.append(requirement)
        requirements[:] = kept


def _ground_certifications(sheet: NormalizedJobOffer, corpus: Corpus, report: GroundingReport) -> None:
    """Keep only the certifications the offer names.

    The offer sheet carries no stored certification criterion: every
    certification of the sheet is mined from the texts, so every one of
    them is checked.
    """
    kept = []
    for certification in sheet.certifications:
        if not corpus.anchors(certification.name):
            report.dropped += 1
            continue
        kept.append(certification)
    sheet.certifications = kept


def _ground_required_years(sheet: NormalizedJobOffer, corpus: Corpus, report: GroundingReport) -> None:
    """Keep the total experience only when the offer states it."""
    if sheet.required_years_source != "inferred" or sheet.required_years is None:
        return
    if not corpus.mentions_duration(sheet.required_years):
        sheet.required_years = None
        sheet.required_years_source = None
        report.nullified += 1


def ground_offer(
    sheet: NormalizedJobOffer, offer: JobOfferSnapshot
) -> tuple[NormalizedJobOffer, GroundingReport]:
    """Ground the mined facts of an offer sheet in the offer's own texts.

    Returns the grounded sheet and what was removed. The sheet is modified
    in place: the pipeline hands it straight to the backend.
    """
    corpus = offer_corpus(offer)
    report = GroundingReport()
    _ground_skills(sheet, corpus, report)
    _ground_languages(sheet, corpus, report)
    _ground_requirements(sheet, corpus, report)
    _ground_certifications(sheet, corpus, report)
    _ground_required_years(sheet, corpus, report)
    return sheet, report
