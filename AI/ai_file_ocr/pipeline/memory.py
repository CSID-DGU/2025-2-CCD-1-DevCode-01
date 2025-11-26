from llama_index.core import SummaryIndex, Document
from typing import Optional


class ContextMemory:
    def __init__(self):
        # 빈 SummaryIndex 생성
        self.index = SummaryIndex([])

    def add_summary(self, page_number: int, mini_summary: str):
        """
        페이지 요약(mini_summary)을 SummaryIndex에 추가
        """
        if not mini_summary or not mini_summary.strip():
            mini_summary = "(내용 없음)"

        doc = Document(
            text=mini_summary,
            metadata={"page": page_number}
        )
        self.index.insert(doc)

    def get_context(self, k: int = 5) -> str:
        """
        최근 요약 k개(기본 5개)를 기반으로 문맥 생성
        (필요하면 전체로 확장 가능)
        """
        # SummaryIndex → Retriever
        retriever = self.index.as_retriever(
            similarity_top_k=k
        )
        nodes = retriever.retrieve("문맥 요청")

        # 정렬(페이지 순)
        nodes = sorted(nodes, key=lambda n: n.metadata.get("page", 0))

        # context 텍스트 조립
        context_texts = [
            f"[페이지 {n.metadata.get('page')} 요약]\n{n.text}"
            for n in nodes
        ]

        return "\n\n".join(context_texts)

