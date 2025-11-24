from typing import Optional
from llama_index.core import SummaryIndex, Document


def create_index() -> SummaryIndex:
    """비어있는 SummaryIndex 생성"""
    return SummaryIndex.from_documents([])


def get_context(index: SummaryIndex, max_chars: int = 800) -> str:
    """현재까지 요약 기반 global context 문자열 반환"""
    try:
        summary = index.get_summary()
    except Exception:
        return ""

    if not summary:
        return ""

    summary = summary.strip()
    if len(summary) > max_chars:
        return summary[:max_chars]
    return summary


def update_context(index: SummaryIndex, page_number: int, mini_summary: Optional[str]) -> None:
    """특정 페이지 mini-summary를 SummaryIndex에 추가"""
    if not mini_summary:
        return

    text = f"[페이지 {page_number}]\n{mini_summary.strip()}"
    doc = Document(text=text)
    index.insert(doc)
