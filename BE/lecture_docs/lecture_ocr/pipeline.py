from langchain_openai import ChatOpenAI
from .vision import vision_ocr
from .parse import parse_ocr_text

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)


def run_lecture_ocr(pages):
    raw_results = []
    global_summary = ""  

    for number, img_bytes in pages:

        ocr_text = vision_ocr(img_bytes)

        parsed = parse_ocr_text(ocr_text)
        raw_results.append((number, parsed))

    rewritten_pages = []

    for number, parsed in raw_results:
        rewrite_prompt = f"""
너는 슬라이드 OCR 결과를 '정확하게 보정하는 텍스트 교정기'다.

아래 규칙을 반드시 지켜라:
- 원본 Vision OCR 결과의 구조(제목 / 본문 / 이미지 설명)를 그대로 유지한다.
- 슬라이드에 실제 있는 텍스트는 최대한 그대로 보존한다.
- 전체 문맥(global summary)은 오탈자 보정, 끊긴 문장 보완 정도,이미지 설명 궤화에만 활용한다.
- 슬라이드에 없는 추론 내용 금지.

[전체 문맥 요약]
{global_summary}

[원본 페이지 OCR 결과]
제목: {parsed['title']}
본문: {parsed['body']}
이미지 설명: {parsed['images']}

위 정보를 기반으로 '원본을 최대한 보존하면서 오류만 보정한' 슬라이드 텍스트만 출력하라.
"""
        improved = llm.invoke(rewrite_prompt).content
        rewritten_pages.append((number, improved))

    return rewritten_pages, global_summary
