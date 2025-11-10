## grounding dino (영역 분할)

### ⚙️ 환경 설정

**1️⃣ 가상환경 생성 및 활성화**

```bash
cd AI
python3 -m venv .venv
source .venv/bin/activate    # (Windows: .venv\Scripts\activate)
```

**2️⃣ 필수 라이브러리 설치**

```bash
pip install --upgrade pip
pip install -r requirements.txt

```

**3️⃣ 모델 가중치 다운로드**

```bash
mkdir -p models
curl -L -o models/groundingdino_swint_ogc.pth \
https://hf-mirror.com/IDEA-Research/GroundingDINO/resolve/main/weights/groundingdino_swint_ogc.pth

```

만약 모델 설치가 잘 되지 않는다면, https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth 를 url에 입력해 직접 다운 받은 후 옮겨주세요.

⚙️ 정상 파일 크기: 약 662M

확인:

```bash
ls -lh models/groundingdino_swint_ogc.pth
```

정상 출력

```bash
-rw-r--r--  1 ohchanju  staff   662M 10 29 15:49 models/groundingdino_swint_ogc.pth
```

### 🧩 실행 방법

Grounding DINO + EasyOCR OCR 실행:

```bash
python src/infer_gdino.py \
  --input ./sample/slide01.jpg \
  --box_thr 0.18 --txt_thr 0.18 \
  --enable_text_ocr --ocr_langs "ko,en"

```

sample 안에 샘플 사진 존재해야 합니다.

### 🧾 출력 결과

실행 후 outputs/ 폴더가 자동 생성됩니다.

```pgsql
outputs/
├── vis/
│   └── slide01.jpg      ← 탐지된 영역 시각화 이미지
└── json/
    └── slide01.json     ← 결과 JSON
```
