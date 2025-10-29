# 전체 실행 메인 (표/그래프/텍스트 탐지 + OCR)

import os, glob, argparse, json
from typing import List, Dict
import numpy as np
import torch, torchvision
from PIL import Image
from tqdm import tqdm
from gdino_utils import (
    load_model, preprocess_image, infer_image, load_prompts,
    draw_and_save_with_util, to_pixel_boxes
)

def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter_w = max(0, min(ax2, bx2) - max(ax1, bx1))
    inter_h = max(0, min(ay2, by2) - max(ay1, by1))
    inter = inter_w * inter_h
    ua = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter + 1e-6
    return inter / ua

def nms_by_cat(items: List[Dict], iou_thr: float = 0.5) -> List[Dict]:
    out = []
    for cat in set(d["category"] for d in items):
        cur = [d for d in items if d["category"] == cat]
        if not cur: continue
        boxes = torch.tensor([d["bbox"] for d in cur], dtype=torch.float32)
        scores = torch.tensor([d["score"] for d in cur], dtype=torch.float32)
        keep = torchvision.ops.nms(boxes, scores, iou_thr).tolist()
        out += [cur[i] for i in keep]
    return out

def get_wh(image_src):
    if isinstance(image_src, Image.Image):
        return image_src.size
    arr = np.array(image_src)
    H, W = arr.shape[:2]
    return W, H

def crop_from_image(image_src, bbox):
    if isinstance(image_src, Image.Image):
        return image_src.crop(tuple(map(int, bbox)))
    arr = np.array(image_src)
    pil = Image.fromarray(arr)
    return pil.crop(tuple(map(int, bbox)))

def easyocr_detect_text_boxes(image_src, reader, min_area_ratio, W, H):
    arr = np.array(image_src)
    results = reader.readtext(arr, detail=1, paragraph=False)
    boxes = []
    for r in results:
        if len(r) < 2: continue
        quad = r[0]
        xs = [pt[0] for pt in quad]; ys = [pt[1] for pt in quad]
        x1, y1, x2, y2 = float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))
        area = (x2 - x1) * (y2 - y1)
        if area < min_area_ratio * W * H: continue
        boxes.append([x1, y1, x2, y2])
    return boxes

def to_py(obj):
    import numpy as np, torch
    if isinstance(obj, dict): return {k: to_py(v) for k,v in obj.items()}
    if isinstance(obj, (list, tuple)): return [to_py(x) for x in obj]
    if isinstance(obj, (np.floating, np.integer)): return float(obj)
    if isinstance(obj, np.ndarray): return obj.tolist()
    if torch.is_tensor(obj):
        t = obj.detach().cpu()
        return t.item() if t.ndim==0 else t.tolist()
    return obj

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--prompts", default=os.path.join(os.path.dirname(__file__), "prompts.yaml"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "outputs"))
    ap.add_argument("--box_thr", type=float, default=0.25)
    ap.add_argument("--txt_thr", type=float, default=0.25)
    ap.add_argument("--enable_text_ocr", action="store_true")
    ap.add_argument("--ocr_langs", default="ko,en")
    args = ap.parse_args()

    cfg = load_prompts(args.prompts)
    model, device = load_model()

    if os.path.isdir(args.input):
        paths = sorted([p for p in glob.glob(os.path.join(args.input, "*")) if p.lower().endswith((".jpg",".jpeg",".png"))])
    else:
        paths = [args.input]

    os.makedirs(os.path.join(args.out, "vis"), exist_ok=True)
    os.makedirs(os.path.join(args.out, "json"), exist_ok=True)
    os.makedirs(os.path.join(args.out, "crops"), exist_ok=True)

    reader = None
    if args.enable_text_ocr:
        import easyocr
        langs = [s.strip() for s in args.ocr_langs.split(",") if s.strip()]
        reader = easyocr.Reader(langs, gpu=False)

    for p in tqdm(paths, desc="Processing"):
        image_src, image = preprocess_image(p)
        boxes, scores, labels = infer_image(model, image, cfg["prompt"], cfg["box_thr"], cfg["txt_thr"], device)

        stem = os.path.splitext(os.path.basename(p))[0]
        draw_and_save_with_util(image_src, boxes, scores, labels, os.path.join(args.out, "vis", f"{stem}.jpg"))

        pboxes = to_pixel_boxes(image_src, boxes)
        dets = []
        for b, s, l in zip(pboxes, scores, labels):
            L = l.lower().strip()
            if any(k in L for k in ["table","grid","spreadsheet"]): cat="table"
            elif any(k in L for k in ["chart","graph","plot","axis","bar","line","pie","legend"]): cat="chart"
            else: cat="text"
            dets.append({"bbox":[float(v) for v in b],"score":float(s),"raw_label":l,"category":cat})

        W,H=get_wh(image_src)
        dets=nms_by_cat(dets,0.5)

        # fallback: 텍스트 감지 안되면 EasyOCR 보강
        if reader:
            text_count = sum(1 for d in dets if d["category"]=="text")
            if text_count==0:
                fb_boxes=easyocr_detect_text_boxes(image_src,reader,0.001,W,H)
                for b in fb_boxes:
                    dets.append({"bbox":b,"score":0.3,"raw_label":"easyocr_text","category":"text"})

        # 저장
        payload={"detections":dets}
        with open(os.path.join(args.out,"json",f"{stem}.json"),"w",encoding="utf-8") as f:
            json.dump(to_py(payload),f,ensure_ascii=False,indent=2)

if __name__=="__main__":
    main()