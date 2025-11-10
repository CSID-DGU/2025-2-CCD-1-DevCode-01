# src/ocr/postprocess.py
from __future__ import annotations
import re
from typing import List, Dict, Tuple

# -------------------- 튜닝 상수 --------------------
LINE_GAP_Y = 32          # 같은 줄로 묶을 y-중앙 허용오차(px)
PAIR_DY    = 42          # 좌/우 짝짓기 y-허용오차(px)
JOIN_GAP_X = 40          # (옵션) 토큰 붙여쓰기 판단 간격(px) — 현재는 공백기반 병합이라 미사용
CONF_MIN   = 0.0         # elements에 conf가 있을 경우 필터; 없으면 무시

WATERMARKS = {"dongguk", "university", "jniversity", "plass", "연구실"}
HEADER_HINTS = ("이름", "표기", "자주 사용되는", "목차", "차례")

# -------------------- 정규화 규칙 --------------------
FIXES = [
    (r"\b0\s*\(", "O("),           # 0(  -> O(
    (r"\bO\s*\(\s*1\s*\)", "O(1)"),
    (r"(?i)\bIog", "log"),         # Iog -> log
    (r"(?i)\bL0g", "log"),         # L0g -> log
    (r"(?i)\bIinear", "linear"),
    (r"(?i)\bN2\b", "N^2"),
    (r"(?i)\bN3\b", "N^3"),
    (r"(?i)\b2\s*N\b", "2^N"),
    (r"\s{2,}", " "),
]

BIGOH_EQUIV = {
    "O(N  logN)": "O(N logN)",
    "O(N log N)": "O(N logN)",
    "O(N2)": "O(N^2)",
    "O(N3)": "O(N^3)",
    "O(2N)": "O(2^N)",
}

BULLETS = ("•", "▪", "▶", "➤", "►", "-", "–", "—")

# 파일 상단에 추가
BIGOISH = re.compile(
    r"(?:^|\s)[0O]\s*\(\s*[^)]+\s*\)|"     # O(…)
    r"\b[Nn]\s*log\s*[Nn]\b|"             # N log N 류
    r"\blog\s*[Nn]\b|"                    # log N 류
    r"\b2\s*\^\s*[Nn]\b"                  # 2^N
)


# -------------------- 유틸 --------------------

def is_bigoish(s: str) -> bool:
    t = _apply_fixes(s)
    return bool(BIGOISH.search(t))

def _mid_y(b): return (b[1] + b[3]) / 2.0
def _mid_x(b): return (b[0] + b[2]) / 2.0

def _has_conf(e: Dict) -> bool:
    return isinstance(e.get("conf", None), (int, float))

def _is_watermark_or_page(s: str) -> bool:
    low = s.lower().strip()
    if any(w in low for w in WATERMARKS): return True
    if re.fullmatch(r"\[\d+/\d+\]", low): return True
    return False

def _apply_fixes(s: str) -> str:
    t = s.replace("|", "/").strip()  # 파이프 → 슬래시
    for pat, rep in FIXES:
        t = re.sub(pat, rep, t)
    # 괄호 균형 간단 보정
    if t.count("(") > t.count(")"): t += ")"
    return t

def _norm_bigoh(s: str) -> str:
    x = _apply_fixes(s)
    # O( … ) 내부 대문자화는 과한 경우가 있어 보수적으로
    x = x.replace("LOGN", "logN").replace("LOG N", "logN")
    for a, b in BIGOH_EQUIV.items():
        x = x.replace(a, b)
    # 흔한 I->l, 0->O 교정의 추가 케이스
    x = x.replace("O(Iog", "O(log)").replace("O(IogN", "O(logN)")
    return x

# -------------------- 정렬/병합 --------------------
def sort_by_reading_order(items: List[Dict]) -> List[Dict]:
    return sorted(items, key=lambda it: (_mid_y(it["bbox"]), it["bbox"][0]))

def merge_lines(items: List[Dict]) -> List[Dict]:
    """y-중앙값 기반 줄 병합, 한 줄은 좌→우 정렬 후 공백으로 결합"""
    merged, cur, cur_y = [], [], None
    for it in sort_by_reading_order(items):
        if _has_conf(it) and it["conf"] < CONF_MIN:
            continue
        ymid = _mid_y(it["bbox"])
        if cur_y is None or abs(ymid - cur_y) > LINE_GAP_Y:
            if cur:
                merged.append(_pack_line(cur))
                cur = []
            cur_y = ymid
        cur.append(it)
    if cur:
        merged.append(_pack_line(cur))
    return merged

