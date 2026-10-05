"""CV parsing agent: LangGraph harness built with langchain's ``create_agent``.

``create_agent`` compiles the classic ReAct loop (model -> tools -> model ...)
into a LangGraph StateGraph. Everything the graph exchanges lives in a
``messages`` list: HumanMessage (the CV text), AIMessage (possibly with
tool_calls), ToolMessage (tool results).
"""

from __future__ import annotations

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langgraph.checkpoint.memory import InMemorySaver

from app.agents.tools import CV_TOOLS
from app.llm.client import get_model
from app.schemas.cv import ParsedCv

SYSTEM_PROMPT = """You are an experienced HR assistant working for LinQOrbit, a recruitment platform.

You receive the raw text of a candidate CV and you must return its content in
the structured schema provided to you (ParsedCv).

Rules:
- Use the tools to normalise date ranges and proficiency levels; never guess
  their canonical form yourself.
- Tool discipline: send ALL normalisation calls in ONE message as parallel
  tool calls — one call per turn is too slow.
- Never issue a tool call you already made: its answer is in the conversation.
  If a tool returns 'unknown' or 'invalid', leave the field null and move on —
  never retry with reworded arguments.
- As soon as the normalisations are done, stop calling tools and submit the
  final structured output immediately.
- Keep the candidate's own wording for job titles, companies and schools.
  Do not invent, embellish or translate anything.
- Only report what the CV actually says. Missing field -> null, missing list -> [].
- Dates must come back as 'YYYY-MM' exactly as returned by the tools.
- 'summary' is a 2-3 sentence professional summary written in first person.
- Order experiences and diplomas most recent first.

Example of the expected result (shape only, not content):

{
  "title": "Senior Backend Engineer",
  "summary": "I design and operate high-throughput APIs. I enjoy mentoring and pragmatic testing.",
  "experiences": [
    {
      "position_title": "Backend Engineer",
      "company_name": "Acme",
      "company_country": "France",
      "start_date": "2021-03",
      "end_date": null,
      "description": "Owned the public API and its on-call rotation."
    }
  ],
  "diplomas": [
    {
      "title": "MSc Computer Science",
      "institution": "Sorbonne University",
      "institution_country": "France",
      "degree_label": "Master",
      "study_field_label": "Computer Science",
      "start_date": "2016-09",
      "end_date": "2018-06"
    }
  ],
  "skills": [
    {"name": "Java", "level": 4, "years_experience": 7}
  ],
  "languages": [
    {"name": "English", "level": "C1"}
  ],
  "links": [
    {"label": "GitHub", "url": "https://github.com/camille"}
  ]
}"""


def build_cv_agent(model: BaseChatModel | None = None):
    """Compile the CV agent graph (one instance per process).

    - ``response_format=ParsedCv``: the agent captures a validated Pydantic
      object in ``state['structured_response']`` and retries automatically
      when the model output fails schema validation.
    - ``checkpointer=InMemorySaver()``: graph state is persisted per
      ``thread_id``. Here threads are per-request (stateless API); in a real
      assistant the thread_id would be the end-user session.
    """
    return create_agent(
        model=model or get_model(),
        tools=CV_TOOLS,
        system_prompt=SYSTEM_PROMPT,
        response_format=ParsedCv,
        checkpointer=InMemorySaver(),
    )
