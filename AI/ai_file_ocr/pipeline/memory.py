from typing import List, Dict


class ContextMemory:

    def __init__(self, max_history: int = 3):
        self.max_history = max_history
        self._history: List[Dict] = []

    def add_summary(self, page_number: int, mini_summary: str) -> None:

        if not mini_summary or not mini_summary.strip():
            mini_summary = "(내용 없음)"

        self._history.append(
            {
                "page": int(page_number),
                "summary": mini_summary.strip(),
            }
        )

        if len(self._history) > self.max_history:
            self._history = self._history[-self.max_history :]

    def get_context(self) -> str:
        if not self._history:
            return "(이전 페이지 요약 없음)"

        sorted_history = sorted(self._history, key=lambda x: x["page"])

        lines: List[str] = []
        for h in sorted_history:
            lines.append(f"[페이지 {h['page']} 요약]\n{h['summary']}")

        return "\n\n".join(lines)

    def reset(self) -> None:
        self._history.clear()
