FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# ffmpeg is required by video composition and audio concat.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pipeline/video_studio/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy only the backend package needed by this service.
COPY pipeline /app/pipeline

# ONNX voice models are ignored in git, so fetch them at build time.
RUN mkdir -p /app/pipeline/video_studio/voices \
    && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx?download=true" -o /app/pipeline/video_studio/voices/en_US-ryan-medium.onnx \
    && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx?download=true" -o /app/pipeline/video_studio/voices/hi_IN-pratham-medium.onnx

# Keep model and output folders writable at runtime.
RUN mkdir -p /app/pipeline/video_studio/outputs /app/pipeline/video_studio/temp

EXPOSE 8001

CMD ["sh", "-c", "uvicorn pipeline.video_studio.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
