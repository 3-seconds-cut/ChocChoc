// src/components/RevivalGame.tsx
import React, { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";

export type BlinkState = "UNKNOWN" | "OPEN" | "CLOSING" | "CLOSED" | "OPENING";

interface RevivalGameProps {
  isVisible: boolean;
  blinkState: BlinkState;
  onGameComplete: () => void;
  onGameCancel: () => void;
  cameraReady?: boolean;
  videoElement?: HTMLVideoElement | null;
}

// 부활 게임: 5초 눈감기를 2번 반복
const BLINK_CYCLES = 2;
const HOLD_DURATION = 5000; // 5초
const PROGRESS_UPDATE_INTERVAL = 50; // 50ms마다 진행률 업데이트

// 애니메이션
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 10px rgba(76, 175, 80, 0.3); }
  50% { box-shadow: 0 0 20px rgba(76, 175, 80, 0.6); }
  100% { box-shadow: 0 0 10px rgba(76, 175, 80, 0.3); }
`;

// 스타일드 컴포넌트
const GameOverlay = styled.div<{ isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: ${props => props.isVisible ? 'flex' : 'none'};
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 15000;
  backdrop-filter: blur(10px);
`;

const GameContainer = styled.div`
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 30px;
  padding: 50px;
  text-align: center;
  color: white;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
  max-width: 500px;
  width: 90%;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin: 0 0 20px 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  color: #4caf50;
`;

const Instructions = styled.p`
  font-size: 1.2rem;
  margin: 20px 0;
  color: #e8e8e8;
  line-height: 1.5;
`;

const ProgressContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 30px;
  margin: 30px 0;
  flex-wrap: wrap;
`;

const CycleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

const ProgressCircle = styled.div<{
  isActive: boolean;
  isCompleted: boolean;
  progress: number;
}>`
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 4px solid ${props =>
    props.isCompleted ? '#4caf50' :
    props.isActive ? '#ffd93d' :
    'rgba(255, 255, 255, 0.3)'
  };
  background: ${props =>
    props.isCompleted ? '#4caf50' :
    props.isActive ? 'rgba(255, 217, 61, 0.2)' :
    'rgba(255, 255, 255, 0.1)'
  };
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  transition: all 0.3s ease;
  animation: ${props => props.isActive ? pulse : 'none'} 1s infinite;

  ${props => props.isCompleted && `
    animation: ${glow} 2s infinite;
  `}

  &::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      ${props => props.isActive || props.isCompleted ? '#4caf50' : 'transparent'} 0deg,
      ${props => props.isActive || props.isCompleted ? '#4caf50' : 'transparent'} ${props => props.progress * 3.6}deg,
      transparent ${props => props.progress * 3.6}deg
    );
    z-index: -1;
  }
`;

const CycleLabel = styled.div<{ isActive: boolean; isCompleted: boolean }>`
  font-size: 1rem;
  color: ${props =>
    props.isCompleted ? '#4caf50' :
    props.isActive ? '#ffd93d' :
    '#e8e8e8'
  };
  font-weight: 600;
`;

const BlinkStatusDisplay = styled.div<{ blinkState: BlinkState }>`
  font-size: 1.8rem;
  margin: 20px 0;
  color: ${props =>
    props.blinkState === "CLOSED" ? '#4caf50' :
    props.blinkState === "OPEN" ? '#ffd93d' :
    '#ff6b6b'
  };
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 30px;
  justify-content: center;
`;

const Button = styled.button<{ variant: 'primary' | 'secondary'; disabled?: boolean }>`
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: bold;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.3s ease;
  min-width: 120px;
  opacity: ${props => props.disabled ? 0.5 : 1};

  ${props => props.variant === 'primary' ? `
    background: linear-gradient(135deg, #4caf50, #66bb6a);
    color: white;
    box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
    }
  ` : `
    background: rgba(255, 255, 255, 0.1);
    color: #e8e8e8;
    border: 2px solid rgba(255, 255, 255, 0.3);

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }
  `}

  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

const getBlinkStateEmoji = (blinkState: BlinkState): string => {
  switch (blinkState) {
    case "CLOSED": return "😴";
    case "OPEN": return "👁️";
    case "CLOSING": return "😑";
    case "OPENING": return "😊";
    default: return "❓";
  }
};

const getBlinkStateText = (blinkState: BlinkState): string => {
  switch (blinkState) {
    case "CLOSED": return "눈 감음 (좋아요!)";
    case "OPEN": return "눈 뜸";
    case "CLOSING": return "눈 감는 중";
    case "OPENING": return "눈 뜨는 중";
    default: return "상태 인식 중";
  }
};

