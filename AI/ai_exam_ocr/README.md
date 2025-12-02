# Exam OCR Pipeline

**시험지 이미지**를 입력으로 받아,  
문항 단위로 쪼개고, Roboflow + GPT Vision을 이용해 텍스트를 추출한 뒤  
프론트에서 바로 쓸 수 있는 형태의 `exam_questions.json`을 생성하는 파이프라인입니다.

---

## 1. 실행 전 준비 사항

### 1-1. 의존성 설치

```bash
# 가상환경 활성화
source .venv/bin/activate  # macOS / Linux
# .venv\Scripts\activate   # Windows

pip install -r requirements.txt
pip install paddleocr==2.7.0.3 --no-deps #다른 의존성이 추가되지 않도록 Paddleocr은 no deps로 따로 설치 필요합니다.
```

### 1-2. 환경 변수 설정

.env 파일에 아래 키들을 설정해야 합니다.

```env
ROBOFLOW_API_KEY=
ROBOFLOW_MODEL_ID=
OPENAI_API_KEY=
```

## 2. 실행 방법

### 2-1. 스크립트 직접 실행

레포 루트 기준:

```bash
python src/exam_ocr/pipeline.py ./examples/test2.jpg ./exam_outputs
```

./examples/test2.jpg : 입력 시험지 이미지 경로
./exam_outputs : 결과 이미지/JSON이 저장될 출력 폴더

### 2-2. 출력 파일

성공적으로 실행되면:

exam_outputs/

- q{문항번호}_{index}_{kind}.png : 각 문항 요소별 잘라낸 이미지

- q{문항번호}\_full.png : 문항 전체 영역 크롭 이미지

- sequential_meta.json : 내부용 step-by-step 메타 정보

- exam_questions.json : 프론트에서 바로 사용할 최종 JSON

## 폴더 구조 및 역할

현재 핵심 파이프라인 코드는 src/exam_ocr/ 아래 3개 파일로 나뉘어 있습니다.

```bash
src/
  exam_ocr/
    ├── detection_layout.py   # 박스 검출 + 문항 레이아웃/그룹핑
    ├── ocr_hybrid.py         # 전처리  + GPT Vision + 텍스트 후처리
    └── pipeline.py           # 전체 흐름 orchestration + JSON 생성 + CLI
```

### 3-1. detection_layout.py

**역할**

- Roboflow Object Detection을 이용해 시험지에서 영역(box) 검출

- qnum 박스에서 문항 번호만 별도로 OCR (ocr_qnum_only)

- 시험지가 1단/2단인지 레이아웃 분석

- detect_layout_and_mid_x : 중간 분할선(mid_x) 추정

- 각 qnum을 기준으로 위/아래 영역을 잘라 문항 단위로 content box 묶기

- 최종적으로 structured_questions 생성

### 3-2. ocr_hybrid.py

**역할**

1. 이미지 전처리

- enhance_for_ocr : 일반 텍스트/지문용 전처리
- enhance_for_code : 코드/SQL 전용 이진화 전처리
- enhance_for_choice : 객관식 보기(선지)용 스케일업 전처리

2. PaddleOCR 래퍼

- paddle_ocr_with_newlines : 줄 단위 텍스트 추출

3. GPT Vision 하이브리드

- hybrid_gpt_vision_with_paddle(img_path, paddle_text, kind)
- kind에 따라 프롬프트를 달리 사용
- qnum : 문항 번호 줄 + 조건/주의 문장까지 그대로 읽어오기
- choice : 객관식 선지만 한 줄씩
- text / code : 본문/코드 보정

4. 텍스트 후처리

- strip_gpt_boilerplate : "최종 텍스트는 ..." 같은 GPT 설명 제거

- extract_first_code_block : 안의 코드만 추출

- normalize_text_for_kind(kind, raw)

- qnum : 의미 있는 줄바꿈 유지 (\n)

- choice : 선지 한 줄씩 유지

- code : 코드 블록 형태로 랩핑

- text : 불필요한 공백/겹치는 줄바꿈 정리

- build_reading_text(kind, raw)

- chart / table 은 실제 OCR 대신 안내 문구

5. seq_meta에 하이브리드 OCR 적용

- 각 crop 이미지에 대해 전처리 → 2. PaddleOCR → 3. GPT Vision 보정

### 3-3. pipeline.py

**역할**

- 문항별 crop 생성 (build_sequential_crops)
- structured_questions를 받아 각 문항을 구성 요소별로 잘라 PNG로 저장
- 하이브리드 OCR 적용
- public API

  1. Roboflow로 박스 검출
  2. build_structured_questions로 문항 묶음 생성
  3. build_sequential_crops로 crop + seq_meta 생성

  4. run_hybrid_ocr_on_seq_meta로 텍스트 보정

  5. build_exam_json_for_views로 최종 JSON 생성 후 파일 저장
