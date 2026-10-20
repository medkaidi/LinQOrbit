"""Comparison policy of the matching agent (D58) — the ONLY module to replace
when the definitive scoring policy is defined.

The policy says how a criterion present in the candidate sheet turns into a
0-100 score. Everything else (contract, evidence discipline, relevant
experience, "absent = 0") lives in ``matching_agent`` and survives a policy
change. Bump ``POLICY_VERSION`` with any change of ``POLICY_RULES`` or of the
deterministic education scoring: every stored result records the version
that produced it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# "education-2" (D68): the skills, languages and experience rules are those of
# skills-3, word for word (skills-1 values; skills-2 made a declared level a
# known measure even without proven use; skills-3 made an answered
# clarification count as proven use, never as a level, and forbade scoring 0 a
# related technology proven by use). Education is scored IN CODE on the joint
# education criterion (``score_education``): the model never sees it, so the
# prompt carries no education rule. The certification rule of skills-3 comes
# back as a full Certifications block. education-1 (education bands in the
# prompt) was never validated: it degraded the skills bands.
POLICY_VERSION = "education-2"

POLICY_RULES = """Scoring policy (education-2). The offer criterion text states the
expectation ("level 4/5", "at least 3 years"); an expectation it does not
state does not exist. Only measures present on both sides are compared. Never
invent a value the candidate sheet does not state, and never penalise a
measure that is missing on one side.

Skills — deterministic bands:
- Level (both levels known, 1-5 scale), d = candidate level - expected level:
  d >= 0 -> 100; d = -1 -> 75; d = -2 -> 50; d <= -3 -> 25.
- Years (expected years > 0 and candidate yearsExperience known),
  r = candidate years / expected years:
  r >= 1 -> 100; 0.66 <= r < 1 -> 80; 0.33 <= r < 0.66 -> 55; r < 0.33 -> 30.
- Both bands available: the score is the LOWER of the two (the unmet
  expectation drives the score). One band unavailable: ignore it only.
- No band available (the criterion states no measure, or the sheet has none):
  level known -> 5: 100, 4: 85, 3: 70, 2: 55, 1: 40;
  level unknown but use proven by an experience, a project, or an answered
  clarification -> 60; an answer that states no level does not prove a level;
  level unknown and only listed (skills index or bio) -> 35.
  A level present on the candidate sheet is a known measure even when the
  offer states no level and no usage is proven: apply the level-known presence
  band. The bare-mention band applies only when the candidate's level is
  unknown.
- Synonyms and true equivalents are the skill itself (Postgres = PostgreSQL).
- A different technology of the same family is 40-50 at most, and only when
  that technology is itself proven by use (MySQL vs PostgreSQL, Vue vs React,
  Kotlin vs Java). Java/JavaScript and C#/C++ are not related. A related
  technology is never a full match. A related technology proven by use is
  never scored 0: the exact skill may be absent from the sheet, the 40-50 band
  still applies.
- Never infer a skill from a job title, a company, the seniority or the total
  career length.

Languages:
- Compare CEFR levels: meeting or exceeding the expectation is 100; one level
  below 70-90; two levels below 40-60; three or more below 10-30. A language
  without a stated level is scored on its evidence only (a bare mention
  10-30).

Experience:
- Compare the RELEVANT years you computed (see the contract) with the required
  years. Meeting them is 100; then decrease in proportion to the gap.

Certifications — separate criteria:
- A certification criterion names ONE certification the offer expects. The
  candidate's certifications array is the only source: a diploma, a field, a
  skill, a title, an experience or the seniority never proves one.
- The same certification (same name or a true synonym) -> 100.
- A closely related certification (same vendor and family, an adjacent scope
  or level) -> 40-50 at most; never a full match.
- Any other certification, or none -> 0, with no evidence.
- An answered clarification that names the certification is a valid
  declaration (source "clarification"); it never turns a related
  certification into an exact one.
