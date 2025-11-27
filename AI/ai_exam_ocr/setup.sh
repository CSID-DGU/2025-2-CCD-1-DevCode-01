#!/usr/bin/env bash

set -e

echo "📁 프로젝트 초기화 시작..."

# 프로젝트 루트 기준 경로 계산
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

VENV_DIR=".venv"

# 1) 가상환경 생성
if [ ! -d "$VENV_DIR" ]; then
  echo "가상환경 생성 중: $VENV_DIR"
  python -m venv "$VENV_DIR"
else
  echo "가상환경 이미 존재: $VENV_DIR"
fi

# 2) 가상환경 활성화 
echo "✅ 가상환경 활성화: source $VENV_DIR/bin/activate"
# 이 스크립트 안에서는 활성화하지만,
# 사용자가 직접 쓸 땐 'source .venv/bin/activate' 해줘야 함
source "$VENV_DIR/bin/activate"

# 3) pip 업그레이드
echo "pip 업그레이드 중..."
pip install --upgrade pip

# 4) paddleocr만 deps 없이 설치
echo "paddleocr 설치 (no-deps)..."
pip install "paddleocr==2.7.0.3" --no-deps

# 5) 나머지 의존성 설치
echo "requirements.txt 설치..."
pip install -r requirements.txt

# 6) .env 템플릿 생성
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  echo ".env 파일이 없어 템플릿을 생성합니다."

  cat > "$ENV_FILE" << 'EOF'
# ==== API Keys ====
OPENAI_API_KEY=your_openai_api_key_here
ROBOFLOW_API_KEY=your_roboflow_api_key_here

# ==== Detection / Model Settings ====
# Roboflow 모델 ID
MODEL_ID=ccd-pn4pd/8

# 기본 입력 이미지 경로 (원하면 코드에서 override 가능)
IMG_PATH=./test-exam.png

# 출력 디렉토리
OUTPUT_DIR=./exam_outputs
EOF

  echo "✅ .env 템플릿 생성 완료. 값을 채워 넣으세요: $ENV_FILE"
else
  echo "✅ 기존 .env 파일이 있어 건너뜁니다."
fi

echo "환경 설정 완료!"
echo
echo "다음 명령으로 가상환경을 다시 활성화할 수 있어요:"
echo "  source .venv/bin/activate"
echo
echo "파이프라인 실행 예시:"
echo "python src/exam_ocr/pipeline.py ./test-1.jpg ./exam_outputs"
