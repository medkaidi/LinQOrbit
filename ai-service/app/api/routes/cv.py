"""CV parsing endpoint: multipart PDF upload -> pipeline -> ParsedCv."""

import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from app.agents.cv_parse import CVParseError, parse_cv
from app.schemas.cv import ParsedCv, ReferenceContext

logger = logging.getLogger(__name__)

router = APIRouter(tags=["cv"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB — mirrors spring.servlet.multipart.max-file-size
PDF_CONTENT_TYPES = ("application/pdf", "application/x-pdf")

# CVParseError.code -> HTTP status the client should see.
ERROR_STATUS = {
    "invalid_pdf": 400,
    "no_text": 422,
    "no_output": 502,
}


@router.post("/cv/parse", response_model=ParsedCv)
async def parse_cv_endpoint(
    file: UploadFile = File(...),
    context: str | None = Form(None),
) -> ParsedCv:
    """Parse a CV file and return its structured extraction.

    415 wrong content type, 413 file too large, 400 unreadable PDF or invalid
    context, 422 no extractable text, 502 the agent produced no valid structure.

    ``context`` is an optional JSON part (reference vocabulary from the
    backend's database) rendered into the prompt for canonicalisation.
    """
    logger.info("CV parse requested : content_type=%s", file.content_type)
    if file.content_type not in PDF_CONTENT_TYPES:
        logger.warning("CV parse rejected : unsupported content type, content_type=%s", file.content_type)
        raise HTTPException(status_code=415, detail="Only PDF files are supported.")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        logger.warning("CV parse rejected : file too large, size=%d bytes", len(data))
        raise HTTPException(status_code=413, detail="File too large: 5 MB maximum.")

    reference: ReferenceContext | None = None
    if context is not None:
        try:
            reference = ReferenceContext.model_validate_json(context)
        except ValidationError as exc:
            logger.warning("CV parse rejected : invalid reference context")
            raise HTTPException(status_code=400, detail="Invalid reference context.") from exc

    try:
        # pypdf extraction and the LLM call are blocking: run them off the loop.
        parsed = await run_in_threadpool(parse_cv, data, reference)
    except CVParseError as exc:
        status = ERROR_STATUS.get(exc.code, 500)
        logger.warning("CV parse rejected : code=%s, status=%d", exc.code, status)
        raise HTTPException(status_code=status, detail=exc.message) from exc
    logger.info("CV parse succeeded : size=%d bytes, has_reference=%s", len(data), reference is not None)
    return parsed
