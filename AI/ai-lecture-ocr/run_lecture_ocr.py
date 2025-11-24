import argparse
import os
import time
from dotenv import load_dotenv

load_dotenv()

from ocr_pipeline.rapid_ocr_blocks import process_page
from ocr_pipeline.llm_postprocess import call_gpt_from_blocks


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="RapidOCR + LLM으로 사진 한 장을 텍스트/요약으로 변환"
    )
    parser.add_argument("image", type=str, help="입력 이미지 경로")
    parser.add_argument("--output", "-o", type=str, default=None)
    args = parser.parse_args()

    if not os.environ.get("GROQ_API_KEY"):
        raise RuntimeError("GROQ_API_KEY가 설정되지 않았습니다.")


  # 걸린 시간 측정
    ocr_start = time.time()
    page = process_page(args.image)
    blocks = page["blocks"]
    ocr_end = time.time()

    llm_start = time.time()
    llm_result = call_gpt_from_blocks(blocks)
    llm_end = time.time()

    elapsed = llm_end - ocr_start

    print(f"OCR/레이아웃: {ocr_end - ocr_start:.2f}초")
    print(f"LLM 처리: {llm_end - llm_start:.2f}초")


    # 출력
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(llm_result)
        print(llm_result)
    else:
        print(llm_result)

    print(f"\n총 소요 시간: {elapsed:.2f}초")


if __name__ == "__main__":
    main()
