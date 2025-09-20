# Gaze Drill

시선 추적을 통한 눈 운동 훈련 프로그램입니다.

## 설치 및 실행

### 1. 가상환경 설정 (최초 1회)

```bash
./setup_venv.sh
```

이 스크립트는 다음 작업을 수행합니다:
- Python 3.12 가상환경 생성
- 필요한 패키지 설치 (opencv-python, mediapipe, numpy, matplotlib)
- pip 업그레이드

### 2. 프로그램 실행

```bash
./run.sh
```

또는 직접 실행:

```bash
source venv/bin/activate
python3 main.py
```

## 사용법

프로그램 실행 후:

- **'c' 키**: 시선 보정 (중앙을 보고 'c' 키를 누르세요)
- **'r' 키**: 보정 리셋
- **'q' 키**: 프로그램 종료

## 프로그램 설명

1. 카메라를 통해 얼굴을 인식합니다
2. 랜덤하게 생성된 방향(LEFT, RIGHT, UP, DOWN)을 순서대로 따라보세요
3. 각 방향을 지정된 시간(기본 3초) 동안 유지하면 다음 방향으로 진행합니다
4. 모든 방향을 완료하면 프로그램이 종료됩니다

## 요구사항

- Python 3.12
- 웹캠 또는 카메라
- macOS (다른 OS는 스크립트 수정 필요)

## 문제 해결

### Python 3.12가 없는 경우

```bash
# Homebrew로 설치
brew install python@3.12
```

### 가상환경 재설정

```bash
rm -rf venv
./setup_venv.sh
```
