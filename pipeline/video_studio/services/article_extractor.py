"""
URL/Text Article Extractor (Fallback mode).
"""
import trafilatura
from bs4 import BeautifulSoup
from readability import Document
import requests
from urllib.parse import urlparse
from pydantic import BaseModel
from typing import Optional

class ExtractedArticle(BaseModel):
    title: str
    content: str
    source: str
    url: Optional[str] = None
    word_count: int

def get_source_from_url(url: str) -> str:
    domain = urlparse(url).netloc.lower()
    if 'economictimes' in domain: return 'Economic Times'
    if 'livemint' in domain: return 'Mint'
    if 'moneycontrol' in domain: return 'Moneycontrol'
    if 'business-standard' in domain: return 'Business Standard'
    if 'reuters' in domain: return 'Reuters'
    if 'bloomberg' in domain: return 'Bloomberg'
    return domain.replace('www.', '')

def extract_from_url(url: str) -> ExtractedArticle:
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        # Fallback to requests if trafilatura blocked
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        resp = requests.get(url, headers=headers, timeout=15)
        downloaded = resp.text if resp.status_code == 200 else None

    if not downloaded:
        raise ValueError(f"Failed to fetch content from {url}")

    # Method 1: Trafilatura
    text = trafilatura.extract(downloaded)
    title = ""
    
    # Method 2: Readability (better for titles sometimes)
    doc = Document(downloaded)
    title = doc.title()
    
    if not text:
        # Method 3: BeautifulSoup Fallback
        soup = BeautifulSoup(doc.summary(), 'lxml')
        text = soup.get_text(separator='\n\n', strip=True)

    if not text:
        raise ValueError("Could not extract meaningful content.")

    words = text.split()
    if len(words) > 2500:
        text = " ".join(words[:2500])
        
    source = get_source_from_url(url)

    return ExtractedArticle(
        title=title or "Extracted Article",
        content=text,
        source=source,
        url=url,
        word_count=len(text.split())
    )

def extract_from_text(text: str, title: str = "Pasted Text") -> ExtractedArticle:
    words = text.split()
    if len(words) > 2500:
        text = " ".join(words[:2500])
        
    return ExtractedArticle(
        title=title,
        content=text,
        source="Direct Input",
        word_count=len(text.split())
    )
