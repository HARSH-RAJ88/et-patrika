"""
SRT Subtitle generator.
"""
from pipeline.video_studio.core.config import config
from pipeline.video_studio.models.schemas import ScriptSegment

def format_srt_time(seconds: float) -> str:
    h = int(seconds / 3600)
    m = int((seconds % 3600) / 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def split_text_into_chunks(text: str, words_per_chunk: int = 7) -> list[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), words_per_chunk):
        chunks.append(" ".join(words[i:i + words_per_chunk]))
    return chunks

def generate_srt(segments: list[ScriptSegment], output_path: str) -> str:
    """
    Break each segment into 7-8 word chunks.
    Distribute timing proportionally.
    """
    srt_content = []
    seq_num = 1
    
    for seg in segments:
        if not seg.text or seg.duration_seconds <= 0:
            continue
            
        chunks = split_text_into_chunks(seg.text)
        if not chunks:
            continue
            
        chunk_duration = seg.duration_seconds / len(chunks)
        start_time = seg.start_time
        
        for chunk in chunks:
            end_time = start_time + chunk_duration
            
            srt_content.append(f"{seq_num}")
            srt_content.append(f"{format_srt_time(start_time)} --> {format_srt_time(end_time)}")
            srt_content.append(chunk)
            srt_content.append("")
            
            seq_num += 1
            start_time = end_time

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_content))
        
    return output_path
