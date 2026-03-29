"""
ET Patrika Video Studio — FastAPI on port 8001.
Run from project root: python -m pipeline.video_studio.main
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pipeline.video_studio.api.routes import router
from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger

app = FastAPI(
    title="ET Patrika Video Studio",
    description="Transforms ET Patrika articles into broadcast-quality videos in multiple languages",
    version="1.0.0",
    docs_url="/studio/docs"
)

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_methods=["*"], allow_headers=["*"]
)

config.OUTPUT_DIR.mkdir(exist_ok=True)
app.mount("/videos", StaticFiles(directory=str(config.OUTPUT_DIR)), name="videos")
app.include_router(router, prefix="/studio/api", tags=["video-studio"])

@app.get("/")
async def root():
    return {
        "service": "ET Patrika Video Studio",
        "port": config.PORT,
        "docs": "/studio/docs",
        "health": "/studio/api/health",
        "articles": "/studio/api/articles",
        "generate": "POST /studio/api/generate",
        "note": "Shares Supabase + Groq with ET Patrika pipeline"
    }

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting ET Patrika Video Studio on port {config.PORT}")
    uvicorn.run("pipeline.video_studio.main:app", host="0.0.0.0", port=config.PORT, reload=True)
