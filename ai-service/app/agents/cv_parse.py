"""CV parsing pipeline: PDF text extraction -> agent -> ParsedCv.

Step 1 (extraction) is plain Python with pypdf — no quota, no hallucination.
Step 2 (understanding and structuring) is the LangGraph agent.
"""

from __future__ import annotations

import io
import logging

from langchain_core.messages import HumanMessage
from langgraph.errors import GraphRecursionError
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.graphs.cv_agent import build_cv_agent
from app.schemas.cv import ParsedCv, ReferenceContext

logger = logging.getLogger(__name__)

# Below this length the "text layer" is almost certainly absent (scanned PDF).
MIN_TEXT_LENGTH = 100

# Graph-level backstop (super-steps), deliberately above what the model-call
# ceiling allows: ModelCallLimitMiddleware (MODEL_CALL_LIMIT) should end the
# run first with a clean structured_response=None, which is what gives the
# repair turn its chance to run.
RECURSION_LIMIT = 32


class CVParseError(Exception):
    """Business-level failure; the route maps it to an HTTP error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def extract_text(pdf_bytes: bytes) -> str:
    """Return the concatenated text layer of the PDF (pure Python, no LLM)."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except (PdfReadError, ValueError, KeyError) as exc:
        raise CVParseError("invalid_pdf", "The uploaded file is not a readable PDF.") from exc


def parse_cv(pdf_bytes: bytes, context: ReferenceContext | None = None) -> ParsedCv:
    """Extract the CV text, run the agent and return a validated ParsedCv.

    ``context`` is the backend's reference vocabulary (DB truth): it is
    rendered into the system prompt as canonicalisation lists.
    """
    text = extract_text(pdf_bytes)
    if len(text) < MIN_TEXT_LENGTH:
        raise CVParseError(
            "no_text",
            "No extractable text found in this PDF. Scanned documents are not supported yet.",
        )

    agent = build_cv_agent(context=context)
    config = {"recursion_limit": RECURSION_LIMIT}
    try:
        result = agent.invoke(
            {"messages": [HumanMessage(content=f"Extract the following CV:\n\n{text}")]},
            config=config,
        )
    except GraphRecursionError as exc:
        raise CVParseError(
            "no_output",
            "The agent could not produce a valid structure for this CV.",
        ) from exc

    parsed = result.get("structured_response")
    if isinstance(parsed, ParsedCv):
        return parsed

    # One repair turn, replaying this run's history explicitly (no checkpointer)
    # so the model sees its own unfinished answer and can submit the schema now.
    logger.warning("CV parse : structured output missing, running repair turn")
    try:
        repair = agent.invoke(
            {
                "messages": [
                    *result["messages"],
                    HumanMessage(
                        content="You finished without the structured output. Submit it now, "
                        "strictly following the schema."
                    ),
                ]
            },
            config=config,
        )
    except GraphRecursionError as exc:
        raise CVParseError(
            "no_output",
            "The agent could not produce a valid structure for this CV.",
        ) from exc
    parsed = repair.get("structured_response")
    if isinstance(parsed, ParsedCv):
        logger.info("CV parse : repair turn recovered the structured output")
        return parsed

    raise CVParseError(
        "no_output",
        "The agent could not produce a valid structure for this CV.",
    )
