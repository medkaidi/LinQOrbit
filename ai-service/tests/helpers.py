"""Shared helpers of the tests: how to read back a guarded payload (D109)."""

import json

from app.graphs.prompt_guard import UNTRUSTED_CONTENT_CLOSE, UNTRUSTED_CONTENT_OPEN


def sent_payload(content: str) -> dict:
    """The JSON payload of a user message: what sits between the markers."""
    start = content.index(UNTRUSTED_CONTENT_OPEN) + len(UNTRUSTED_CONTENT_OPEN)
    end = content.index(UNTRUSTED_CONTENT_CLOSE)
    return json.loads(content[start:end])
