## 강의 중 추가 자료 ocr

강의 슬라이드 → OCR → 레이아웃 분석 → LLM

###  ✅ 주요 기능

- 이미지(슬라이드) 입력 → OCR 자동 추출
- 텍스트 박스 기반 직접 구현한 레이아웃 분석 (1열/2열 감지 포함)
- GPT 기반 자연스러운 문장/요약/문단 재구성
- 명령어 한 줄 실행
- 전체 처리 속도 약 2~3초 (모델 선택에 따라 달라짐)

### ✅ 설치 방법

**1. 프로젝트 세팅**

```bash
cd ai-lecture-ocr

# 가상환경 생성 및 활성화
python -m venv lecture-ocr
source lecture-ocr/bin/activate
# Windows: lecture-ocr\Scripts\activate

# 라이브러리 설치
pip install -r requirements.txt
```

⚠️ 만약 실행했는데 해당 라이브러리를 찾을 수 없다고 뜬다면 가상환경 설치할 곳을 못찾아서 제대로 설치가 안됐을 가능성이 있으니 아래와 같은 식으로 설치해주시면 됩니다.

```bash
python -m pip install opencv-python-headless
```

**2. api key setting**

```ini
GROQ_API_KEY=your_groq_key_here
```

**3. 실행 방법**

```bash
python run_lecture_ocr.py slide-1.png

# 만약 md 파일로 저장하고 싶다면
python run_lecture_ocr.py slide-1.png -o output.md

```

### ✅ 프로젝트 구조

```bash

ai-lecture-ocr/
├── run_lecture_ocr.py    # 메인 실행 스크립트
├── requirements.txt     # 의존성 패키지 목록
├── .env                 # 환경 변수
├── ocr_pipeline/
│   ├── __init__.py
│   ├── rapid_ocr_blocks.py    # OCR + 레이아웃 분석 전체 로직
│   └── gpt_postprocess.py    # GPT 후처리 및 문장 재구성
└── README.md

```

### ✅ 파일 설명

`run_lecture_ocr.py`

메인 실행 스크립트로 이미지 로딩, rapid ocr, 박스 정렬 및 읽기 순서 분석, 문단/목록/제목 블록 구성, 문장 재구성, 처리 시간 로깅을 수행함

`ocr_pipeline/rapid_ocr_blocks.py`

OCR 단계부터 의미 단위 블록 탐지까지 담당함

`ocr_pipeline/gpt_postprocess.py`

OCR 블록을 LLM 입력용 텍스트로 변환하고 자연스러운 문장/Markdown 구조로 재구성하는 모듈임 (Groq(OpenAI 호환 API) 기반 LLM 호출)
