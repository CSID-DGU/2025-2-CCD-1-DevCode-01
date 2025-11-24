from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
import base64

PROMPT_TEMPLATE = """
너는 시각장애 대학생을 위한 강의 슬라이드 변환 도우미다.
입력은 PDF에서 추출한 한 페이지 이미지 1장이다.

아래 형식으로 출력해라. 불필요한 인사말·설명은 쓰지 마라.

[제목]
- 슬라이드의 핵심 제목이 있을 때만 1줄로 쓴다.

[본문]
- 문단구조를 유지하여 본문의 텍스트 추출 한다. 
- 텍스트를 추출하면서 사전적으로 정의되지 않은 단어는 해당 본문 내용에 맞춰 보정한다. 
- 그림이나 표 안의 내용은 여기서 자세히 반복하지 않는다.

[이미지 설명]
- 학습 내용에 중요한 그림·도식·그래프가 있을 때만 쓴다.
- 여러 이미지가 있을 경우 하나씩 다 설명한다. 
- 배경 이미지, 로고, 디자인용 아이콘 등은 설명하지 않는다.
- 다음과 같은 순서로 이미지를 설명한다. 
- 1. 이미지의 외관을 묘사한다.
- 2. 이미지를 보지 않고도 이해할 수 있도록 본문과 연관지어 핵심을 정리한다.

[표/그래프]
- 표/그래프가 있을 때만 쓴다.
- 다음과 같은 순서로 표를 설명한다.
- 1. 어떤 형태의 표/그래프 인지 설명한다.
- 2. 모든 셀을 나열하지 말고, 비교·범위·추세 등 핵심 정보만 3~5문장으로 요약한다.

규칙:
- 각 섹션 제목([제목], [본문] 등)은 그대로 사용한다.
- 한국어와 다른 언어가 섞여 있을 시 번역하지 않고 해당 언어로 작성한다. 대신 한자는 한글로 변환한다.
- 내용이 없으면 그 섹션은 아예 생략한다.
- 줄임말이나 전문 용어가 많으면 간단히 풀어 쓴다.
"""

llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.3,
)

def vision_ocr(image_bytes):
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    msg = HumanMessage(
        content=[
            {"type": "text", "text": PROMPT_TEMPLATE},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}}
        ]
    )

    response = llm.invoke([msg])
    return response.content
