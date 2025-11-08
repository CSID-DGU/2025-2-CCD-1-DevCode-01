import os
import torch
from PIL import Image
from groundingdino.util.inference import (
    load_model as gdino_load_model,
    load_image,
    predict as gdino_predict,
    annotate as gdino_annotate,
)
import numpy as np
import yaml
import cv2
from tempfile import NamedTemporaryFile


ROOT = os.path.dirname(__file__)
CFG_PATH = os.path.join(ROOT, "../../models/GroundingDINO_SwinT_OGC.py")
CKPT_PATH = os.path.join(ROOT, "../../models/groundingdino_swint_ogc.pth")


def load_prompts(path: str):
    """
    - 프롬프트를 문장 단위로 만들어 GDINO가 더 안정적으로 해석하도록 함
    - table 전용 프롬프트(2패스 탐지)에 함께 반환
    """
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    def to_sentence(vs):
        return ". ".join(vs) + "."

    cats = data["categories"]
    prompt = ". ".join([to_sentence(v["aliases"]) for v in cats.values()])
    table_only = to_sentence(cats["table"]["aliases"])

    return {
        "categories": cats,
        "prompt": prompt,
        "table_prompt": table_only,
        "box_thr": 0.25,
        "txt_thr": 0.25,
    }


def load_model():
    # weights_only=False는 torch 버전에 따라 경고 회피용 (안전)
    with open(CKPT_PATH, "rb") as f:
        _ = torch.load(f, map_location="cpu", weights_only=False)

    model = gdino_load_model(CFG_PATH, CKPT_PATH)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    model.eval()
    return model, device


def preprocess_image(path: str):
    image_source, image = load_image(path)
    return image_source, image


def infer_image(model, image, prompt, box_thr, txt_thr, device):
    boxes, logits, phrases = gdino_predict(
        model=model,
        image=image,
        caption=prompt,
        box_threshold=box_thr,
        text_threshold=txt_thr,
        device=device,
    )
    return boxes, logits, phrases


def draw_and_save_with_util(image_src, boxes, scores, labels, out_path: str):
    t_boxes = torch.as_tensor(boxes, dtype=torch.float32)
    t_scores = torch.as_tensor(scores, dtype=torch.float32)
    vis = gdino_annotate(
        image_source=image_src, boxes=t_boxes, logits=t_scores, phrases=labels
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    if isinstance(vis, np.ndarray):
        cv2.imwrite(out_path, vis[:, :, ::-1])
    else:
        vis.save(out_path)


def to_pixel_boxes(image_src, boxes):
    if isinstance(image_src, Image.Image):
        W, H = image_src.size
    else:
        H, W = image_src.shape[:2]

    rescaled = []
    for box in boxes:
        # 좌표 정규화 (x2<x1 또는 y2<y1 뒤집기 방지)
        x1, y1, x2, y2 = map(float, box)
        if x2 < x1:
            x1, x2 = x2, x1
        if y2 < y1:
            y1, y2 = y2, y1

        # 픽셀 단위로 변환
        rescaled.append([x1 * W, y1 * H, x2 * W, y2 * H])

    return rescaled



# ---------- 얇은 그리드(스프레드시트) 회수를 위한 전처리 ----------
def enhance_for_tables(image_src):
    """
    얇은 격자선(스프레드시트류)을 살리기 위한 전처리:
    - CLAHE로 대비 향상
    - 가벼운 샤프닝
    - 적응형 이진화 후 invert
    - GDINO 입력 채널로 변환
    """
    arr = np.array(image_src) if isinstance(image_src, Image.Image) else image_src.copy()
    if arr.ndim == 2:
        arr = cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    sharp = cv2.GaussianBlur(clahe, (0, 0), 1.0)
    sharp = cv2.addWeighted(clahe, 1.6, sharp, -0.6, 0)

    bw = cv2.adaptiveThreshold(
        sharp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 3
    )
    bw = cv2.bitwise_not(bw)
    return cv2.cvtColor(bw, cv2.COLOR_GRAY2RGB)

def preprocess_np_for_gdino(np_rgb):
    """
    enhance_for_tables()가 반환한 np.ndarray(RGB)를
    GroundingDINO 전처리 파이프라인(load_image)을 통해
    torch 텐서로 변환한다.
    """
    if np_rgb.ndim == 2:
        np_rgb = cv2.cvtColor(np_rgb, cv2.COLOR_GRAY2RGB)
    pil = Image.fromarray(np_rgb.astype(np.uint8))

    # load_image는 경로 기반이라 임시 파일로 저장하여 재사용
    os.makedirs(os.path.join(ROOT, "..", "tmp"), exist_ok=True)
    with NamedTemporaryFile(suffix=".png", delete=False, dir=os.path.join(ROOT, "..", "tmp")) as tf:
        pil.save(tf.name)
        _, image = load_image(tf.name)  # torch tensor 반환
    return image