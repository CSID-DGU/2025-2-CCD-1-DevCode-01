# apps/ai/utils/image.py
import os, uuid
from typing import List
from PIL import Image

def save_crop(image_src, bbox, out_dir) -> str:
    os.makedirs(out_dir, exist_ok=True)
    x1,y1,x2,y2 = map(int, bbox)
    if isinstance(image_src, Image.Image):
        crop = image_src.crop((x1,y1,x2,y2))
    else:
        from PIL import Image as _Image
        import numpy as np
        crop = _Image.fromarray(image_src[y1:y2, x1:x2])
    fp = os.path.join(out_dir, f"{uuid.uuid4().hex}.png")
    crop.save(fp)
    return fp
