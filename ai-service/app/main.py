from fastapi import FastAPI

from app.api.routes import health
from app.core.config import settings

app = FastAPI(
    title="LinQOrbit AI Service",
    description="AI service for LinQOrbit: normalization, matching and LLM analysis.",
    version=settings.version,
)

app.include_router(health.router)
