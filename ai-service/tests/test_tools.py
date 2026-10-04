"""Unit tests for the agent's tools — pure Python, no LLM."""

from app.agents.tools import CV_TOOLS, level_to_cefr, normalize_period, skill_level_to_score


def test_registry_exposes_the_three_tools():
    assert len(CV_TOOLS) == 3
    assert {tool.name for tool in CV_TOOLS} == {
        "normalize_period",
        "level_to_cefr",
        "skill_level_to_score",
    }


def test_normalize_period_reads_month_names():
    assert normalize_period.invoke({"start": "March 2021"}) == "2021-03|null"
    assert normalize_period.invoke({"start": "Sep 2020", "end": "Mar 2023"}) == "2020-09|2023-03"


def test_normalize_period_reads_numeric_forms():
    assert normalize_period.invoke({"start": "09/2020", "end": "03/2023"}) == "2020-09|2023-03"
    assert normalize_period.invoke({"start": "2021", "end": "2022-06"}) == "2021-01|2022-06"
    assert normalize_period.invoke({"start": "2021-3"}) == "2021-03|null"


def test_normalize_period_treats_present_as_ongoing():
    assert normalize_period.invoke({"start": "2020-09", "end": "Present"}) == "2020-09|null"
    assert normalize_period.invoke({"start": "2020-09", "end": None}) == "2020-09|null"
    assert normalize_period.invoke({"start": "2020-09", "end": "  "}) == "2020-09|null"


def test_normalize_period_rejects_unreadable_start():
    assert normalize_period.invoke({"start": "sometime back"}).startswith("invalid|")
    assert normalize_period.invoke({"start": "March 2021", "end": "whenever"}).startswith("invalid|")


def test_level_to_cefr_maps_keywords_and_codes():
    assert level_to_cefr.invoke({"level": "fluent"}) == "C1"
    assert level_to_cefr.invoke({"level": "native speaker"}) == "C2"
    assert level_to_cefr.invoke({"level": "b2"}) == "B2"
    assert level_to_cefr.invoke({"level": "not stated"}) == "unknown"


def test_skill_level_to_score_maps_keywords_and_digits():
    assert skill_level_to_score.invoke({"level": "expert"}) == "5"
    assert skill_level_to_score.invoke({"level": "advanced working knowledge"}) == "4"
    assert skill_level_to_score.invoke({"level": "3"}) == "3"
    assert skill_level_to_score.invoke({"level": "not mentioned"}) == "unknown"
