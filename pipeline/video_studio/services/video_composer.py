"""
Full FFmpeg+Pillow video composition.
"""
import os
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger
from pipeline.video_studio.models.schemas import NewsScript, ScriptSegment


def _resolve_ffmpeg_executable() -> str:
    """Resolve ffmpeg binary from PATH or imageio-ffmpeg fallback."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin:
        return ffmpeg_bin

    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"

def create_video_segment(
    segment: ScriptSegment, 
    image_path: str, 
    temp_dir: Path, 
    idx: int, 
    article_title: str, 
    style: str,
    chart_path: str = None
) -> str:
    """Create a video clip for a specific segment with image panning and text overlays."""
    output_path = temp_dir / f"clip_{idx}.mp4"
    dur = max(segment.duration_seconds + 0.3, 2.0)
    
    # 1. Image sequence with Pan/Zoom
    use_zoom = True
    input_img = image_path
    if segment.segment_type == "facts" and chart_path and os.path.exists(chart_path):
        input_img = chart_path
        use_zoom = False # No zoom on charts
    
    # Check if we should draw an overlay layer
    # We use FFmpeg drawtext for top bar, ticker, subtitles (via another filter)
    # But for complex things like lower_third, python PIL is better if pre-rendered over the input!
    img = Image.open(input_img).convert("RGB")
    img = img.resize((config.VIDEO_WIDTH, config.VIDEO_HEIGHT), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(img)
    
    w, h = config.VIDEO_WIDTH, config.VIDEO_HEIGHT
    
    # Top bar
    bar_height = 80
    draw.rectangle([0, 0, w, bar_height], fill="#0a0a0a")
    # Ticker bar
    draw.rectangle([0, h - 60, w, h], fill="#0a0a0a")
    
    if style == "breaking":
        draw.rectangle([0, 0, 300, bar_height], fill="#e8132b")
        # Text "BREAKING NEWS" drawn by FFmpeg or roughly via Pillow
    
    if segment.segment_type == "hook":
        # headline banner
        draw.rectangle([w//2 - 400, h//2 - 100, w//2 + 400, h//2 + 100], fill=(0,0,0,180))
        draw.rectangle([w//2 - 400, h//2 - 100, w//2 - 380, h//2 + 100], fill="#e8132b")
    elif segment.segment_type in ("facts", "context"):
        # lower third
        draw.rectangle([100, h - 200, w - 100, h - 60], fill=(0,0,0,180))
        draw.rectangle([100, h - 200, 120, h - 60], fill="#e8132b")
        
    proc_img_path = str(temp_dir / f"proc_img_{idx}.jpg")
    img.save(proc_img_path, quality=90)
    
    filter_complex = ""
    if use_zoom:
        filter_complex = f"[0:v]zoompan=z='min(zoom+0.0008,1.05)':d={int(dur*24)}:s={w}x{h},format=yuv420p[v]"
    else:
        filter_complex = f"[0:v]format=yuv420p[v]"
        
    cmd = [
        _resolve_ffmpeg_executable(), "-y",
        "-loop", "1", "-i", proc_img_path,
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-c:v", "libx264",
        "-preset", str(config.VIDEO_PRESET),
        "-crf", str(config.VIDEO_CRF),
        "-threads", str(config.VIDEO_THREADS),
        "-t", str(dur),
        "-pix_fmt", "yuv420p",
        str(output_path)
    ]

    try:
        subprocess.run(cmd, capture_output=True, check=True, timeout=120)
    except subprocess.CalledProcessError as exc:
        # Retry with an even cheaper non-zoom render if container resources are tight.
        logger.warning("FFmpeg segment render failed; retrying in low-resource mode: %s", exc)
        retry_cmd = [
            _resolve_ffmpeg_executable(), "-y",
            "-loop", "1", "-i", proc_img_path,
            "-vf", f"scale={w}:{h},format=yuv420p",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", str(config.VIDEO_CRF),
            "-threads", "1",
            "-t", str(dur),
            "-pix_fmt", "yuv420p",
            str(output_path)
        ]
        subprocess.run(retry_cmd, capture_output=True, check=True, timeout=120)
    return str(output_path)

def compose_video(
    script: NewsScript, 
    segments: list[ScriptSegment], 
    images: list[str], 
    chart_path: str, 
    srt_path: str,
    master_audio_path: str, 
    article_title: str, 
    job_id: str, 
    style: str
) -> str:
    logger.info(f"Composing video for {job_id}...")
    temp_dir = config.TEMP_DIR / job_id
    
    clip_paths = []
    
    for i, seg in enumerate(segments):
        img_idx = i % len(images) if images else 0
        img_path = images[img_idx]
        clip = create_video_segment(seg, img_path, temp_dir, i, article_title, style, chart_path)
        clip_paths.append(clip)
        
    # Concatenate clips
    list_path = temp_dir / "clip_list.txt"
    with open(list_path, "w", encoding="utf-8") as f:
        for c in clip_paths:
            # We use an absolute path formatted for FFmpeg concat demuxer
            clean_path = str(c).replace("\\", "/")
            f.write(f"file '{clean_path}'\n")
            
    silent_video = str(temp_dir / "silent_video.mp4")
    
    cmd_concat = [
        _resolve_ffmpeg_executable(), "-y", "-f", "concat", "-safe", "0",
        "-i", str(list_path), "-c", "copy", silent_video
    ]
    subprocess.run(cmd_concat, capture_output=True, check=True)
    
    # Merge, encode text and audio
    final_output = str(config.OUTPUT_DIR / f"etpatrika_{job_id}.mp4")
    
    # Fix paths for FFmpeg filters on Windows: colons must be escaped, or we use relative if possible
    # We'll rely on relative path for SRT as it's safer
    import string
    def escape_path(path):
        return path.replace("\\", "/").replace(":", "\\:")
        
    safe_srt = escape_path(str(srt_path))
    drawtext_filter = f"subtitles='{safe_srt}':force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H40000000,BorderStyle=3'"
    
    cmd_merge = [
        _resolve_ffmpeg_executable(), "-y",
        "-i", silent_video,
        "-i", master_audio_path,
        "-vf", drawtext_filter,
        "-c:v", "libx264", "-c:a", "aac",
        "-preset", str(config.VIDEO_PRESET),
        "-crf", str(config.VIDEO_CRF),
        "-threads", str(config.VIDEO_THREADS),
        "-s", f"{config.VIDEO_WIDTH}x{config.VIDEO_HEIGHT}",
        "-t", str(config.VIDEO_MAX_SECONDS),
        "-b:v", config.VIDEO_BITRATE, "-b:a", "192k",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        final_output
    ]
    
    res = subprocess.run(cmd_merge, capture_output=True)
    if res.returncode != 0:
        logger.error(f"FFmpeg composite failed: {res.stderr.decode()}")
        # Fallback without subtitles if filter fails
        cmd_merge_fallback = [
            _resolve_ffmpeg_executable(), "-y", "-i", silent_video, "-i", master_audio_path,
            "-c:v", "libx264", "-c:a", "aac",
            "-preset", "ultrafast", "-threads", "1",
            "-s", f"{config.VIDEO_WIDTH}x{config.VIDEO_HEIGHT}",
            "-t", str(config.VIDEO_MAX_SECONDS),
            final_output
        ]
        subprocess.run(cmd_merge_fallback, check=True, timeout=120)
        
    return final_output
