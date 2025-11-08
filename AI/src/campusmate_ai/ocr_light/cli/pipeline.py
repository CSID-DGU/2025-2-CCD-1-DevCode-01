# src/cli/pipeline.py
import argparse, json, time, os, re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# (1) OCR → elements JSON
from src.ocr.page_to_text import PageToText

# (2) JSON → TXT
# 통일: postprocess_unified가 있으면 우선 사용, 없으면 기존 process_pages로 폴백
try:
    from src.ocr.postprocess_unified import process_pages_unified as _process_pages
except Exception:
    from src.ocr.postprocess import process_pages as _process_pages

# (3) TXT → MD (Ollama)
import requests

def _refine_with_ollama(
    text: str,
    model: str = "qwen2.5:1.5b-instruct",
    host: str = "http://localhost:11434",
    timeout: int = 120,
    system: str | None = None,
):
    sys_prompt = system or (
        "너는 강의 슬라이드 요약 도우미야. 입력은 OCR 텍스트다. "
        "표/불릿/문장 경계를 보존해 간결한 한국어 설명문으로 정리해. "
        "사실추가/상상 금지, 입력에 없는 내용은 쓰지 마. 수식/기호는 가능한 한 그대로 보존."
    )
    payload = {
        "model": model,
        "prompt": (
            f"{sys_prompt}\n\n--- OCR 텍스트 ---\n{text}\n\n"
            "위 내용을 1) 한 단락 요약, 2) 핵심 불릿(3~6개), 3) 수식/숫자 보정(있다면) 순서로 Markdown으로 출력해."
        ),
        "stream": False,
        "options": {"temperature": 0.2},
    }
    url = f"{host}/api/generate"
    r = requests.post(url, json=payload, timeout=timeout)
    r.raise_for_status()
    out = r.json().get("response", "").strip()
    return out or text

def _strip_page_headers(s: str) -> str:
    # [페이지 N] 단독 라인 제거
    return "\n".join(
        line for line in s.splitlines()
        if not re.fullmatch(r"\s*\[페이지\s+\d+\]\s*", line.strip())
    )

def _discover_inputs(input_path: str):
    """폴더/이미지/PDF 자동 처리: PageToText.run에 그대로 넘길 수 있게 경로 반환."""
    p = Path(input_path)
    if not p.exists():
        raise FileNotFoundError(input_path)
    if p.is_file():
        return [str(p)]
    # 디렉터리면 이미지/ PDF만 골라 정렬
    exts = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".pdf"}
    files = [str(pp) for pp in sorted(p.iterdir()) if pp.suffix.lower() in exts]
    if not files:
        raise RuntimeError(f"처리 가능한 파일이 없습니다: {input_path}")
    return files

