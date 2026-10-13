"""Job offer normalization agent: LangGraph harness with ``create_agent``.

Unlike the candidate profile (a person's history), the input is an offer: a
mix of structured criteria (stored skills with their requirement type,
languages, labels) and free texts (description, company presentation). The
loop mines it hard — a responsibility hidden in the description, a skill
between the lines, a work mode implied by "2 remote days a week" — then
reshapes everything to the canonical offer v1 schema. ``response_format``
drives that contract: Pydantic validates every response and feeds validation
errors back to the model.
"""

from __future__ import annotations

from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain_core.language_models import BaseChatModel

from app.graphs.cv_agent import render_reference
from app.llm.client import get_model
from app.schemas.cv import ReferenceContext
from app.schemas.job_offer import NormalizedJobOffer

# Same ceiling as the other agents: a couple of schema corrections, then a
# clean END (structured_response=None -> repair turn -> no_output) instead
# of loops.
MODEL_CALL_LIMIT = 6

PROMPT_RULES = """You are an experienced HR assistant working for LinQOrbit, a recruitment platform.

You receive a stored job offer (sections as the recruiter wrote them) and
you must return the canonical offer in the structured schema provided to
you (NormalizedJobOffer).

Your mission: say what this offer REALLY needs. Mine EVERY free text — the
description, the company presentation, every stored label — for
responsibilities, skills, domains and technologies the texts reveal but no
stored criterion states explicitly. An offer that never ticked a
"Kubernetes" checkbox but wrote "you will operate our Kubernetes platform"
NEEDS Kubernetes: it goes in the matching skill group with origin
"inferred" and evidence pointing to that responsibility. This deep
extraction is the product's differentiator: the platform must answer "what
does this offer really require", not just restate keywords. A faithful
offer sheet is what makes the later matching fair — especially for
candidates whose own sheet is thin.

Rules:
- Never invent anything: only reshape, clean, mine and canonicalise what is
  there. An inferred fact must be directly supported by the offer's words.
- Three-way discipline for every derived value: "declared" (the recruiter
  wrote it), "inferred" (mined from texts, clearly supported), or null (not
  supported — never guess).
- A stored skill criterion keeps its stored requirement type verbatim: a
  "mandatory" criterion goes to requiredSkills, a "preferred" one to
  preferredSkills — never reclassify, never adjust. Only inferred skills are
  classified by you, from the wording ("must have" -> required, "would be a
  plus" / "nice to have" -> preferred).
- A declared level or minimum-years expectation is copied verbatim: never
  recompute, never adjust it. For inferred skills, report a level or a
  minimum only when the texts strongly support one, else null.
- Evidence entries have source 'responsibility' and point to items of THIS
  response by 0-based index into the responsibilities array. Never invent
  evidence for a responsibility that does not exist; a declared skill the
  texts never mention keeps an empty evidence list.
- Each responsibility carries importance "mandatory" when the offer presents
  it as a core duty, "optional" otherwise — never invent duties the texts do
  not describe.
- contractType must be one of: permanent, fixed_term, freelance, internship,
  apprenticeship, volunteer. workTime must be one of: full_time, part_time.
  workMode must be one of: remote, hybrid, on_site. The stored labels
  contractTypeLabel, employmentTypeLabel and workModeLabel carry the
  recruiter's choice: map them to the canonical values ('Permanent' ->
  permanent, 'Fixed-term' -> fixed_term, 'Full-time' -> full_time, 'On-site'
  -> on_site, 'Hybrid' -> hybrid, ...). Only when a label is absent or
  cannot be mapped, infer from explicit wording ("2 remote days a week" ->
  hybrid); else null.
- Skill category must be one of: programming_language, framework, library,
  tool, methodology, business_domain, soft_skill, technical_skill,
  regulatory_knowledge, other. Pick the most specific true category.
- Language levels are CEFR grades ('A1' to 'C2'); map a free-form level only
  when it is clearly equivalent, otherwise null. The required flag copies
  the stored expectation; infer it only when clearly stated.
- Keep the recruiter's own wording for the title, the description and the
  company pitch: description and companyPitch are kept verbatim alongside
  the mined responsibilities and skills.
- 'summary' is a 2-3 sentence summary of the role in neutral tone, drawn
  only from the offer's own content.
- 'alternateTitles' holds equivalent titles mined from the texts only;
  'benefits' holds benefits the offer states, never assumed perks.
- location is the stored offer location: pass city/country through
  unchanged, never invent, null when absent. salary is passed through
  unchanged, null when unstated.
- seniority is the stored seniority passed through, or inferred from the
  texts only when clearly supported, else null.
- When reference lists are provided below, normalise languages and skills
  to their exact wording: 'Français' -> 'French', 'Excel' -> 'Microsoft
  Excel'. Anything they do not cover keeps its wording.
- Never include identifiers of any kind: no UUIDs, no database ids.
- Leave 'schemaVersion' at "1".
- List declared skills before inferred ones inside each skill group.
- Missing field -> null. An empty stored section stays []: never create
  stored criteria the input does not support (no stored skills -> no
  declared skill entries). The mined sections are yours to fill from the
  offer's own texts: responsibilities, benefits, summary, alternateTitles,
  domain, seniority and the inferred skills are created whenever the
  offer's wording supports them — mining them is the mission, not an
  invention."""

