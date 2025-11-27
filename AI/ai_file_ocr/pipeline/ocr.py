import base64
import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import List, Tuple
from io import BytesIO
import fitz  

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
지금까지 분석된 페이지들의 요약은 다음과 같다:

{context}


이 문맥을 참고하여 아래 이미지를 분석하라.

규칙:
- 각 섹션 제목([제목], [본문] 등)은 그대로 사용하되 내용이 없으면 생략한다.
- 수식이나 코드가 포함될 경우 그대로 두되, 반드시 <수식>…</수식>, <코드>…</코드> 와 같이 인라인 태그로 감싸라.
- 수식/코드는 절대 자연어로 풀어 쓰지 않는다. 원본 형태를 최대한 유지한다.
- 추측성 맺음말은 하지 않는다.
- 코드/수식은 절대 요약하지 않는다.
- 다른 언어가 섞여 있을 시 번역하지 않고 해당 언어로 작성한다.
- 한문은 한글로 변환한다.

[제목]
- 슬라이드의 핵심 제목이 있을 때만 1줄로 쓴다.

[본문]
- 문단구조를 유지하여 본문의 텍스트 추출 한다. 

[이미지 설명]
- 수업 내용과 관련 없는 배경 이미지, 로고, 디자인용 아이콘 등은 설명하지 않는다.
- 이미지의 외관을 묘사한 뒤 이미지를 보지 않고도 이해할 수 있도록 교안 맥락에 맞게 정리한다.
- 이미지에 텍스트가 있으면 텍스트를 모두 다 읽어준다.

[표/그래프]
- 표/그래프가 있을 때만 쓴다.
- 어떤 형태의 표/그래프 인지 설명한 뒤 모든 셀을 나열하지 말고, 비교·범위·추세 등 교안 문맥에 맞게 정리한다.

"""

def analyze_page_with_context(image_bytes: bytes, context: str) -> str:

    print("⭐context:"+context)

    img_b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model="gpt-4o",
        temperature=0.2,
        messages=[
            {"role": "system", "content": PROMPT_TEMPLATE.format(context=context)},
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

    return response.choices[0].message.content.strip()
