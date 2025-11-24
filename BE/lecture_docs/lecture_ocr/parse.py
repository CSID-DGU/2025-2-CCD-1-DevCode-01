from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import PydanticOutputParser

# 1) Pydantic 모델 정의
class OcrParsed(BaseModel):
    title: str | None = Field(description="페이지 제목")
    body: str = Field(description="본문 텍스트")
    images: list[str] = Field(default_factory=list, description="이미지 설명 목록")

# 2) 파서 생성
parser = PydanticOutputParser(pydantic_object=OcrParsed)

# 3) 프롬프트 생성
PARSE_PROMPT = """
아래 OCR 결과를 JSON 구조로 변환하라.

{format_instructions}

OCR 결과:
{ocr_text}
"""

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 4) 파싱 실행 함수
def parse_ocr_text(text: str) -> dict:
    prompt = PARSE_PROMPT.format(
        format_instructions=parser.get_format_instructions(),
        ocr_text=text
    )
    response = llm.invoke(prompt)
    parsed = parser.parse(response.content)
    return parsed.dict()
