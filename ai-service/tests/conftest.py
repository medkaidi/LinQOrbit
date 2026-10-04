"""Shared test helpers: an in-memory PDF factory (no LLM, no network)."""

import io
import os

import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

# Tests must not send traces anywhere: LangSmith would otherwise pick up
# LANGSMITH_TRACING from .env and try to upload runs while `pytest` executes.
os.environ["LANGSMITH_TRACING"] = "false"


def _pdf_with_text(text: str) -> bytes:
    """Build a minimal single-page PDF whose text layer contains `text`."""
    safe = text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)

    stream = DecodedStreamObject()
    stream.set_data(f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET".encode("latin-1"))
    page[NameObject("/Contents")] = writer._add_object(stream)

    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    resources = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    page[NameObject("/Resources")] = resources

    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


@pytest.fixture
def make_pdf():
    """Factory fixture: `make_pdf("some text") -> bytes` (a valid PDF)."""
    return _pdf_with_text
