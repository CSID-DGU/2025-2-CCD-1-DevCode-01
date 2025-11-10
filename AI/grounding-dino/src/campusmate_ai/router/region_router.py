# apps/ai/router/region_router.py
from typing import List, Dict
from PIL import Image
from campusmate_ai.processors.chart.deplot import DeplotWrapper
from campusmate_ai.processors.formula.pix2tex import Pix2TexWrapper
from campusmate_ai.utils.image import save_crop
import numpy as np

try:
    import easyocr
    READER = easyocr.Reader(["ko","en"], gpu=False)
except Exception:
    READER = None

_DEPLOT = None
_PIX2TEX = None

def _get_deplot():
    global _DEPLOT
    if _DEPLOT is None:
        _DEPLOT = DeplotWrapper()
    return _DEPLOT

def _get_pix2tex():
    global _PIX2TEX
    if _PIX2TEX is None:
        _PIX2TEX = Pix2TexWrapper()
    return _PIX2TEX

def _ocr_text(pil_img: Image.Image) -> Dict:
    if READER is None: 
        return {"text": "", "confidence": 0.0}
    arr = np.array(pil_img)
    res = READER.readtext(arr, detail=1, paragraph=True)
    texts, confs = [], []
    for r in res:
        if len(r) >= 3 and r[1]:
            texts.append(str(r[1]))
            confs.append(float(r[2]) or 0.0)
    return {"text": "\n".join(texts).strip(), "confidence": float(np.mean(confs)) if confs else 0.0}

def enrich_detections(image_src, dets: List[Dict], out_dir_crops: str) -> List[Dict]:
    """각 박스를 잘라서 category별로 후처리(Chart=DePlot, Formula=pix2tex, Text=OCR)"""
    out = []
    for d in dets:
        x1,y1,x2,y2 = map(int, d["bbox"])
        # PIL crop
        if isinstance(image_src, Image.Image):
            crop = image_src.crop((x1,y1,x2,y2))
        else:
            from PIL import Image as _Image
            import numpy as np
            crop = _Image.fromarray(image_src[y1:y2, x1:x2])
        crop_path = save_crop(image_src, d["bbox"], out_dir_crops)

        cat = d.get("category","text")
        enriched = {}
        if cat == "chart":
            enriched = _get_deplot().describe(crop, task="Describe the chart succinctly.")
        elif cat == "formula":
            enriched = _get_pix2tex().to_latex(crop)
        elif cat == "text":
            enriched = _ocr_text(crop)
        elif cat == "table":
            # 테이블은 우선 OCR 텍스트만, 구조 복원은 이후 연동
            enriched = _ocr_text(crop)

        out.append({**d, **enriched, "crop_path": crop_path})
    return out
