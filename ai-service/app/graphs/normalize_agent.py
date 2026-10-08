"""Profile normalization agent: LangGraph harness with ``create_agent``.

Unlike CV parsing (raw text -> structure), the input is already structured:
the loop is a canonicalisation pass — reshape to the schema, normalise dates,
levels and vocabulary against the reference lists, never invent.
``response_format=NormalizedProfile`` drives that contract: Pydantic validates
every response and feeds validation errors back to the model.
"""

from __future__ import annotations

from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain_core.language_models import BaseChatModel

from app.graphs.cv_agent import render_reference
from app.llm.client import get_model
from app.schemas.cv import ReferenceContext
from app.schemas.normalize import NormalizedProfile

# Same ceiling as the CV agent: a couple of schema corrections, then a clean
# END (structured_response=None -> repair turn -> no_output) instead of loops.
MODEL_CALL_LIMIT = 6

PROMPT_RULES = """You are an experienced HR assistant working for LinQOrbit, a recruitment platform.

You receive the current profile of a candidate (sections as the user wrote
them) and you must return it in the structured schema provided to you
(NormalizedProfile).

Rules:
- Never invent anything: only reshape, clean and canonicalise what is there.
- Dates must come back as 'YYYY-MM': '2021-03-05' and 'March 2021' both give
  '2021-03'. end_date is null when the position is current.
- Language levels are CEFR grades ('A1' to 'C2'); map a free-form level only
  when it is clearly equivalent, otherwise null. Skill levels are integers
  from 1 (beginner) to 5 (expert). Only report a level the profile actually
  supports.
- Keep the candidate's own wording for job titles, companies, schools,
  descriptions and summary. Never invent or embellish anything.
- When reference lists are provided below, normalise languages, degrees,
  study fields and skills to their exact wording: 'Français' -> 'French',
  'Excel' -> 'Microsoft Excel'. Anything they do not cover keeps its wording.
- 'title' is the professional headline; 'summary' is a 2-3 sentence
  professional summary written in first person, drawn only from the profile's
  own bio and content.
- Never include identifiers of any kind: no UUIDs, no database ids.
- Leave 'schemaVersion' at "1".
- Order experiences and diplomas most recent first.
- Missing field -> null. If a section is empty in the input, return [] for
  it: never create experiences, diplomas, skills, languages or links the
  input does not already list — only 'title' and 'summary' may be recomposed
  from the profile's own wording."""

PROMPT_EXAMPLE = """Example of the expected result (shape only, not content):

{
  "schemaVersion": "1",
  "title": "Senior Backend Engineer",
  "summary": "I design and operate high-throughput APIs. I enjoy mentoring and pragmatic testing.",
  "yearsOfExperience": 7,
  "experiences": [
    {
      "positionTitle": "Backend Engineer",
      "companyName": "Acme",
      "companyCountry": "France",
      "startDate": "2021-03",
      "endDate": null,
      "description": "Owned the public API and its on-call rotation."
    }
  ],
  "diplomas": [
    {
      "title": "MSc Computer Science",
      "institution": "Sorbonne University",
      "institutionCountry": "France",
      "degreeLabel": "Master",
      "studyFieldLabel": "Computer Science",
      "startDate": "2016-09",
      "endDate": "2018-06"
    }
  ],
  "skills": [
    {"name": "Java", "level": 4, "yearsExperience": 7}
  ],
  "languages": [
    {"name": "English", "level": "C1"}
  ],
  "links": [
    {"label": "GitHub", "url": "https://github.com/camille"}
  ]
}"""

SYSTEM_PROMPT = "\n\n".join((PROMPT_RULES, PROMPT_EXAMPLE))


def render_system_prompt(context: ReferenceContext | None = None) -> str:
    """System prompt for one call: rules, then the reference block when given.

    Without context the prompt is exactly SYSTEM_PROMPT.
    """
    if context is None:
        return SYSTEM_PROMPT
    return "\n\n".join((PROMPT_RULES, render_reference(context), PROMPT_EXAMPLE))


def build_normalize_agent(model: BaseChatModel | None = None, context: ReferenceContext | None = None):
    """Compile the normalization agent graph (stateless, rebuilt per call).

    Same contract as the CV agent: ``response_format=NormalizedProfile``
    captures a validated object in ``state['structured_response']`` and
    retries automatically on schema violations; no checkpointer — the repair
    turn replays its own history explicitly.
    """
    return create_agent(
        model=model or get_model(),
        system_prompt=render_system_prompt(context),
        response_format=NormalizedProfile,
        middleware=[ModelCallLimitMiddleware(run_limit=MODEL_CALL_LIMIT, exit_behavior="end")],
    )
