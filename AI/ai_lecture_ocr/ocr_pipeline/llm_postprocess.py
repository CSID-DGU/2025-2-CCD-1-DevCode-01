import os
from ai_file_ocr.pipeline.rewrite import process_latex, code_rewrite
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"))


def blocks_to_text(blocks):
    """
    title / paragraph / bullet_list를 하나의 큰 텍스트로 합치기
    """
    parts = []

    for b in blocks:
        btype = b.get("type")
        if btype == "title":
            parts.append(f"[제목] {b.get('text', '')}")
        elif btype == "paragraph":
            parts.append(b.get("text", ""))
        elif btype == "bullet_list":
            items = b.get("items", [])
            for it in items:
                parts.append(f"- {it}")
        else:
            if "text" in b:
                parts.append(b["text"])

    return "\n".join(p for p in parts if p.strip())

def strip_think_block(text: str) -> str:
    start = text.find("<think>")
    end = text.find("</think>")

    if start != -1 and end != -1 and end > start:
        return text[end + len("</think>"):].lstrip()
    return text



def call_gpt_from_blocks(blocks):
    block_text = blocks_to_text(blocks)

    prompt = f"""
너는 시각장애 학우를 위한 학습자료 제작 보조자야.
아래는 슬라이드 한 장을 OCR과 레이아웃 분석을 통해 정제한 텍스트야.

오탈자, 문단 깨짐, bullet 누락 등이 있을 수 있으니 다음 기준으로 재구성해줘:

1) 제목 추출 (슬라이드 핵심 주제)
2) 본문을 자연스러운 문장으로 재작성 (필요하면 문장 분리/문단 구분)
3) bullet / 목록은 bullet 항목으로 나누기
4) 표/그림은 시각 정보 없이 이해되도록 문장으로 설명 (단, 표나 그림이 있었고 어떤걸 의미하는지 설명 필요)
5) 불필요한 정보(페이지 번호, 로고 등) 제거
6) 시각장애 학우가 들을 것을 고려해 명확하고 간단하게 작성

출력 형식:

# 제목

## 내용
- 문단 1
- 문단 2

## 핵심 요약
- 요약 1
- 요약 2

출력 규칙 :
- 모든 수식은 LaTeX 문법으로만 출력하라. (\(...\), \[...\], \begin{...}...\end{...} 그대로 유지)
- 모든 코드(쉘 명령어 포함)는  코드블록(```)으로 감싸서 출력하되 언어명은 작성하지 않는다. 
- 코드 내부는 여백, 줄바꿈, 공백 포함하여 원본을 그대로 보존한다.

아래는 OCR 텍스트야:

{block_text}
"""

    resp = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    raw = resp.choices[0].message.content
    clean = strip_think_block(raw)

    clean = code_rewrite(clean)
    
    clean = process_latex(clean)

    return clean