export const RevivalGame: React.FC<RevivalGameProps> = ({
  isVisible,
  blinkState,
  onGameComplete,
  onGameCancel,
  cameraReady = true,
  videoElement = null,
}) => {
  const [currentCycle, setCurrentCycle] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [completedCycles, setCompletedCycles] = useState<boolean[]>(new Array(BLINK_CYCLES).fill(false));

  // 게임 시작/리셋
  useEffect(() => {
    if (isVisible) {
      setCurrentCycle(0);
      setProgress(0);
      setIsGameStarted(false);
      setCompletedCycles(new Array(BLINK_CYCLES).fill(false));
    }
  }, [isVisible]);

  // 눈깜빡임 상태 감지 및 진행률 업데이트
  useEffect(() => {
    if (!isVisible || !isGameStarted || currentCycle >= BLINK_CYCLES) return;

    const isEyesClosed = blinkState === "CLOSED";
    let progressTimer: NodeJS.Timeout;

    if (isEyesClosed) {
      // 눈이 감혀있을 때 진행률 증가
      progressTimer = setInterval(() => {
        setProgress(prev => {
          const incrementPerInterval = (100 / (HOLD_DURATION / PROGRESS_UPDATE_INTERVAL));
          const newProgress = prev + incrementPerInterval;

          if (newProgress >= 100) {
            // 사이클 완료
            setCompletedCycles(prev => {
              const newCompleted = [...prev];
              newCompleted[currentCycle] = true;
              return newCompleted;
            });

            setCurrentCycle(prev => prev + 1);
            setProgress(0);

            return 0;
          }

          return Math.min(newProgress, 100);
        });
      }, PROGRESS_UPDATE_INTERVAL);
    } else {
      // 눈이 열려있을 때 진행률 감소
      progressTimer = setInterval(() => {
        setProgress(prev => Math.max(0, prev - 1));
      }, PROGRESS_UPDATE_INTERVAL);
    }

    return () => clearInterval(progressTimer);
  }, [isVisible, isGameStarted, currentCycle, blinkState]);

  // 게임 완료 체크
  useEffect(() => {
    if (currentCycle >= BLINK_CYCLES && isGameStarted) {
      setTimeout(() => {
        onGameComplete();
      }, 1000);
    }
  }, [currentCycle, isGameStarted, onGameComplete]);

  const handleStartGame = () => {
    setIsGameStarted(true);
  };

  const getCurrentInstruction = () => {
    if (blinkState === "UNKNOWN") {
      return "📷 카메라에 얼굴이 보이도록 위치를 조정해주세요";
    }

    if (!isGameStarted) {
      return "시작 버튼을 눌러 눈 감기 운동을 시작하세요!";
    }

    if (currentCycle >= BLINK_CYCLES) {
      return "🎉 훌륭합니다! 눈 감기 운동이 완료되었습니다!";
    }

    return `😴 ${currentCycle + 1}차 눈감기: 눈을 꼭 감고 5초간 유지하세요`;
  };

  if (!isVisible) return null;

  return (
    <GameOverlay isVisible={isVisible}>
      <GameContainer>
        <Title>😴 부활을 위한 눈 감기 운동</Title>

        <Instructions>{getCurrentInstruction()}</Instructions>

        <BlinkStatusDisplay blinkState={blinkState}>
          {getBlinkStateEmoji(blinkState)} {getBlinkStateText(blinkState)}
        </BlinkStatusDisplay>

        {/* 디버깅 정보 */}
        <div style={{
          fontSize: '0.9rem',
          color: '#aaa',
          marginTop: '10px',
          padding: '10px',
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          <div>📊 상태 정보:</div>
          <div>• 카메라 준비: {cameraReady ? '✅' : '❌'}</div>
          <div>• 얼굴 인식: {blinkState !== "UNKNOWN" ? '✅' : '❌'}</div>
          <div>• 눈 깜빡임 상태: {blinkState}</div>
          <div>• 비디오 크기: {videoElement ? `${videoElement.videoWidth}x${videoElement.videoHeight}` : '미확인'}</div>
          <div>• 비디오 상태: {videoElement ? (videoElement.readyState >= 2 ? '재생중' : '로딩중') : '없음'}</div>
          <div>• 실제 준비: {(videoElement && videoElement.videoWidth > 0) ? '✅' : '❌'}</div>
        </div>

        <ProgressContainer>
          {Array.from({ length: BLINK_CYCLES }, (_, index) => (
            <CycleContainer key={index}>
              <ProgressCircle
                isActive={isGameStarted && index === currentCycle}
                isCompleted={completedCycles[index]}
                progress={index === currentCycle ? progress : (completedCycles[index] ? 100 : 0)}
              >
                😴
              </ProgressCircle>
              <CycleLabel
                isActive={isGameStarted && index === currentCycle}
                isCompleted={completedCycles[index]}
              >
                {index + 1}차 눈감기
                {completedCycles[index] && ' ✓'}
              </CycleLabel>
            </CycleContainer>
          ))}
        </ProgressContainer>

        <ButtonContainer>
          {!isGameStarted ? (
            <>
              <Button
                variant="primary"
                onClick={handleStartGame}
                disabled={blinkState === "UNKNOWN"}
              >
                🚀 시작하기
              </Button>
              <Button variant="secondary" onClick={onGameCancel}>
                🚪 취소
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onGameCancel}>
              🚪 게임 중단
            </Button>
          )}
        </ButtonContainer>
      </GameContainer>
    </GameOverlay>
  );
};