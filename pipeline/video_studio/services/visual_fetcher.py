"""
Visual Fetcher using Pexels API.
"""
import os
import shutil
from pathlib import Path
import requests
from io import BytesIO
from PIL import Image, ImageEnhance
from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger

def create_gradient_backup(output_path: str, width: int, height: int):
    """Fallback if Pexels fails."""
    img = Image.new("RGB", (width, height), color="#1e1e1e")
    img.save(output_path)
    return output_path


def _copy_prewarmed_fallback(output_dir: Path, slot: int) -> str | None:
    fallback_dir = config.ASSETS_DIR / "fallback_images"
    if not fallback_dir.exists():
        return None

    candidates = sorted(
        [p for p in fallback_dir.iterdir() if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
    )
    if not candidates:
        return None

    src = candidates[slot % len(candidates)]
    dst = output_dir / f"fallback_{slot}{src.suffix.lower()}"
    shutil.copyfile(src, dst)
    return str(dst)

def fetch_images(keywords: list[str], count: int, job_id: str, fast_mode: bool = False) -> list[str]:
    logger.info(f"Fetching {count} visuals for keywords: {keywords}")
    output_dir = config.TEMP_DIR / job_id / "images"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    paths = []
    
    if not config.PEXELS_API_KEY:
        logger.warning("No Pexels API key. Using backup gradients.")
        for i in range(count):
            paths.append(create_gradient_backup(str(output_dir / f"fallback_{i}.jpg"), config.VIDEO_WIDTH, config.VIDEO_HEIGHT))
        return paths

    # Construct search strategy
    search_terms = []
    if len(keywords) >= 2:
        search_terms.append(f"{keywords[0]} {keywords[1]}")
    search_terms.extend(keywords)
    search_terms.extend(["India business", "Mumbai skyline", "stock market chart"])

    if fast_mode:
        # Keep fast mode responsive by limiting remote search breadth.
        search_terms = search_terms[:4]

    headers = {"Authorization": config.PEXELS_API_KEY}
    downloaded = 0
    
    for term in search_terms:
        if downloaded >= count:
            break
            
        per_page = 3 if fast_mode else 5
        url = f"https://api.pexels.com/v1/search?query={term}&per_page={per_page}&orientation=landscape"
        try:
            resp = requests.get(url, headers=headers, timeout=6 if fast_mode else 10)
            if resp.status_code == 200:
                data = resp.json()
                for photo in data.get("photos", []):
                    if downloaded >= count:
                        break
                    
                    img_url = photo["src"]["large2x"]
                    img_resp = requests.get(img_url, timeout=6 if fast_mode else 10)
                    if img_resp.status_code == 200:
                        img = Image.open(BytesIO(img_resp.content)).convert("RGB")
                        
                        # 1. Resize and crop to 16:9
                        target_ratio = config.VIDEO_WIDTH / config.VIDEO_HEIGHT
                        img_ratio = img.width / img.height
                        
                        if img_ratio > target_ratio:
                            new_w = int(img.height * target_ratio)
                            left = (img.width - new_w) // 2
                            img = img.crop((left, 0, left + new_w, img.height))
                        else:
                            new_h = int(img.width / target_ratio)
                            top = (img.height - new_h) // 2
                            img = img.crop((0, top, img.width, top + new_h))
                            
                        img = img.resize((config.VIDEO_WIDTH, config.VIDEO_HEIGHT), Image.Resampling.LANCZOS)
                        
                        # 2. Darken for text readability
                        enhancer = ImageEnhance.Brightness(img)
                        img = enhancer.enhance(0.75)
                        
                        out_path = str(output_dir / f"img_{downloaded}.jpg")
                        img.save(out_path, quality=85)
                        paths.append(out_path)
                        downloaded += 1
        except Exception as e:
            logger.warning(f"Pexels fetch failed for term '{term}': {e}")
            continue

    # Fill remaining with gradients
    while downloaded < count:
        prewarmed = _copy_prewarmed_fallback(output_dir, downloaded)
        if prewarmed:
            paths.append(prewarmed)
        else:
            logger.warning(f"Falling back to gradient for slot {downloaded}")
            paths.append(create_gradient_backup(str(output_dir / f"fallback_{downloaded}.jpg"), config.VIDEO_WIDTH, config.VIDEO_HEIGHT))
        downloaded += 1

    return paths
