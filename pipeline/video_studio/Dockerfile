FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# ffmpeg is required by video composition and audio concat.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY pipeline/video_studio/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy only the backend package needed by this service.
COPY pipeline /app/pipeline

# Keep model and output folders writable at runtime.
RUN mkdir -p /app/pipeline/video_studio/outputs /app/pipeline/video_studio/temp

EXPOSE 8001

CMD ["sh", "-c", "uvicorn pipeline.video_studio.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
