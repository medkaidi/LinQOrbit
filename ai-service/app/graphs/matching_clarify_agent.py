"""Matching clarification agent (T-62): LangGraph harness with ``create_agent``.

After an analysis, the agent picks the ONE question a seasoned recruiter
would ask the candidate to fill the most decision-relevant gap of the
profile — or none. The question and its rationale are shown to the
candidate; the answer is stored by the backend and replayed to the matching
agent on the next re-evaluation.

Stateless on purpose: no checkpointer. The whole context (sheets, criteria,
latest assessments, every clarification already asked) comes with every
call; the matching id only tags the LangSmith run as a thread.
"""

from __future__ import annotations

from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain_core.language_models import BaseChatModel

from app.llm.client import get_model
from app.schemas.matching import ClarificationSuggestion

# Same ceiling as the other agents: a couple of schema corrections, then a
# clean END (structured_response=None -> repair turn -> no_output).
MODEL_CALL_LIMIT = 6

CLARIFY_PROMPT_RULES = """You are a senior technical recruiter working for LinQOrbit, a
recruitment platform. The matching engine has scored the candidate sheet
against the offer criteria. Your job is to ask the candidate the one question
a seasoned recruiter would ask before reviewing the application, to fill the
most decision-relevant gap of the profile.

You receive the job offer sheet (the reference), the candidate sheet, the
criteria, the latest assessments (scores, rationale, evidence), every
clarification already asked with its answer or skip, and the number of
questions remaining.

Contract:
- Ask ONE question at a time, never a list. The answer will be stored and used
  to re-score the candidate.
- Target the most decision-relevant gap: a criterion scored 0 or low that a
  short answer could clarify, missing or thin evidence, ambiguous relevant
  years, an unclear degree or field, a language level, a certification, or a
  contradiction or omission in the profile.
- Never ask what the sheets already answer. Never ask the same thing twice —
  including a question the candidate skipped: a skip means move on to another
  gap.
- The question must be self-contained and answerable in a few sentences: name
  the offer expectation it relates to (for example "The offer requires 5
  years of backend development; your profile shows 3"). Keep it under 40
  words.
- The rationale is shown to the candidate: one or two factual sentences in
  English, neutral and respectful, explaining WHY you ask (what is missing or
  unclear for this offer). Keep it under 60 words. Never mention scores,
  weights, the assessment rationale, the matching engine or the recruiter's
  decision.
- Never ask about protected or sensitive characteristics: age, date of birth,
  gender, nationality, ethnicity, religion, political opinions or beliefs,
  union membership, health, disability, family or marital status, pregnancy,
  sexual orientation, or a photo. Never ask for salary expectations or any
  information unrelated to the offer's criteria.
- You never score, never recommend hiring or rejecting, and never advise the
  candidate what to answer.
- If no valuable question remains, or the remaining budget is 0, return no
  question (null)."""

CLARIFY_EXAMPLE = """Example of the expected output (shape only):
{
  "question": {
    "question": "The offer requires 5 years of backend development; your profile shows 3. Could you describe any additional backend work, including missions that may not be listed in your profile?",
    "rationale": "Relevant experience is the main gap for this offer. Details on additional backend work help assess the experience criterion accurately."
  }
}

No question left:
{"question": null}"""

CLARIFY_SYSTEM_PROMPT = "\n\n".join((CLARIFY_PROMPT_RULES, CLARIFY_EXAMPLE))


def build_matching_clarify_agent(model: BaseChatModel | None = None):
    """Compile the clarification agent graph (stateless, rebuilt per call).

    ``response_format=ClarificationSuggestion`` captures a validated object
    (a question, or ``question: null``) in ``state['structured_response']``
    and retries on schema violations; no checkpointer — the repair turn
    replays its own history explicitly.
    """
    return create_agent(
        model=model or get_model(),
        system_prompt=CLARIFY_SYSTEM_PROMPT,
        response_format=ClarificationSuggestion,
        middleware=[ModelCallLimitMiddleware(run_limit=MODEL_CALL_LIMIT, exit_behavior="end")],
    )
