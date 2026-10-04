"""Tools available to the CV parsing agent.

Pure Python on purpose: deterministic, offline and unit-testable without any
LLM. Tool descriptions are part of the prompt the model reads.
"""

from __future__ import annotations

import re

from langchain_core.tools import tool

_MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9, "october": 10,
    "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
}

# Expressions meaning "still ongoing" for an end date.
_ONGOING = {"present", "now", "current", "ongoing", "today", "to date", "currently", "en cours"}


def _parse_month(raw: str) -> str | None:
    """Convert one date fragment to canonical YYYY-MM, or None when unreadable."""
    value = raw.strip().lower()
    if re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
        return value
    if re.fullmatch(r"\d{4}", value):
        return f"{value}-01"
    match = re.fullmatch(r"(\d{1,2})[/-](\d{4})", value)
    if match and 1 <= int(match.group(1)) <= 12:
        return f"{match.group(2)}-{int(match.group(1)):02d}"
    match = re.fullmatch(r"(\d{4})-(\d{1,2})", value)
    if match and 1 <= int(match.group(2)) <= 12:
        return f"{match.group(1)}-{int(match.group(2)):02d}"
    match = re.fullmatch(r"([a-z]+)\s+(\d{4})", value)
    if match and match.group(1) in _MONTHS:
        return f"{match.group(2)}-{_MONTHS[match.group(1)]:02d}"
    match = re.fullmatch(r"(\d{4})\s+([a-z]+)", value)
    if match and match.group(2) in _MONTHS:
        return f"{match.group(1)}-{_MONTHS[match.group(2)]:02d}"
    return None


@tool
def normalize_period(start: str, end: str | None = None) -> str:
    """Convert a human-readable date range into the canonical 'YYYY-MM|YYYY-MM' format.

    Use this tool for every experience and diploma period instead of guessing.

    Accepted inputs: 'March 2021', 'Mar 2021', '2021-03', '03/2021', '2021'.
    An omitted, empty or 'Present'/'Now' end date means the period is ongoing
    and is returned as 'null'.

    Returns 'start|end' (example: '2021-03|2023-09' or '2020-09|null'),
    or 'invalid|<reason>' when the start date cannot be read.
    """
    start_month = _parse_month(start)
    if start_month is None:
        return f"invalid|start date not readable: {start!r}"
    end_value = (end or "").strip()
    if end_value.lower() in _ONGOING or not end_value:
        return f"{start_month}|null"
    end_month = _parse_month(end_value)
    if end_month is None:
        return f"invalid|end date not readable: {end!r}"
    return f"{start_month}|{end_month}"


_CEFR_BY_KEYWORD = [
    ("native", "C2"),
    ("bilingual", "C2"),
    ("fluent", "C1"),
    ("professional", "C1"),
    ("advanced", "B2"),
    ("business", "B2"),
    ("intermediate", "B1"),
    ("elementary", "A2"),
    ("basic", "A2"),
    ("beginner", "A1"),
    ("novice", "A1"),
]


@tool
def level_to_cefr(level: str) -> str:
    """Convert a free-text language proficiency into a CEFR level.

    Inputs like 'fluent', 'native speaker', 'B2' become 'C1', 'C2', 'B2'.
    Returns 'unknown' when the text cannot be mapped to A1-C2.
    """
    value = level.strip().lower()
    if re.fullmatch(r"c[12]|b[12]|a[12]", value):
        return value.upper()
    for keyword, cefr in _CEFR_BY_KEYWORD:
        if keyword in value:
            return cefr
    return "unknown"


_SKILL_SCORE_BY_KEYWORD = [
    ("expert", 5), ("master", 5),
    ("advanced", 4),
    ("intermediate", 3), ("medium", 3),
    ("basic", 2), ("elementary", 2),
    ("beginner", 1), ("novice", 1),
]


@tool
def skill_level_to_score(level: str) -> str:
    """Convert a free-text skill proficiency into a 1-5 score.

    Inputs like 'expert', 'advanced', 'beginner' become '5', '4', '1'.
    Returns 'unknown' when no score can be inferred.
    """
    value = level.strip().lower()
    if re.fullmatch(r"[1-5]", value):
        return value
    for keyword, score in _SKILL_SCORE_BY_KEYWORD:
        if keyword in value:
            return str(score)
    return "unknown"


CV_TOOLS = [normalize_period, level_to_cefr, skill_level_to_score]
