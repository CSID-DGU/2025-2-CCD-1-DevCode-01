from __future__ import annotations

import os
import re
import base64
from typing import List, Dict, Any

import cv2
import numpy as np
#from paddleocr import PaddleOCR
from ai_file_ocr.pipeline.rewrite import code_rewrite, process_latex
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY 환경변수를 설정해 주세요.")

_OPENAI_CLIENT = None

def get_openai():
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None:
        _OPENAI_CLIENT = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _OPENAI_CLIENT

TEXTUAL_CLASSES = {"qnum", "text", "choice", "code"}
VISUAL_CLASSES = {"chart", "table"}

# ==============================
# Lazy PaddleOCR (mac hang 방지)
# ==============================
# _OCR_INSTANCE = None

# def get_paddle_ocr():
#     global _OCR_INSTANCE
#     if _OCR_INSTANCE is None:
#         _OCR_INSTANCE = PaddleOCR(
#             lang="korean",
#             ocr_version="PP-OCRv3",
#             use_angle_cls=False,
#         )
#     return _OCR_INSTANCE



# ==============================
# 1. 전처리 / OCR 유틸
# ==============================

def enhance_for_ocr(crop_bgr: np.ndarray, scale: int = 3, pad: int = 8) -> np.ndarray:
    """한글 시험지용 일반 텍스트 전처리."""
    h, w = crop_bgr.shape[:2]
    if h < 10 or w < 10:
        return crop_bgr

    crop_bgr = cv2.copyMakeBorder(
        crop_bgr, pad, pad, pad, pad,
        borderType=cv2.BORDER_CONSTANT,
        value=[255, 255, 255],
    )

    crop_big = cv2.resize(
        crop_bgr,
        None,
        fx=scale,
        fy=scale,
        interpolation=cv2.INTER_CUBIC,
    )

    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]])
    crop_sharp = cv2.filter2D(crop_big, -1, kernel)

    lab = cv2.cvtColor(crop_sharp, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.equalizeHist(l)
    lab = cv2.merge((l, a, b))
    crop_final = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    return crop_final


def enhance_for_code(crop_bgr: np.ndarray, scale: int = 3, pad: int = 4) -> np.ndarray:
    """코드/SQL 전용 이진화 전처리."""
    h, w = crop_bgr.shape[:2]
    if h < 10 or w < 10:
        return crop_bgr

    crop_bgr = cv2.copyMakeBorder(
        crop_bgr, pad, pad, pad, pad,
        borderType=cv2.BORDER_CONSTANT,
        value=[255, 255, 255],
    )
    crop_big = cv2.resize(crop_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(crop_big, cv2.COLOR_BGR2GRAY)
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return cv2.cvtColor(th, cv2.COLOR_GRAY2BGR)


def enhance_for_choice(crop_bgr: np.ndarray, scale: int = 4, pad: int = 8) -> np.ndarray:
    """객관식 보기(선지) 전처리: 크게 키우고 여백만."""
    h, w = crop_bgr.shape[:2]
    if h < 10 or w < 10:
        return crop_bgr

    crop_bgr = cv2.copyMakeBorder(
        crop_bgr, pad, pad, pad, pad,
        borderType=cv2.BORDER_CONSTANT,
        value=[255, 255, 255],
    )
    crop_big = cv2.resize(
        crop_bgr,
        None,
        fx=scale,
        fy=scale,
        interpolation=cv2.INTER_CUBIC,
    )
    return crop_big


# def paddle_ocr_with_newlines(crop_bgr):
#     ocr = get_paddle_ocr()
#     result = ocr.ocr(crop_bgr, cls=True)
#     if not result or not result[0]:
#         return ""
#     lines = [r[1][0] for r in result[0]]
#     return "\n".join(lines).strip()


def _extract_text_from_openai_message(message) -> str:
    """OpenAI SDK message.content 안전 추출."""
    content = message.content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, dict) and "text" in c:
                parts.append(c["text"])
            elif hasattr(c, "text"):
                parts.append(c.text)
        return "\n".join(parts).strip()
    if isinstance(content, str):
        return content.strip()
    return str(content).strip()


# ==============================
# 2. GPT Hybrid OCR
# ==============================

def hybrid_gpt_vision_with_paddle(img_path: str,
                                  kind: str = "text") -> str:
    with open(img_path, "rb") as f:
        image_bytes = f.read()
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    ext = os.path.splitext(img_path)[1].lower()
    mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
    image_url = f"data:{mime};base64,{b64}"

    # kind별 프롬프트
    if kind == "qnum":
        system_prompt = (
            r"너는 시험지의 문항 번호를 정확히 읽어주는 OCR 보정기다.\n"
            r"임의로 추가 설명, 해설, 요약을 절대로 넣지 마라.\n"
            r"이미지 안에 인쇄된 텍스트 전체를, 문항 번호 줄부터 마지막 줄까지 그대로 출력해라.\n"
            r"모든 수식은 LaTeX 문법으로만 출력하라. (\(...\), \[...\], \begin{...}...\end{...} 그대로 유지)\n"
            r"모든 코드(쉘 명령어 포함)는  코드블록(```)으로 감싸서 출력하되 언어명은 작성하지 않는다.\n" 
            r"코드 내부는 여백, 줄바꿈, 공백 포함하여 원본을 그대로 보존한다."
        )
        user_text = (
            "이미지를 보고, 문항 번호 줄과 그 아래에 이어지는 모든 문장을 그대로 적어라.\n"
            "'최종 텍스트는' 같은 설명 문장은 쓰지 마라.\n"
        )
    elif kind == "choice":
        system_prompt = (
            r"너는 시험지의 객관식 보기(선지)를 읽는 OCR 보정기다.\n"
            r"보기 내용 외의 설명, 해설, 요약은 절대로 쓰지 마라.\n"
            r"모든 수식은 LaTeX 문법으로만 출력하라. (\(...\), \[...\], \begin{...}...\end{...} 그대로 유지)\n"
            r"모든 코드(쉘 명령어 포함)는  코드블록(```)으로 감싸서 출력하되 언어명은 작성하지 않는다.\n" 
            r"코드 내부는 여백, 줄바꿈, 공백 포함하여 원본을 그대로 보존한다."
        )
        user_text = (
            "이미지를 보고, 보기들을 한 줄에 하나씩 적어라.\n"
            "예: '① ㄱ', '② ㄴ', '③ ㄷ' 처럼 번호와 기호를 함께 써라.\n"
        )
    else:
        desc = {"text": "지문/본문", "choice": "선지(보기)", "code": "코드/SQL"}.get(kind, "텍스트")
        system_prompt = (
            r"너는 시험지 OCR 결과를 보정하는 어시스턴트이다.\n"
            r"이미지 내용과 Paddle 결과를 참고해 최종 텍스트를 정확하게 만든다.\n"
            r"절대로 '최종 텍스트는 ...' 같은 설명 문장을 쓰지 마라.\n"
            r"모든 수식은 LaTeX 문법으로만 출력하라. (\(...\), \[...\], \begin{...}...\end{...} 그대로 유지)\n"
            r"모든 코드(쉘 명령어 포함)는  코드블록(```)으로 감싸서 출력하되 언어명은 작성하지 않는다.\n" 
            r"코드 내부는 여백, 줄바꿈, 공백 포함하여 원본을 그대로 보존한다."
        )
        user_text = (
            f"이미지 안에는 {desc}가 들어있다.\n"
        )

    client = get_openai()

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {"type": "text", "text": user_text},
                ],
            },
        ],
    )

    return _extract_text_from_openai_message(resp.choices[0].message)


