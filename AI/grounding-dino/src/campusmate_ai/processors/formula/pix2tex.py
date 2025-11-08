# apps/ai/processors/formula/pix2tex.py
from typing import Dict
from PIL import Image
import torch

from pix2tex.cli import LatexOCR  # 라이트한 추론 래퍼

class Pix2TexWrapper:
    def __init__(self):
        # 내부에서 CUDA 감지해서 사용함
        self.ocr = LatexOCR()

    @torch.inference_mode()
    def to_latex(self, pil_img: Image.Image) -> Dict:
        latex = self.ocr(pil_img)
        return {"latex": latex}
