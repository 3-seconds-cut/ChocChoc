#!/bin/bash

# Gaze Drill 실행 스크립트
echo "=== Gaze Drill 실행 ==="

# 현재 디렉토리 확인
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 가상환경 확인
if [ ! -d "venv" ]; then
    echo "❌ 가상환경이 설정되어 있지 않습니다."
    echo "먼저 다음 명령어를 실행하세요:"
    echo "  ./setup_venv.sh"
    exit 1
fi

# 가상환경 활성화
echo "🔄 가상환경 활성화 중..."
source venv/bin/activate

# Python 스크립트 실행
echo "🚀 Gaze Drill 시작..."
echo ""
echo "사용법:"
echo "  - 'c' 키: 시선 보정 (중앙을 보고 'c' 누르기)"
echo "  - 'r' 키: 보정 리셋"
echo "  - 'q' 키: 종료"
echo ""

python3 main.py

echo ""
echo "프로그램이 종료되었습니다."
