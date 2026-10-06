"""CV parsing agent: LangGraph harness built with langchain's ``create_agent``.

The agent is a structured extraction loop: the model reads the raw CV text and
must answer with a JSON body that validates against ``ParsedCv``.
``response_format`` drives that contract — Pydantic validates every response
and feeds validation errors back to the model, so the formats (dates, CEFR
grades, 1-5 scores) are enforced by the schema itself, not by tools.
"""

from __future__ import annotations

from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain_core.language_models import BaseChatModel

from app.llm.client import get_model
from app.schemas.cv import ParsedCv, ReferenceContext

# create_agent retries structured output until it validates, with no built-in
# ceiling. This bounds one agent.invoke: enough calls for a couple of schema
# corrections, and a clean END (structured_response=None -> repair turn ->
# no_output) instead of an endless loop when the model never complies.
MODEL_CALL_LIMIT = 6

PROMPT_RULES = """You are an experienced HR assistant working for LinQOrbit, a recruitment platform.

You receive the raw text of a candidate CV and you must return its content in
the structured schema provided to you (ParsedCv).

Rules:
- Dates must come back as 'YYYY-MM': 'Septembre 2020' and '2020-09' both give
  '2020-09'. end_date is null when the position is current.
- Language levels are CEFR grades ('A1' to 'C2'); skill levels are integers
  from 1 (beginner) to 5 (expert). Only report a level the CV actually states.
- Keep the candidate's own wording for job titles, companies, schools,
  descriptions and summary. Never invent or embellish anything.
- When reference lists are provided below, normalise languages, degrees,
  study fields and skills to their exact wording: 'Français' -> 'French',
  'Ingénieur informatique' -> the closest degree label, 'Excel' -> 'Microsoft
  Excel'. Anything they do not cover keeps the CV's own wording.
- Only report what the CV actually says. Missing field -> null, missing list -> [].
- 'summary' is a 2-3 sentence professional summary written in first person.
- Order experiences and diplomas most recent first."""

PROMPT_EXAMPLE = """Example of the expected result (shape only, not content):

{
  "title": "Senior Backend Engineer",
  "summary": "I design and operate high-throughput APIs. I enjoy mentoring and pragmatic testing.",
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


def _render_reference(context: ReferenceContext) -> str:
    """Reference block: the DB vocabulary, one section per list (only if non-empty)."""
    lines = ["Reference lists (the platform database is the source of truth):"]
    if context.languages:
        lines.append("- Languages: " + ", ".join(context.languages))
    if context.degrees:
        lines.append("- Degrees: " + ", ".join(context.degrees))
    if context.study_fields:
        lines.append("- Study fields: " + ", ".join(context.study_fields))
    if context.skills:
        lines.append("- Skills by family:")
        for family in sorted(context.skills):
            lines.append(f"  * {family}: " + ", ".join(context.skills[family]))
    return "\n".join(lines)


def render_system_prompt(context: ReferenceContext | None = None) -> str:
    """System prompt for one call: rules, then the reference block when given.

    Without context the prompt is exactly SYSTEM_PROMPT.
    """
    if context is None:
        return SYSTEM_PROMPT
    return "\n\n".join((PROMPT_RULES, _render_reference(context), PROMPT_EXAMPLE))


def build_cv_agent(model: BaseChatModel | None = None, context: ReferenceContext | None = None):
    """Compile the CV agent graph (stateless, rebuilt per parse_cv call).

    - ``response_format=ParsedCv``: the agent captures a validated Pydantic
      object in ``state['structured_response']`` and retries automatically
      when the model output fails schema validation.
    - No checkpointer: a single invoke is self-contained; parse_cv replays
      its own history explicitly for the repair turn.
    """
    return create_agent(
        model=model or get_model(),
        system_prompt=render_system_prompt(context),
        response_format=ParsedCv,
        middleware=[ModelCallLimitMiddleware(run_limit=MODEL_CALL_LIMIT, exit_behavior="end")],
    )
