# src/cli/postprocess.py
import json, argparse, os

# 통일: postprocess_unified가 있으면 우선 사용, 없으면 기존 process_pages로 폴백
try:
    from campusmate_ai.ocr_light.ocr.postprocess_unified import process_pages_unified as _process_pages
except Exception:
    from campusmate_ai.ocr_light.ocr.postprocess import process_pages as _process_pages

def main():
    parser = argparse.ArgumentParser(description="Unified OCR Postprocess → Text")
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        pages = json.load(f)

    result = _process_pages(pages)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(result)

    print(f"✅ 통합 후처리 완료 → {args.out}")

if __name__ == "__main__":
    main()
