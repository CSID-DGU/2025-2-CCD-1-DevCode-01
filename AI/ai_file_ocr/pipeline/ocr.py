import base64
import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import List, Tuple
import fitz  
from ai_file_ocr.pipeline.rewrite import latex_rewrite, code_rewrite

#이미지 변환
def pdf_to_images(pdf_bytes: bytes, dpi: int = 150) -> List[Tuple[int, bytes]]:

    pdf = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: List[Tuple[int, bytes]] = []

    for page_num, page in enumerate(pdf, start=1):
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        pages.append((page_num, img_bytes))

    pdf.close()
    return pages

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


PROMPT_TEMPLATE = """
너는 시각장애 대학생을 위한 강의 슬라이드 분석 도우미다.
지금까지 분석된 페이지들의 문맥 요약은 다음과 같다:

{context}


이 문맥을 참고하여 아래 이미지를 분석하라.
반드시 아래 네 섹션만 사용하고 그 외의 섹션 이름은 절대 만들지 마라.
섹션에 쓸 내용이 전혀 없다면, 그 섹션 제목과 내용 전체를 아예 출력하지 않는다.

중요 규칙
- 모든 수식은 LaTeX 문법으로만 출력하라. (\(...\), \[...\], \begin{...}...\end{...} 그대로 유지)
- 모든 코드(쉘 명령어 포함)는  코드블록(```)으로 감싸서 출력하되 언어명은 작성하지 않는다. 
- 코드 내부는 여백, 줄바꿈, 공백 포함하여 원본을 그대로 보존한다.
- 한국어 외 언어는 번역하지 않고 원문 그대로 유지한다.

[제목]
- 슬라이드의 핵심 제목이 있을 때만 한 줄로 작성.

[본문]
- 본문의 텍스트를 추출. 
- 의미 변경 금지, 핵심 내용 생략 금지.

[이미지 설명]
- 슬라이드에 실제 삽화/도식/도형/사진이 있을 때만 작성.
- 이미지 안에 텍스트·코드·수식이 보일 경우, 요약하지 말고 보이는 대로 모두 읽어라. 
- 이미지 안에 텍스트가 전혀 없는 경우에만, 이미지의 외관을 묘사한 뒤 교안 맥락에 맞게 의미를 정리하라.
- 단순 장식용 배경, 로고, 디자인 요소는 설명하지 않는다.

[표/그래프]
- 표나 그래프가 있을 때만 작성.
- 어떤 형태의 표/그래프인지 설명하고, 모든 셀을 나열하지 말고 비교·범위·추세 위주로 교안 문맥에 맞게 정리

이제 위 규칙에 따라 결과를 생성하라.

"""

def analyze_page_with_context(image_bytes: bytes, context: str) -> str:

    print("⭐context:"+context)
    system_prompt = PROMPT_TEMPLATE.replace("{context}", context)

    img_b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model="gpt-4o",
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "아래 이미지를 분석해줘."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img_b64}"
                        }
                    },
                ]
            }
        ],
    )



    raw = response.choices[0].message.content.strip()

    clean = latex_rewrite(raw)
    clean = code_rewrite(clean)

    return clean
