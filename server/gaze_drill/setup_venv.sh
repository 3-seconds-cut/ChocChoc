#!/bin/bash

# Gaze Drill 가상환경 설정 스크립트
echo "=== Gaze Drill 가상환경 설정 ==="

# 현재 디렉토리 확인
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "작업 디렉토리: $SCRIPT_DIR"

# Python 3.12 확인
if ! command -v python3.12 &> /dev/null; then
    echo "❌ Python 3.12가 설치되어 있지 않습니다."
    echo "다음 명령어로 설치하세요:"
    echo "  brew install python@3.12"
    exit 1
fi

echo "✅ Python 3.12 확인됨"

# 가상환경 생성
echo "📦 가상환경 생성 중..."
python3.12 -m venv venv

if [ $? -eq 0 ]; then
    echo "✅ 가상환경 생성 완료"
else
    echo "❌ 가상환경 생성 실패"
    exit 1
fi

# 가상환경 활성화
echo "🔄 가상환경 활성화 중..."
source venv/bin/activate

# pip 업그레이드
echo "⬆️ pip 업그레이드 중..."
pip install --upgrade pip

# 패키지 설치
echo "📚 필요한 패키지 설치 중..."
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ 패키지 설치 완료"
    echo ""
    echo "🎉 가상환경 설정이 완료되었습니다!"
    echo ""
    echo "가상환경을 활성화하려면:"
    echo "  source venv/bin/activate"
    echo ""
    echo "프로그램을 실행하려면:"
    echo "  ./run.sh"
    echo "  또는"
    echo "  python3 main.py"
else
    echo "❌ 패키지 설치 실패"
    exit 1
fi
