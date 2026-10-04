"""CV parsing pipeline: PDF text extraction -> agent -> ParsedCv.

Step 1 (extraction) is plain Python with pypdf — no quota, no hallucination.
Step 2 (understanding and structuring) is the LangGraph agent.
"""

from __future__ import annotations

import io
from uuid import uuid4

from langchain_core.messages import HumanMessage
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.graphs.cv_agent import build_cv_agent
from app.schemas.cv import ParsedCv

# Below this length the "text layer" is almost certainly absent (scanned PDF).
MIN_TEXT_LENGTH = 100


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


def parse_cv(pdf_bytes: bytes) -> ParsedCv:
    """Extract the CV text, run the agent and return a validated ParsedCv."""
    text = extract_text(pdf_bytes)
    if len(text) < MIN_TEXT_LENGTH:
        raise CVParseError(
            "no_text",
            "No extractable text found in this PDF. Scanned documents are not supported yet.",
        )

    agent = build_cv_agent()
    thread_id = str(uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    result = agent.invoke(
        {"messages": [HumanMessage(content=f"Extract the following CV:\n\n{text}")]},
        config=config,
    )

    parsed = result.get("structured_response")
    if isinstance(parsed, ParsedCv):
        return parsed

    # One repair turn: the checkpointer keeps the history of this thread, so
    # the model sees its own unfinished answer and can submit the schema now.
    repair = agent.invoke(
        {
            "messages": [
                HumanMessage(
                    content="You finished without the structured output. Submit it now, "
                    "strictly following the schema."
                )
            ]
        },
        config=config,
    )
    parsed = repair.get("structured_response")
    if isinstance(parsed, ParsedCv):
        return parsed

    raise CVParseError(
        "no_output",
        "The agent could not produce a valid structure for this CV.",
    )