# ==============================
# 3. 텍스트 후처리
# ==============================

def strip_gpt_boilerplate(text: str) -> str:
    # gpt가 "최종 텍스트는~, 다음과 같이~"를 붙여서 제거함
    text = (text or "").strip()
    if not text:
        return ""

    lines = text.splitlines()

    def is_boilerplate(line: str) -> bool:
        line = line.strip()
        if not line:
            return True 
        return (
            "최종 텍스트는" in line
            or "수정되었습니다" in line
            or ("다음은" in line and "텍스트" in line)
        )

    while lines and is_boilerplate(lines[0]):
        lines.pop(0)

    return "\n".join(lines).strip()


def extract_first_code_block(text: str) -> str | None:
    """
    ``` ... ``` 안에 있는 첫 번째 코드블록 내용만 추출.
    못 찾으면 None.
    """
    m = re.search(r"```(?:sql|SQL|plaintext)?\s*([\s\S]*?)```", text)
    if m:
        return m.group(1).strip()
    return None


def normalize_text_for_kind(kind: str, raw: str) -> str:
    """
    JSON에서 text 필드용 정제
    - GPT 보일러플레이트 삭제
    - kind별 줄바꿈/코드블록 처리
    """
    text = strip_gpt_boilerplate(raw)
    if not text:
        return ""

    # # code: 코드블록만 추출
    # if kind == "code":
    #     inner = extract_first_code_block(text)
    #     if inner is not None:
    #         return f"```sql\n{inner}\n```"
    #     return f"```sql\n{text}\n```"

    # choice: 보기 한 줄씩 유지
    if kind == "choice":
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)

    # qnum: 의미 있는 줄바꿈 유지
    if kind == "qnum":
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)

    # text: 문단 줄바꿈 유지
    if text.lstrip().startswith("```"):
        inner = extract_first_code_block(text)
        if inner is not None:
            text = inner

    lines = [line.rstrip() for line in text.splitlines()]

    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()

    return "\n".join(lines)


def build_reading_text(kind: str, raw: str) -> str:
    """displayText 전용."""
    if kind == "chart":
        return "차트 이미지가 있습니다. 원본 이미지를 확인해 주세요."
    if kind == "table":
        return "표 이미지가 있습니다. 원본 이미지를 확인해 주세요."
    return normalize_text_for_kind(kind, raw)


# ==============================
# 4. seq_meta에 하이브리드 OCR 적용
# ==============================

def run_hybrid_ocr_on_seq_meta(seq_meta: List[Dict[str, Any]]):
    total_items = sum(len(q["items"]) for q in seq_meta)
    processed = 0

    for q in seq_meta:
        qnum = q.get("question_number", "unknown")
        print(f"\n[HYBRID] === 문항 {qnum} 시작 ===")

        for item in q["items"]:
            processed += 1
            kind = item["kind"]
            path = item["path"]


            if kind not in TEXTUAL_CLASSES:
                print("    → 시각요소(chart/table)라 OCR 생략")
                continue

            crop = cv2.imread(path)
            if crop is None:
                print("    → 이미지 로드 실패 (건너뜀)")
                item["gpt_hybrid_text"] = ""
                continue

            if kind == "code":
                crop_for_paddle = enhance_for_code(crop)
            elif kind == "choice":
                crop_for_paddle = enhance_for_choice(crop)
            else:
                crop_for_paddle = enhance_for_ocr(crop)

           
            paddle_text = ""  # 지금은 안 씀

           
            gpt_text = hybrid_gpt_vision_with_paddle(path, kind=kind)
            clean_text = code_rewrite(gpt_text)
            clean_text = process_latex(clean_text)
            item["gpt_hybrid_text"] = clean_text

    return seq_meta
