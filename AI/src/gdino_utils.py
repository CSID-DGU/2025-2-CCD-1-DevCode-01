# Grounding DINO 로딩 및 유틸

import os, torch
from PIL import Image
from groundingdino.util.inference import load_model as gdino_load_model, load_image, predict as gdino_predict, annotate as gdino_annotate
import numpy as np
import yaml
import cv2

ROOT = os.path.dirname(__file__)
CFG_PATH = os.path.join(ROOT, "../models/GroundingDINO_SwinT_OGC.py")
CKPT_PATH = os.path.join(ROOT, "../models/groundingdino_swint_ogc.pth")

def load_prompts(path):
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    prompt = ", ".join([", ".join(v["aliases"]) for v in data["categories"].values()])
    return {"categories": data["categories"], "prompt": prompt, "box_thr": 0.3, "txt_thr": 0.3}

def load_model():
    with open(CKPT_PATH, "rb") as f:
        checkpoint = torch.load(f, map_location="cpu", weights_only=False)

    model = gdino_load_model(CFG_PATH, CKPT_PATH)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    model.eval()
    return model, device

def preprocess_image(path):
    image_source, image = load_image(path)
    return image_source, image

def infer_image(model, image, prompt, box_thr, txt_thr, device):
    boxes, logits, phrases = gdino_predict(model=model, image=image, caption=prompt, box_threshold=box_thr, text_threshold=txt_thr, device=device)
    return boxes, logits, phrases

def draw_and_save_with_util(image_src, boxes, scores, labels, out_path: str):
    t_boxes = torch.as_tensor(boxes, dtype=torch.float32)
    t_scores = torch.as_tensor(scores, dtype=torch.float32)
    vis = gdino_annotate(image_source=image_src, boxes=t_boxes, logits=t_scores, phrases=labels)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    if isinstance(vis, np.ndarray):
        cv2.imwrite(out_path, vis[:, :, ::-1])
    else:
        vis.save(out_path)

def to_pixel_boxes(image_src, boxes):
    W, H = image_src.size if isinstance(image_src, Image.Image) else (image_src.shape[1], image_src.shape[0])
    rescaled = []
    for box in boxes:
        x1, y1, x2, y2 = box
        rescaled.append([x1 * W, y1 * H, x2 * W, y2 * H])
    return rescaled