def _pack_line(arr: List[Dict]) -> Dict:
    arr = sorted(arr, key=lambda t: t["bbox"][0])
    text = " ".join((t["text"] or "").strip() for t in arr if (t.get("text") or "").strip())
    bbox = [
        min(x["bbox"][0] for x in arr),
        min(x["bbox"][1] for x in arr),
        max(x["bbox"][2] for x in arr),
        max(x["bbox"][3] for x in arr),
    ]
    return {"bbox": bbox, "text": text}

def clean_lines(lines: List[Dict]) -> List[Dict]:
    out, seen = [], set()
    for it in lines:
        s = _apply_fixes(it["text"])
        if not s or _is_watermark_or_page(s):
            continue
        key = re.sub(r"\W+", "", s).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"bbox": it["bbox"], "text": s})
    return out

# -------------------- 칼럼 추정 & 짝짓기 --------------------
def _split_two_columns(lines: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """중앙 x-값의 히스토그램 큰 간격으로 1~2열 추정."""
    if not lines: return [], []
    xs = sorted(_mid_x(l["bbox"]) for l in lines)
    gaps = [(xs[i+1]-xs[i], i) for i in range(len(xs)-1)]
    if not gaps: return lines, []
    gaps.sort(reverse=True)
    gmax, idx = gaps[0]
    gmean = sum(g for g,_ in gaps)/max(1, len(gaps))
    if gmax < 1.5*gmean:
        # 1열로 판단
        return lines, []
    cut = xs[idx]
    left  = [l for l in lines if _mid_x(l["bbox"]) <= cut]
    right = [l for l in lines if _mid_x(l["bbox"]) >  cut]
    return left, right

def _pair_left_right(left: List[Dict], right: List[Dict], dy: int = PAIR_DY) -> List[Tuple[str, str]]:
    out = []
    r_filtered = [r for r in right if is_bigoish(r["text"])]
    r_sorted = sorted(r_filtered, key=lambda r: _mid_y(r["bbox"]))
    used = [False]*len(r_sorted)
    for l in sorted(left, key=lambda l: _mid_y(l["bbox"])):
        ly = _mid_y(l["bbox"])
        best, bj, bd = None, -1, 1e9
        for j, r in enumerate(r_sorted):
            if used[j]: continue
            ry = _mid_y(r["bbox"])
            d = abs(ry - ly)
            if d < bd:
                bd, bj, best = d, j, r
        if best and bd <= dy:
            used[bj] = True
            name = l["text"]
            note = _norm_bigoh(best["text"]) if "O(" in best["text"] else best["text"]
            out.append((name, note))
    return out

# -------------------- 메인 변환 --------------------
def page_to_text(page: Dict) -> str:
    items = [
        {"bbox": e["bbox"], "text": (e.get("text") or ""), "conf": e.get("conf")}
        for e in page.get("elements", [])
        if (e.get("text") or "").strip()
    ]

    # 1) 줄 병합 → 2) 클린업
    lines = clean_lines(merge_lines(items))

    # 3) 표 헤더/워터마크류 제거(너무 공격적이면 아래 두 줄 주석)
    lines = [l for l in lines if not any(h in l["text"] for h in HEADER_HINTS)]
    lines = [l for l in lines if not re.match(r"^\s*\[\s*(표|그림|다이어그램)\s*\]", l["text"])]

    # 4) 두 칼럼 표일 가능성 탐지 후 매칭
    left, right = _split_two_columns(lines)
    pairs = _pair_left_right(left, right, dy=PAIR_DY) if right else []

    out: List[str] = []
    if pairs:
        out.append("자주 사용되는 빅오 표기")
        out.append("이름 / 표기")
        for nm, oh in pairs:
            out.append(f"{nm} — {oh}")

    # 5) 불릿/본문 라인 보강 (페어링 못한 라인 포함)
    def _bulletize(s: str) -> str:
        if re.match(r"^\s{2,}\S", s):  # 들여쓰기만 있는 경우 불릿 승격
            return "• " + s.strip()
        if re.match(r"^\s*[–—\-•▶►▪]\s+", s):
            return s.strip()
        return s

    used = set(re.sub(r"\W+","",x).lower() for x in out)
    for l in lines:
        t = l["text"].strip()
        k = re.sub(r"\W+","",t).lower()
        if k in used: 
            continue
        # Big-O 표기 일반 교정
        if "O(" in t:
            t = _norm_bigoh(t)
        t = _bulletize(t)
        if t and not _is_watermark_or_page(t):
            out.append(t)
            used.add(k)

    # 6) 마무리: 빈 줄 제거, 중복 공백 정리
    out = [re.sub(r"\s{2,}", " ", s).strip() for s in out if s.strip()]
    return "\n".join(out) if out else ""

def process_pages(pages_json: List[Dict]) -> str:
    chunks = []
    for p in pages_json:
        body = page_to_text(p)
        if body:
            chunks.append(f"[페이지 {p['page']}]\n{body}")
    return "\n\n".join(chunks)
