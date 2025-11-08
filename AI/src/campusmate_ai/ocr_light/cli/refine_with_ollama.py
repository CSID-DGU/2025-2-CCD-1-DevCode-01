# src/cli/refine_with_ollama.py
import argparse, time
import requests
from pathlib import Path

DEFAULT_OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_TIMEOUT = 300
RETRY = 2
CHUNK_CHARS = 1800
SYSTEM_PROMPT = (
    "역할: 너는 OCR로 얻은 난해한 텍스트를 사람이 읽기 쉬운 한국어 설명문으로 다듬는 편집자다.\n"
    "목표: 표로 되돌리지 말고, 하나의 자연스러운 설명문(또는 불릿 요약)으로 재작성한다.\n"
    "규칙:\n"
    "1) 표/워터마크/페이지 표시는 제거한다. ([표], dongguk university 등)\n"
    "2) 문장 부호·띄어쓰기·용어를 표준화한다. (예: Iog→log, 0(→O(), N2→N^2)\n"
    "3) 테이블은 만들지 않는다.\n"
    "4) 수식/영문 표기는 의미를 유지하며 올바른 표기로 정정한다. (O(log N), O(N^2) 등)\n"
    "5) 최종 결과만 출력한다. (메타 문구·사족·명령문 금지)\n"
    "6) 수식은 LaTeX 형식으로 유지하되, 잘못된 기호(예: +text{+})는 제거한다.\n"
    "7) 불필요한 TeX 명령은 삭제한다.\n"
    "8) 표/워터마크는 모두 제거한다."
)

def call_ollama(model: str, prompt: str, url: str, timeout: int) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"num_ctx": 1536, "temperature": 0.2},
    }
    last_err = None
    for _ in range(RETRY + 1):
        try:
            r = requests.post(url, json=payload, timeout=timeout)
            if r.status_code == 200:
                data = r.json()
                return data.get("response", "").strip()
            else:
                last_err = f"HTTP {r.status_code}: {r.text[:200]}"
        except requests.exceptions.RequestException as e:
            last_err = str(e)
        time.sleep(2)
    raise RuntimeError(last_err or "ollama call failed")

def chunk_text(s: str, limit: int = CHUNK_CHARS):
    buf, cur = [], []
    size = 0
    for line in s.splitlines():
        l = line.strip()
        if not l:
            l = ""
        add = len(l) + 1
        if size + add > limit and cur:
            buf.append("\n".join(cur))
            cur, size = [], 0
        cur.append(l)
        size += add
    if cur:
        buf.append("\n".join(cur))
    return buf

def refine_page(model: str, page_idx: int, raw_text: str, url: str, timeout: int) -> str:
    chunks = chunk_text(raw_text, CHUNK_CHARS)
    outputs = []
    for i, ck in enumerate(chunks, 1):
        prompt = (
            f"{SYSTEM_PROMPT}\n"
            f"[입력 — 페이지 {page_idx} / 부분 {i}/{len(chunks)}]\n{ck}\n\n"
            f"[출력 — 설명문/불릿(테이블 금지), 최종본만]"
        )
        out = call_ollama(model, prompt, url, timeout)
        outputs.append(out)

    merged = "\n\n".join(outputs)
    final_prompt = (
        f"{SYSTEM_PROMPT}\n"
        f"[입력 — 페이지 {page_idx} 통합]\n{merged}\n\n"
        f"[출력 — 한 단락 요약 + 필요시 불릿(테이블 금지), 최종본만]"
    )
    return call_ollama(model, final_prompt, url, timeout)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)   # out/pages.txt
    ap.add_argument("--out", required=True)     # out/refined.md
    ap.add_argument("--model", default="qwen2.5:1.5b-instruct")
    ap.add_argument("--ollama-host", default="http://localhost:11434")
    ap.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    args = ap.parse_args()

    raw = Path(args.input).read_text(encoding="utf-8")
    url = args.ollama-host + "/api/generate" if not args.ollama_host.endswith("/api/generate") else args.ollama_host

    # 페이지 분리
    pages = []
    cur_idx, cur_buf = None, []
    for line in raw.splitlines():
        if line.strip().startswith("[페이지 "):
            if cur_idx is not None:
                pages.append((cur_idx, "\n".join(cur_buf).strip()))
            try:
                cur_idx = int(line.split("[페이지")[1].split("]")[0].strip())
            except Exception:
                cur_idx = len(pages) + 1
            cur_buf = []
        else:
            cur_buf.append(line)
    if cur_idx is not None:
        pages.append((cur_idx, "\n".join(cur_buf).strip()))
    else:
        pages = [(1, raw)]

    out_lines = []
    for idx, txt in pages:
        out_lines.append(f"# 페이지 {idx}\n")
        try:
            refined = refine_page(args.model, idx, txt, url, args.timeout)
            out_lines.append(refined.strip())
        except Exception as e:
            out_lines.append(f"(오류) 페이지 {idx}: {e}")
        out_lines.append("\n---\n")

    Path(args.out).write_text("\n".join(out_lines).strip() + "\n", encoding="utf-8")
    print(f"✅ 정제 완료 → {args.out}")

if __name__ == "__main__":
    main()
