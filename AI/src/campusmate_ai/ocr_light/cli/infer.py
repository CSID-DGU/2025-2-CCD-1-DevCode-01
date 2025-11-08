# src/cli/infer.py
import argparse, os, json
from pathlib import Path
import yaml
from campusmate_ai.ocr_light.ocr.page_to_text import PageToText

def _discover_inputs(inp: Path):
    if inp.is_file():
        return [str(inp)]
    exts = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".pdf"}
    return [str(p) for p in sorted(inp.iterdir()) if p.suffix.lower() in exts]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="이미지/PDF/폴더")
    ap.add_argument("--out", required=True, help="out/pages.json")
    ap.add_argument("--config", default="configs/app.yaml")
    ap.add_argument("--min-conf", type=float, default=0.70)
    ap.add_argument("--det-batch", type=int, default=1)
    ap.add_argument("--rec-batch", type=int, default=8)
    args = ap.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    # CLI 힌트 덮어쓰기(엔진이 지원하면 사용, 아니면 무시)
    cfg.update({"min_conf": args.min_conf, "det_batch": args.det_batch, "rec_batch": args.rec_batch})

    inp = Path(args.input)
    files = _discover_inputs(inp)

    runner = PageToText(cfg)
    if hasattr(runner, "run"):
        pages = runner.run(files)  # type: ignore
    else:
        pages = runner.run_images(files)  # type: ignore

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)
    print(f"[DONE] wrote {len(pages)} pages -> {args.out}")

if __name__ == "__main__":
    main()
