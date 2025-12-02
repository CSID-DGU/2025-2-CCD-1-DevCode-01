from llama_index.core import SummaryIndex, Document
from typing import Optional, List

class ContextMemory:
    def __init__(self):
        # SummaryIndex 자체가 LLM으로 문맥 자동 생성함
        self.index = SummaryIndex([])

    def add_page(self, page_number: int, page_text: str):
        """
        페이지 전체 텍스트를 그대로 넣음.
        요약은 LlamaIndex 내부 LLM이 자동 수행.
        """
        if not page_text or not page_text.strip():
            page_text = "(내용 없음)"

        doc = Document(
            text=page_text,
            metadata={"page": page_number}
        )

        # SummaryIndex에 삽입 → 자동 요약 발생
        self.index.insert(doc)

    def get_context(self, k: int = 5) -> str:
        """SummaryIndex에서 자동 생성된 문맥을 k개 가져오기"""

        retriever = self.index.as_retriever(similarity_top_k=k)
        nodes = retriever.retrieve("문맥 요청")

        nodes = sorted(nodes, key=lambda n: n.metadata.get("page", 0))

        return "\n\n".join(
            f"[페이지 {n.metadata['page']}] {n.text}"
            for n in nodes
        )