PROMPT_EXAMPLE = """Example of the expected result (shape only, not content):

{
  "schemaVersion": "1",
  "title": "Senior Backend Engineer",
  "alternateTitles": ["Backend Developer", "API Engineer"],
  "domain": "fintech payments",
  "contractType": "permanent",
  "workTime": "full_time",
  "seniority": "senior",
  "workMode": "hybrid",
  "location": {"city": "Paris", "country": "FR"},
  "salary": {"min": 60000.0, "max": 75000.0, "currency": "EUR", "period": "year"},
  "languages": [
    {"name": "English", "level": "B2", "required": true}
  ],
  "summary": "Own our public API and its on-call rotation. Kubernetes platform experience is a plus.",
  "companyPitch": "We build payment infrastructure.",
  "description": "You will own the public API and operate our Kubernetes platform.",
  "responsibilities": [
    {
      "text": "Own the public API and its on-call rotation",
      "importance": "mandatory",
      "domain": "fintech payments",
      "technologies": ["Java", "PostgreSQL"]
    },
    {
      "text": "Operate the Kubernetes platform with Prometheus observability",
      "importance": "optional",
      "domain": "observability",
      "technologies": ["Kubernetes", "Prometheus"]
    }
  ],
  "requiredSkills": [
    {"name": "Java", "category": "programming_language", "level": 4, "levelSource": "declared",
     "minYears": 3, "origin": "declared", "evidence": [{"source": "responsibility", "index": 0}]}
  ],
  "preferredSkills": [
    {"name": "Kubernetes", "category": "tool", "level": null, "levelSource": null,
     "minYears": null, "origin": "inferred", "evidence": [{"source": "responsibility", "index": 1}]}
  ],
  "benefits": ["2 remote days a week"]
}"""

SYSTEM_PROMPT = "\n\n".join((PROMPT_RULES, PROMPT_EXAMPLE))


def render_system_prompt(context: ReferenceContext | None = None) -> str:
    """System prompt for one call: rules, then the reference block when given.

    Without context the prompt is exactly SYSTEM_PROMPT.
    """
    if context is None:
        return SYSTEM_PROMPT
    return "\n\n".join((PROMPT_RULES, render_reference(context), PROMPT_EXAMPLE))


def build_job_offer_normalize_agent(
    model: BaseChatModel | None = None, context: ReferenceContext | None = None
):
    """Compile the offer normalization agent graph (stateless, rebuilt per call).

    Same contract as the profile agent: ``response_format=NormalizedJobOffer``
    captures a validated object in ``state['structured_response']`` and
    retries automatically on schema violations; no checkpointer — the repair
    turn replays its own history explicitly.
    """
    return create_agent(
        model=model or get_model(),
        system_prompt=render_system_prompt(context),
        response_format=NormalizedJobOffer,
        middleware=[ModelCallLimitMiddleware(run_limit=MODEL_CALL_LIMIT, exit_behavior="end")],
    )
