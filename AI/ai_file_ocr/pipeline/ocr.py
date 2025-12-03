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
지금까지 분석된 페이지들의 문맥 요약은 다음과 같다:

{context}


이 문맥을 참고하여 아래 이미지를 분석하라.


[출력 전체 형식]

반드시 아래 네 섹션만 사용할 수 있다. 이 외의 섹션 이름은 절대 만들지 마라.
섹션에 쓸 내용이 전혀 없다면, 그 섹션 제목과 내용 전체를 아예 출력하지 않는다.

[제목]
- 슬라이드의 핵심 제목이 있을 때만 1줄로 쓴다.

[본문]
- 문단 구조를 유지하여 본문의 텍스트를 정리한다.
- 문장을 자연스럽게 다듬을 수는 있지만, 의미를 바꾸거나 중요한 내용을 생략하지 않는다.

[이미지 설명]
- 학습 내용과 직접 관련된 그림, 도식, 사진, 아이콘이 있을 때만 작성한다.
- 배경 이미지, 로고, 단순 디자인 요소는 설명하지 않는다.
- 이미지의 외관을 묘사한 뒤 이미지를 보지 않고도 이해할 수 있도록 교안 맥락에 맞게 정리한다.
- 이미지 안에 텍스트나 코드가 있으면 모두 읽어준다.

[표/그래프]
- 표나 그래프가 있을 때만 작성한다.
- 어떤 형태의 표/그래프인지 설명하고, 모든 셀을 나열하지 말고 비교·범위·추세 위주로 교안 문맥에 맞게 정리한다.

---

[수식 처리 규칙]

- 슬라이드에 수식이 하나라도 포함되어 있다면, 해당 수식을 모두 찾아 처리한다.
- 수식은 항상 <수식> ... </수식> 형식으로 작성한다. 
- <수식> 태그 안에는 설명, 자연어 문장, 불릿, 한글/영문 설명을 절대 넣지 않는다.
- 태그 안에는 오직 LaTeX 수식만 넣는다. 
- 수식을 요약하거나, 수식의 구조를 바꾸거나, 임의로 수정하지 않는다.
- LaTeX 문법을 최대한 정확하게 지킨다. 확실하지 않으면 이미지에 보이는 형태를 최대한 그대로 옮긴다.

---

[코드 처리 규칙]

- 슬라이드에 코드 블록, 의사코드, 명령어, 스니펫 등이 있다면 모두 찾아 처리한다.
- 코드는 항상 <코드> ... </코드> 형식으로 작성한다.
- 코드는 plain text 형식으로 출력한다.
- 코드 내용을 요약하거나 생략하지 않고, 이미지에 보이는 그대로 옮긴다.

---

[규칙]

- 한국어 외 언어는 번역하지 않고 그대로 표기한다.
- <수식>, </수식>, <코드>, </코드> 태그의 철자를 절대 바꾸지 않는다.
- <수식>과 <코드> 태그 외에는, 새로운 <> 형태 태그를 만들지 않는다.
- 위 규칙을 지키는 것이 최우선이다. 다른 지침과 충돌할 경우, 이 형식 규칙을 우선한다.
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