- A degree never replaces a certification."""


# --- Education, scored in code (D67 bands, D68) --------------------------------


@dataclass(frozen=True)
class EducationScore:
    """Deterministic score of the joint education criterion."""

    score: int
    rationale: str
    diploma_index: int | None


@dataclass(frozen=True)
class EducationRequirement:
    """Structured requirement: alternatives within each dimension."""

    degree_levels: tuple[str, ...]
    credentials: tuple[str, ...]
    fields: tuple[str, ...]


DEGREE_RANKS = {
    "high school": 1,
    "associate": 2, "associate degree": 2, "associate's degree": 2,
    "bachelor": 3, "bachelor's degree": 3, "bachelors degree": 3, "bsc": 3, "ba": 3,
    "master": 4, "master's degree": 4, "masters degree": 4, "msc": 4, "ma": 4, "mba": 4,
    "doctorate": 5, "phd": 5, "doctor of philosophy": 5,
}

FIELD_FAMILIES = {
    "computing": {"computer science", "information systems", "software engineering"},
    "finance": {"finance", "accounting", "economics"},
    "management": {"business administration", "management"},
}

# A credential of the catalogue, never a degree level.
PROFESSIONAL_CERTIFICATE = "professional certificate"


def _normalize(value: object) -> str | None:
    """Case, apostrophes, spaces and punctuation folded; ``None`` for a missing or non-text label."""
    if not isinstance(value, str):
        return None
    # Apostrophes vanish ("master's" = "masters"), any other punctuation splits words.
    folded = re.sub(r"[^a-z0-9]", " ", re.sub(r"['’]", "", value.lower()))
    folded = " ".join(folded.split())
    return folded or None


_RANKS = {_normalize(label): rank for label, rank in DEGREE_RANKS.items()}
_FAMILIES = {_normalize(field): family for family, fields in FIELD_FAMILIES.items() for field in fields}
_CREDENTIAL = _normalize(PROFESSIONAL_CERTIFICATE)


@dataclass(frozen=True)
class _Diploma:
    index: int
    degree: str | None
    field: str | None
    rank: int | None
    end: str
    degree_label: str | None
    field_label: str | None


def _obtained_diplomas(candidate: dict) -> tuple[list[_Diploma], int]:
    """Obtained diplomas (non-empty endDate) with their original index, and how many are ongoing."""
    entries = candidate.get("diplomas") if isinstance(candidate, dict) else None
    if not isinstance(entries, list):
        return [], 0
    obtained: list[_Diploma] = []
    ongoing = 0
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue
        end = entry.get("endDate")
        if not isinstance(end, str) or not end.strip():
            ongoing += 1
            continue
        degree_label = entry.get("degreeLabel") if isinstance(entry.get("degreeLabel"), str) else None
        field_label = entry.get("studyFieldLabel") if isinstance(entry.get("studyFieldLabel"), str) else None
        degree = _normalize(degree_label)
        obtained.append(
            _Diploma(
                index=index,
                degree=degree,
                field=_normalize(field_label),
                rank=_RANKS.get(degree) if degree else None,
                end=end.strip(),
                degree_label=degree_label.strip() if degree_label and degree_label.strip() else None,
                field_label=field_label.strip() if field_label and field_label.strip() else None,
            )
        )
    return obtained, ongoing


def _level_score(diploma: _Diploma, required_rank: int | None) -> tuple[int, str]:
    if diploma.degree == _CREDENTIAL:
        return 0, "a Professional certificate is a credential, not a degree level"
    if diploma.degree is None or diploma.rank is None:
        return 50, "its degree level is not stated, so it counts as partial"
    if required_rank is None:
        return 50, "the required degree level is not a known level, so it counts as partial"
    gap = required_rank - diploma.rank
    if gap <= 0:
        return 100, "its degree level meets or exceeds the required level"
    if gap == 1:
        return 65, "its degree is one level below the required level"
    if gap == 2:
        return 35, "its degree is two levels below the required level"
    return 0, "its degree is three or more levels below the required level"


def _credential_score(diploma: _Diploma, credentials: set[str]) -> tuple[int, str]:
    if diploma.degree is not None and diploma.degree in credentials:
        return 100, "it is the required Professional certificate"
    return 0, "it is not the required Professional certificate"


def _field_score(diploma: _Diploma, fields: set[str]) -> tuple[int, str]:
    if diploma.field is None:
        return 50, "its field of study is not stated"
    if diploma.field in fields:
        return 100, "its field of study matches exactly"
    family = _FAMILIES.get(diploma.field)
    if family is not None and any(_FAMILIES.get(field) == family for field in fields):
        return 75, "its field of study is close to the required one"
    return 25, "its field of study is distant from the required one"


def _score_diploma(
    diploma: _Diploma, requirement: EducationRequirement, required_rank: int | None
) -> tuple[int, list[str]]:
    """Final score of one diploma = the LOWER of its requested dimensions; the reasons that set it."""
    dimensions: list[tuple[int, str]] = []
    credentials = {_normalize(value) for value in requirement.credentials} - {None}
    if requirement.degree_levels or credentials:
        # Degree levels and credentials are alternatives of one dimension: keep the best.
        alternatives: list[tuple[int, str]] = []
        if requirement.degree_levels:
            alternatives.append(_level_score(diploma, required_rank))
        if credentials:
            alternatives.append(_credential_score(diploma, credentials))
        dimensions.append(max(alternatives, key=lambda alternative: alternative[0]))
    fields = {_normalize(value) for value in requirement.fields} - {None}
    if requirement.fields:
        dimensions.append(_field_score(diploma, fields))
    if not dimensions:
        return 0, ["no education dimension is stated"]
    score = min(dimension[0] for dimension in dimensions)
    # The decisive constraint first: the dimension(s) that set the final score.
    reasons = [reason for value, reason in dimensions if value == score] + [
        reason for value, reason in dimensions if value != score
    ]
    return score, reasons


def _describe(diploma: _Diploma) -> str:
    degree = diploma.degree_label or "A diploma with no stated degree"
    return f"{degree} in {diploma.field_label}" if diploma.field_label else degree


def score_education(candidate: dict, requirement: EducationRequirement) -> EducationScore:
    """Score the joint education criterion from the candidate sheet only (D67 bands, D68).

    Only obtained diplomas count; every one is scored on the requested
    dimensions and the best is kept (never a mix of two diplomas). Never
    reads the title, bio, certifications, experiences or clarifications.
    """
    obtained, ongoing = _obtained_diplomas(candidate)
    if not obtained:
        if ongoing:
            return EducationScore(
                0, "No obtained diploma: the candidate's diploma is still in progress (no end date).", None
            )
        return EducationScore(0, "The candidate sheet lists no obtained diploma.", None)

    ranks = [_RANKS.get(_normalize(level)) for level in requirement.degree_levels]
    known_ranks = [rank for rank in ranks if rank is not None]
    required_rank = min(known_ranks) if known_ranks else None

    best: tuple[int, int, str] | None = None
    best_diploma: _Diploma | None = None
    best_reasons: list[str] = []
    for diploma in obtained:
        score, reasons = _score_diploma(diploma, requirement, required_rank)
        # Ties: higher degree rank, then more recent endDate, then the first index.
        rank_key = (score, diploma.rank or 0, diploma.end)
        if best is None or rank_key > best:
            best, best_diploma, best_reasons = rank_key, diploma, reasons
    score = best[0]
    rationale = f"{_describe(best_diploma)}: {best_reasons[0]}"
    if len(best_reasons) > 1:
        rationale += f"; {best_reasons[1]}"
    rationale += "."
    return EducationScore(score, rationale, best_diploma.index if score > 0 else None)
