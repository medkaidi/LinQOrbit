"""Live smoke test against the real Gemini endpoint.

Skipped by default so `uv run pytest` stays offline and key-free:

    RUN_LLM_TESTS=1 uv run pytest tests/test_cv_agent_live.py
"""

import os

import pytest

from app.agents.cv_parse import parse_cv

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_LLM_TESTS") != "1",
    reason="Live LLM test — run with RUN_LLM_TESTS=1",
)

SAMPLE_CV = (
    "Camille Martin, Backend Engineer, Lyon, France. Seven years of experience "
    "with Java, Spring Boot, Kubernetes and PostgreSQL at Acme (2021 to present) "
    "and Globex (September 2020 to March 2023). MSc Computer Science, Sorbonne "
    "University, 2016 to 2018. Speaks French natively and English fluently. "
    "github.com/camille"
)


def test_agent_extracts_a_typed_result_from_a_real_cv(make_pdf):
    parsed = parse_cv(make_pdf(SAMPLE_CV))

    assert parsed.title
    assert parsed.summary
    assert parsed.experiences
    assert parsed.experiences[0].start_date
    assert parsed.skills or parsed.languages
