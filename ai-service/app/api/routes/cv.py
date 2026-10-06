"""CV parsing endpoint: multipart PDF upload -> pipeline -> ParsedCv."""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError

from app.agents.cv_parse import CVParseError, parse_cv
from app.schemas.cv import ParsedCv, ReferenceContext

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
    if file.content_type not in PDF_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Only PDF files are supported.")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large: 5 MB maximum.")

    reference: ReferenceContext | None = None
    if context is not None:
        try:
            reference = ReferenceContext.model_validate_json(context)
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail="Invalid reference context.") from exc

    try:
        # pypdf extraction and the LLM call are blocking: run them off the loop.
        return await run_in_threadpool(parse_cv, data, reference)
    except CVParseError as exc:
        status = ERROR_STATUS.get(exc.code, 500)
        raise HTTPException(status_code=status, detail=exc.message) from exc
