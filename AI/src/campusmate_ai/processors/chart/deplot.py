# apps/ai/processors/chart/deplot.py
import torch
from PIL import Image
from typing import Dict
from transformers import AutoProcessor, AutoModelForSeq2SeqLM

class DeplotWrapper:
    def __init__(self, model_name: str = "Salesforce/deplot", device: str | None = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.processor = AutoProcessor.from_pretrained(model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(self.device)
        self.model.eval()

    @torch.inference_mode()
    def describe(self, pil_img: Image.Image, task: str = "Describe the chart in detail."):
        inputs = self.processor(images=pil_img, text=task, return_tensors="pt").to(self.device)
        out_ids = self.model.generate(**inputs, max_new_tokens=256)
        text = self.processor.batch_decode(out_ids, skip_special_tokens=True)[0]
        return {"description": text.strip(), "task": task}