def main():
    ap = argparse.ArgumentParser(description="Light OCR end-to-end pipeline (one-shot, fast)")
    ap.add_argument("--input", required=True, help="이미지/폴더/PDF 경로")
    ap.add_argument("--out", required=True, help="최종 결과 파일 경로 (.txt 또는 .md 권장)")
    ap.add_argument("--keep", action="store_true", help="중간 산출물(JSON/TXT) 저장")
    ap.add_argument("--no-refine", action="store_true", help="Ollama 정제 단계 생략 (TXT로 종료)")
    ap.add_argument("--no-page-headers", action="store_true", help="출력(TXT/MD)에서 페이지 헤더 제거")


    # ⏩ 속도/리소스 관련 옵션
    ap.add_argument("--min-conf", type=float, default=0.70, help="OCR 최소 신뢰도 필터 (0~1)")
    ap.add_argument("--det-batch", type=int, default=1, help="(가능하면) 감지 배치 크기 전달")
    ap.add_argument("--rec-batch", type=int, default=8, help="(가능하면) 인식 배치 크기 전달")
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 2, help="정제(LLM) 병렬 쓰레드 수")
    ap.add_argument("--pages-limit", type=int, default=0, help="앞쪽 N페이지만 처리(0=전체)")

    # Ollama
    ap.add_argument("--model", default="qwen2.5:1.5b-instruct", help="Ollama 모델명")
    ap.add_argument("--ollama-host", default="http://localhost:11434", help="Ollama 서버 호스트")
    ap.add_argument("--timeout", type=int, default=120, help="Ollama 요청 타임아웃(초)")
    # 긴 페이지에서 context 오버 방지를 위해 페이지별로 정제(기본). 한꺼번에 합쳐 한 번만 정제하려면 --merge-refine
    ap.add_argument("--merge-refine", action="store_true", help="모든 페이지를 하나로 합쳐 1회 정제")

    args = ap.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 0) 입력 탐색(폴더/파일/PDF)
    files = _discover_inputs(args.input)

    # 1) OCR → JSON(elements)
    t0 = time.time()
    # PageToText 쪽에 전달 가능한 힌트들(엔진에서 사용하지 않더라도 무해)
    cfg = {
        "min_conf": args.min_conf,
        "det_batch": args.det_batch,
        "rec_batch": args.rec_batch,
    }
    runner = PageToText(cfg)
    # PageToText 가 run() 과 run_images() 중 무엇을 지원하든 안전하게 처리
    if hasattr(runner, "run"):
        pages = runner.run(files)  # type: ignore
    else:
        pages = runner.run_images(files)  # type: ignore
    if args.pages_limit and args.pages_limit > 0:
        pages = pages[: args.pages_limit]
    t1 = time.time()

    # 중간 JSON 저장(옵션)
    json_path = out_path.with_suffix(".pages.json")
    if args.keep:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(pages, f, ensure_ascii=False, indent=2)

    # 2) JSON → TXT (통합 후처리)
    txt = _process_pages(pages)
    t2 = time.time()

    txt_path = out_path.with_suffix(".txt")
    if args.keep or args.no_refine or out_path.suffix.lower() == ".txt":
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(txt)

    txt = _process_pages(pages)
    if args.no_page_headers:
        txt = _strip_page_headers(txt)

    # 3) TXT → MD (Ollama, 선택)
    if args.no_refine:
        # 최종 산출물을 --out 으로 저장
        if out_path.suffix.lower() != ".txt":
            out_path = txt_path
        print(f"[DONE] OCR:{t1-t0:.2f}s  TXT:{t2-t1:.2f}s  → {out_path}")
        return

    # 페이지 구분 헤더 기반 분할
    pages_buf = []
    cur = []
    cur_idx = 1
    for line in txt.splitlines():
        if line.strip().startswith("[페이지 "):
            if cur:
                pages_buf.append((cur_idx, "\n".join(cur).strip()))
            try:
                # 헤더가 “[페이지 X]” 라고 가정
                cur_idx = int(line.split("[페이지")[1].split("]")[0].strip())
            except Exception:
                cur_idx = (cur_idx + 1) if pages_buf else 1
            cur = []
        else:
            cur.append(line)
    if cur:
        pages_buf.append((cur_idx, "\n".join(cur).strip()))
    if not pages_buf:
        pages_buf = [(1, txt)]

    md_result = []

    if args.merge_refine:
        # 모든 페이지를 합쳐 한 번만 정제(짧은 자료일 때 매우 빠름)
        merged = "\n\n".join(
            [body for _, body in pages_buf if body.strip()]
        ).strip()
        md = _refine_with_ollama(
            merged,
            model=args.model,
            host=args.ollama_host,
            timeout=args.timeout,
        )
        md_result.append(md.strip())
    else:
        # 페이지별 정제 → ThreadPool로 병렬 처리(네트워크 I/O bound)
        def _task(idx_body):
            idx, body = idx_body
            if not body.strip():
                return idx, "(빈 페이지)"
            try:
                out = _refine_with_ollama(
                    body,
                    model=args.model,
                    host=args.ollama_host,
                    timeout=args.timeout,
                )
                return idx, out.strip()
            except Exception as e:
                return idx, f"(오류) 페이지 {idx}: {e}"

        with ThreadPoolExecutor(max_workers=max(1, int(args.workers))) as ex:
            futs = {ex.submit(_task, ib): ib[0] for ib in pages_buf}
            done = []
            for fut in as_completed(futs):
                idx, out = fut.result()
                done.append((idx, out))
            for idx, out in sorted(done, key=lambda x: x[0]):
                md_result.append(f"{out}\n\n---") 

    final_md = "\n".join(md_result).strip() + "\n"

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(final_md)

    t3 = time.time()
    print(f"[DONE] OCR:{t1-t0:.2f}s  TXT:{t2-t1:.2f}s  MD:{t3-t2:.2f}s  → {out_path}")

if __name__ == "__main__":
    main()
