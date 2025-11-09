from __future__ import annotations
import re
from typing import List, Dict, Tuple
import numpy as np

try:
    import cv2
except Exception:
    cv2 = None

# ---- 문자열 정리(공통 오인식 보정) ------------------------------------
GENERAL_FIXES = [
    (r"\bIog\b", "log"),
    (r"\bIinear\b", "linear"),
    (r"0\(", "O("),
    (r"\|\|", " | "),
    (r"\s{2,}", " "),
    (r"\bIogin\.jsp\b", "login.jsp"),
    (r"\bIogin\b", "login"),
    (r"SQL삽입", "SQL 삽입"),
]

def clean_general_lines(lines: List[str]) -> List[str]:
    out, seen = [], set()
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        for pat, rep in GENERAL_FIXES:
            s = re.sub(pat, rep, s, flags=re.IGNORECASE)
        low = s.lower()
        # 워터마크/잡음 컷
        if any(w in low for w in ("dongguk", "jniversity")):
            continue
        if len(s) <= 1:
            continue
        key = re.sub(r"\W+", "", s).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out

# ---- 페이지 시각요소 탐지(라이트 휴리스틱) ----------------------------
class HeuristicDetector:
    def __init__(self, table_h=25, table_v=25, eq_ratio=0.30):
        self.table_h = int(table_h)
        self.table_v = int(table_v)
        self.eq_ratio = float(eq_ratio)

    def detect_table(self, img_gray: np.ndarray) -> Tuple[bool, Tuple[int, int]]:
        if cv2 is None:
            return (False, (0, 0))
        bw = cv2.adaptiveThreshold(img_gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                   cv2.THRESH_BINARY_INV, 15, 10)
        hk = cv2.getStructuringElement(cv2.MORPH_RECT, (self.table_h, 1))
        vk = cv2.getStructuringElement(cv2.MORPH_RECT, (1, self.table_v))
        horiz = cv2.morphologyEx(bw, cv2.MORPH_OPEN, hk, iterations=1)
        vert  = cv2.morphologyEx(bw, cv2.MORPH_OPEN, vk, iterations=1)
        if np.count_nonzero(horiz) + np.count_nonzero(vert) < 500:
            return (False, (0, 0))
        # 러프한 선 수 추정
        h_lines = int(np.sum(np.sum(horiz, axis=1) > 0) // 5)
        v_lines = int(np.sum(np.sum(vert,  axis=0) > 0) // 5)
        return (True, (max(1, h_lines), max(1, v_lines)))

    def detect_chart(self, ocr_items: List[Dict]) -> bool:
        kw = ("axis", "축", "legend", "범례", "평균", "분포", "표준편차", "series")
        hits = 0
        for it in ocr_items:
            t = (it.get("text") or "").lower()
            if any(k in t for k in kw):
                hits += 1
        return hits >= 2

    def detect_equation(self, ocr_items: List[Dict]) -> Tuple[bool, float]:
        math_chars = set("=+−-*/^()[]{}Σ√∫≤≥≈≠·:.,^_%")
        total = 0; mathy = 0
        for it in ocr_items:
            s = it.get("text") or ""
            total += len(s)
            mathy += sum(1 for ch in s if (ch in math_chars) or ch.isdigit())
        if total == 0:
            return (False, 0.0)
        ratio = mathy / total
        return (ratio > self.eq_ratio, ratio)

    def detect_figure(self, img_gray: np.ndarray, ocr_items: List[Dict]) -> bool:
        if cv2 is None:
            return False
        edges = cv2.Canny(img_gray, 80, 160)
        edge_ratio = float(np.count_nonzero(edges)) / float(edges.size)
        text_area = sum((it["bbox"][2]-it["bbox"][0])*(it["bbox"][3]-it["bbox"][1]) for it in ocr_items if "bbox" in it)
        h, w = img_gray.shape[:2]
        text_ratio = text_area / max(1, (h*w))
        return (edge_ratio > 0.05) and (text_ratio < 0.15)

    def contains_codepath(self, text: str) -> bool:
        return bool(re.search(r"(/[\w\-/]+(?:\.\w+)?)(?:\s|$)", text))
