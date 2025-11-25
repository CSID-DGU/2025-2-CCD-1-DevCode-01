# ai/pipeline/summarize.py
import os
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


MINI_SUMMARY_PROMPT = """
다음 페이지 OCR 결과를 3~5줄 mini-summary로 압축해라.
교안 전체의 흐름 파악을 돕는 핵심 개념만 요약하고,
문장은 짧고 명확하게 써라.

=== 원문 ===
{content}
"""


def make_mini_summary(content: str) -> str:
    # 너무 긴 경우 잘라서 토큰 방지
    max_chars = 4000
    if len(content) > max_chars:
        content = content[:max_chars]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.1,
        messages=[
            {"role": "user", "content": MINI_SUMMARY_PROMPT.format(content=content)}
        ]
    )

    summary = response.choices[0].message.content.strip()

    print('⭐'+summary)

    return summary
