// src/components/RevivalGame.tsx
import React, { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";

export type GazeDirection = "LEFT" | "RIGHT" | "UP" | "DOWN" | "CENTER" | "NO_FACE" | "EYES_CLOSED";

interface RevivalGameProps {
  isVisible: boolean;
  gazeDirection: GazeDirection;
  onGameComplete: () => void;
  onGameCancel: () => void;
  cameraReady?: boolean;
  gazeReady?: boolean;
  videoElement?: HTMLVideoElement | null;
}

// 부활 게임 시퀀스: 좌 → 우 → 좌 → 우
const REVIVAL_SEQUENCE: GazeDirection[] = ["LEFT", "RIGHT", "LEFT", "RIGHT"];
const HOLD_DURATION = 1500; // 각 방향을 1.5초간 유지해야 함
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
  gap: 20px;
  margin: 30px 0;
  flex-wrap: wrap;
`;

const DirectionCircle = styled.div<{
  isActive: boolean;
  isCompleted: boolean;
  progress: number;
  direction: GazeDirection;
}>`
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid ${props =>
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
  font-size: 1.5rem;
  font-weight: bold;
  transition: all 0.3s ease;
  animation: ${props => props.isActive ? pulse : 'none'} 1s infinite;

  ${props => props.isCompleted && `
    animation: ${glow} 2s infinite;
  `}

  &::before {
    content: '';
    position: absolute;
    top: -3px;
    left: -3px;
    right: -3px;
    bottom: -3px;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      ${props => props.isActive ? '#4caf50' : 'transparent'} 0deg,
      ${props => props.isActive ? '#4caf50' : 'transparent'} ${props => props.progress * 3.6}deg,
      transparent ${props => props.progress * 3.6}deg
    );
    z-index: -1;
  }
`;

const DirectionLabel = styled.div<{ direction: GazeDirection }>`
  margin-top: 8px;
  font-size: 0.9rem;
  color: #e8e8e8;
  font-weight: 600;
`;

const CurrentDirection = styled.div`
  font-size: 1.5rem;
  margin: 20px 0;
  color: #ffd93d;
  font-weight: bold;
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

const getDirectionEmoji = (direction: GazeDirection): string => {
  switch (direction) {
    case "LEFT": return "👈";
    case "RIGHT": return "👉";
    case "UP": return "👆";
    case "DOWN": return "👇";
    default: return "👁️";
  }
};

const getDirectionText = (direction: GazeDirection): string => {
  switch (direction) {
    case "LEFT": return "좌";
    case "RIGHT": return "우";
    case "UP": return "상";
    case "DOWN": return "하";
    default: return "중앙";
  }
};

export const RevivalGame: React.FC<RevivalGameProps> = ({
  isVisible,
  gazeDirection,
  onGameComplete,
  onGameCancel,
  cameraReady = true,
  gazeReady = false,
  videoElement = null,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(new Array(REVIVAL_SEQUENCE.length).fill(false));

  // 게임 시작/리셋
  useEffect(() => {
    if (isVisible) {
      setCurrentStep(0);
      setProgress(0);
      setIsGameStarted(false);
      setCompletedSteps(new Array(REVIVAL_SEQUENCE.length).fill(false));
    }
  }, [isVisible]);

  // 시선 방향 감지 및 진행률 업데이트
  useEffect(() => {
    if (!isVisible || !isGameStarted || currentStep >= REVIVAL_SEQUENCE.length) return;

    const targetDirection = REVIVAL_SEQUENCE[currentStep];
    const isCorrectDirection = gazeDirection === targetDirection;

    let progressTimer: NodeJS.Timeout;

    if (isCorrectDirection) {
      // 올바른 방향을 보고 있을 때 진행률 증가
      progressTimer = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + (100 / (HOLD_DURATION / PROGRESS_UPDATE_INTERVAL));

          if (newProgress >= 100) {
            // 단계 완료
            setCompletedSteps(prev => {
              const newCompleted = [...prev];
              newCompleted[currentStep] = true;
              return newCompleted;
            });

            setCurrentStep(prev => prev + 1);
            setProgress(0);

            return 0;
          }

          return Math.min(newProgress, 100);
        });
      }, PROGRESS_UPDATE_INTERVAL);
    } else {
      // 잘못된 방향을 보고 있을 때 진행률 감소
      progressTimer = setInterval(() => {
        setProgress(prev => Math.max(0, prev - 2));
      }, PROGRESS_UPDATE_INTERVAL);
    }

    return () => clearInterval(progressTimer);
  }, [isVisible, isGameStarted, currentStep, gazeDirection]);

  // 게임 완료 체크
  useEffect(() => {
    if (currentStep >= REVIVAL_SEQUENCE.length && isGameStarted) {
      setTimeout(() => {
        onGameComplete();
      }, 1000);
    }
  }, [currentStep, isGameStarted, onGameComplete]);

  const handleStartGame = () => {
    setIsGameStarted(true);
  };

  const getCurrentInstruction = () => {
    if (gazeDirection === "NO_FACE") {
      return "📷 카메라에 얼굴이 보이도록 위치를 조정해주세요";
    }

    if (!isGameStarted) {
      return "시작 버튼을 눌러 눈 운동을 시작하세요!";
    }

    if (currentStep >= REVIVAL_SEQUENCE.length) {
      return "🎉 훌륭합니다! 눈 운동이 완료되었습니다!";
    }

    const targetDirection = REVIVAL_SEQUENCE[currentStep];
    return `${getDirectionEmoji(targetDirection)} ${getDirectionText(targetDirection)}쪽을 바라보세요`;
  };

  if (!isVisible) return null;

  return (
    <GameOverlay isVisible={isVisible}>
      <GameContainer>
        <Title>👁️ 부활을 위한 눈 운동</Title>

        <Instructions>{getCurrentInstruction()}</Instructions>

        <CurrentDirection>
          현재 시선: {gazeDirection === "NO_FACE" ? "얼굴 인식 안됨" :
                     gazeDirection === "EYES_CLOSED" ? "눈 감음" :
                     getDirectionText(gazeDirection)}
        </CurrentDirection>

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
          <div>• 시선 감지: {gazeReady ? '✅' : '❌'}</div>
          <div>• 얼굴 인식: {gazeDirection !== "NO_FACE" ? '✅' : '❌'}</div>
          <div>• 비디오 크기: {videoElement ? `${videoElement.videoWidth}x${videoElement.videoHeight}` : '미확인'}</div>
          <div>• 비디오 상태: {videoElement ? (videoElement.readyState >= 2 ? '재생중' : '로딩중') : '없음'}</div>
          <div>• 실제 준비: {(videoElement && videoElement.videoWidth > 0) ? '✅' : '❌'}</div>
        </div>

        <ProgressContainer>
          {REVIVAL_SEQUENCE.map((direction, index) => (
            <div key={index}>
              <DirectionCircle
                isActive={isGameStarted && index === currentStep}
                isCompleted={completedSteps[index]}
                progress={index === currentStep ? progress : (completedSteps[index] ? 100 : 0)}
                direction={direction}
              >
                {getDirectionEmoji(direction)}
              </DirectionCircle>
              <DirectionLabel direction={direction}>
                {getDirectionText(direction)}
              </DirectionLabel>
            </div>
          ))}
        </ProgressContainer>

        <ButtonContainer>
          {!isGameStarted ? (
            <>
              <Button
                variant="primary"
                onClick={handleStartGame}
                disabled={gazeDirection === "NO_FACE"}
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