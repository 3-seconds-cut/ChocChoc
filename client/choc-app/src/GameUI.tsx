// src/GameUI.tsx
import React, { useEffect } from "react";
import styled, { keyframes, css } from "styled-components";
import { UserHeader } from "./components/UserHeader";

// blinkAPI 타입 정의
declare global {
  interface Window {
    blinkAPI: {
      notifyGamePhaseChanged: (gamePhase: string) => void;
      notifyCountdownStarted: (countdown: number) => void;
      notifyCountdownFinished: () => void;
    };
  }
}

interface GameUIProps {
  hearts: number;
  combo: number;
  score: number;
  isAlive: boolean;
  gamePhase: "idle" | "warning" | "danger" | "fever";
  timeRemaining: number;
  countdown: number | null;
  isPaused: boolean;
  showControlPanel: boolean;
  onResetGame: () => void;
  onTogglePause: () => void;
  onToggleControlPanel: () => void;
  onToggleCamera: () => void;
  isCameraOn: boolean;
  opacity: number;
  warningOpacity: number;
  dangerOpacity: number;
  onToggleContextMenu: () => void;
  showContextMenu: boolean;
  onSendAndFetch: () => void;
  userName?: string;
  userId?: string;
  honor?: any;
  // 유저 상태바 표시 제어
  showUserHeader?: boolean;
  onToggleUserHeader?: () => void;
}

export const GameUI: React.FC<GameUIProps> = ({
  hearts,
  combo,
  score,
  isAlive,
  gamePhase,
  timeRemaining,
  countdown,
  isPaused,
  showControlPanel,
  onResetGame,
  onTogglePause,
  onToggleControlPanel,
  onToggleCamera,
  isCameraOn,
  opacity,
  warningOpacity,
  dangerOpacity,
  onToggleContextMenu,
  showContextMenu,
  onSendAndFetch,
  userName,
  userId,
  honor,
  showUserHeader = true,
  onToggleUserHeader,
}) => {
  // display userName/userId from props (fallbacks)
  const displayName = userName ?? "Guest";
  const displayId = userId ?? "1";

  // 타이머 게이지 백분율 계산
  const timePercent = (timeRemaining / 6000) * 100;
  // 게임 상태에 따른 투명도 결정
  const getCurrentOpacity = () => {
    switch (gamePhase) {
      case "warning":
        return warningOpacity;
      case "danger":
        return dangerOpacity;
      default:
        return opacity;
    }
  };

  // 게임 상태 변경 시 메인 프로세스에 알림
  useEffect(() => {
    if (window.blinkAPI) {
      window.blinkAPI.notifyGamePhaseChanged(gamePhase);
    }
  }, [gamePhase]);

  // 카운트다운 시작/종료 시 메인 프로세스에 알림
  useEffect(() => {
    if (window.blinkAPI) {
      if (countdown !== null && countdown > 0) {
        window.blinkAPI.notifyCountdownStarted(countdown);
      } else if (countdown === null) {
        window.blinkAPI.notifyCountdownFinished();
      }
    }
  }, [countdown]);

  return (
    <Container style={{ opacity: getCurrentOpacity() }}>
      {/* 유저 상태바 (showUserHeader prop으로 제어) */}
      {showUserHeader && (
        <Container style={{ opacity: getCurrentOpacity() }}>
          <UserHeaderContainer>
            <UserHeader userName={userName} userId={userId} honor={honor} />
          </UserHeaderContainer>
        </Container>
      )}
      {/* 상단 상태바 */}
      <StatusBar $gamePhase={gamePhase}>
        {/* 중앙: 상태 점 (피버 모드가 아닐 때만 배지 표시) */}
        <Section $align="center">
          <StatusDot $gamePhase={gamePhase} />
        </Section>
        {/* 왼쪽: 라이프와 콤보 */}
        <Section>
          <LifeContainer>
            {[1, 2, 3].map((i) => (
              <Heart key={i} $active={i <= hearts}>
                💧
              </Heart>
            ))}
          </LifeContainer>

          {combo > 0 && (
            <ComboContainer>
              <ComboNumber $gamePhase={gamePhase}>{combo}</ComboNumber>
              <ComboLabel>콤보</ComboLabel>
            </ComboContainer>
          )}
        </Section>

        {/* 오른쪽: 점수와 버튼들 */}
        <Section $align="right">
          <ScoreContainer>
            <Score>{score.toLocaleString()}</Score>
            <ScoreLabel>점수</ScoreLabel>
          </ScoreContainer>

          <ButtonContainer>
            {/* 유저 헤더 토글 버튼 */}
            <Button
              title={showUserHeader ? "유저 상태바 숨기기" : "유저 상태바 보기"}
              onClick={() => onToggleUserHeader && onToggleUserHeader()}
            >
              👤
            </Button>

            <Button
              $variant="camera"
              $active={isCameraOn}
              onClick={onToggleCamera}
              title={isCameraOn ? "카메라 끄기" : "카메라 켜기"}
            >
              📷
            </Button>

            <Button
              onClick={onTogglePause}
              title={isPaused ? "게임 재개" : "게임 일시정지"}
            >
              {isPaused ? "▶️" : "⏸️"}
            </Button>

            <Button
              onClick={onToggleControlPanel}
              title={showControlPanel ? "설정 패널 숨기기" : "설정 패널 보기"}
            >
              ⚙️
            </Button>

            <Button onClick={onToggleContextMenu} title="투명도 조절">
              🎛️
            </Button>

            <Button onClick={onSendAndFetch} title="데이터 전송 & 분석 결과 보기">
              📊
            </Button>
          </ButtonContainer>
        </Section>
      </StatusBar>

      {/* 타이머 게이지 */}
      <TimerSection>
        <TimerBar>
          <TimerProgress $width={timePercent} $gamePhase={gamePhase} />
        </TimerBar>

        {/* {countdown !== null && (
          <Countdown>
            <CountdownText>{countdown}</CountdownText>
            <CountdownMessage>지금 눈을 감아주세요!</CountdownMessage>
          </Countdown>
        )} */}
      </TimerSection>

      {/* 투명도 조절 메뉴 */}
      {showContextMenu && (
        <ContextMenuOverlay onClick={onToggleContextMenu}>
          <ContextMenuContent onClick={(e) => e.stopPropagation()}>
            <ContextMenuTitle>투명도 조절</ContextMenuTitle>

            {/* 기본 투명도 */}
            <OpacitySliderContainer>
              <OpacityLabel>기본 (초록/피버)</OpacityLabel>
              <OpacitySlider
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => {
                  const event = new CustomEvent("opacityChange", {
                    detail: {
                      type: "normal",
                      opacity: parseFloat(e.target.value),
                    },
                  });
                  window.dispatchEvent(event);
                }}
              />
              <OpacityValue>{Math.round(opacity * 100)}%</OpacityValue>
            </OpacitySliderContainer>

            {/* 주황 상태 투명도 */}
            <OpacitySliderContainer>
              <OpacityLabel>주황 상태</OpacityLabel>
              <OpacitySlider
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={warningOpacity}
                onChange={(e) => {
                  const event = new CustomEvent("opacityChange", {
                    detail: {
                      type: "warning",
                      opacity: parseFloat(e.target.value),
                    },
                  });
                  window.dispatchEvent(event);
                }}
              />
              <OpacityValue>{Math.round(warningOpacity * 100)}%</OpacityValue>
            </OpacitySliderContainer>

            {/* 빨강 상태 투명도 */}
            <OpacitySliderContainer>
              <OpacityLabel>빨강 상태</OpacityLabel>
              <OpacitySlider
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={dangerOpacity}
                onChange={(e) => {
                  const event = new CustomEvent("opacityChange", {
                    detail: {
                      type: "danger",
                      opacity: parseFloat(e.target.value),
                    },
                  });
                  window.dispatchEvent(event);
                }}
              />
              <OpacityValue>{Math.round(dangerOpacity * 100)}%</OpacityValue>
            </OpacitySliderContainer>
          </ContextMenuContent>
        </ContextMenuOverlay>
      )}

      {/* 게임 오버 화면 */}
      {!isAlive && (
        <GameOverlay>
          <GameOverContent>
            <GameOverTitle>게임 오버</GameOverTitle>
            <GameOverScore>최종 점수: {score.toLocaleString()}</GameOverScore>
            <RestartButton onClick={onResetGame}>다시 시작</RestartButton>
          </GameOverContent>
        </GameOverlay>
      )}
    </Container>
  );
};

// 애니메이션 키프레임
const comboPulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const dangerPulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
`;

const gentlePulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.02); opacity: 1; }
`;

const feverGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 30px rgba(139, 92, 246, 0.8);
    transform: scale(1.1);
  }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// 스타일 컴포넌트
const Container = styled.div`
  position: relative;
  width: 100%;
  pointer-events: none;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin-bottom: 20px;

  /* 전체 영역을 드래그 가능하게 설정 */
  -webkit-app-region: drag;
  user-select: none;
  /* overflow: hidden; */
`;

// 사용자 정보 헤더
const UserHeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
  margin-left: 500px;
`;

// StatusBar를 원래대로 되돌리고 피버 모드만 특별한 테두리 효과 추가
const StatusBar = styled.div<{ $gamePhase: string }>`
  position: relative;
  width: clamp(300px, 80vw, 640px);
  margin: 0 auto;
  padding: clamp(12px, 2.5vw, 16px) clamp(16px, 4vw, 24px);
  border-radius: clamp(16px, 4vw, 24px);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  animation: ${fadeInUp} 0.6s ease-out;

  /* 버튼 영역은 드래그 방지 */
  -webkit-app-region: drag;
  user-select: none; /* 텍스트 드래그 방지 */

  ${({ $gamePhase }) =>
    $gamePhase === "idle" &&
    css`
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.3);
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "warning" &&
    css`
      background: rgba(245, 158, 11, 0.15);
      border-color: rgba(245, 158, 11, 0.4);
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "danger" &&
    css`
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "fever" &&
    css`
      background: rgba(139, 92, 246, 0.15);
      border-color: rgba(139, 92, 246, 0.4);
      border-width: 2px; /* 테두리 두께 증가 */
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.6);
      animation: ${gentlePulse} 0.5s ease-in-out infinite,
        ${fadeInUp} 0.5s ease-out;
    `}
`;

const Section = styled.div<{ $align?: string }>`
  display: flex;
  align-items: center;
  gap: clamp(12px, 3vw, 16px);
  flex: 1;

  ${({ $align }) =>
    $align === "center" &&
    css`
      justify-content: center;
      flex: 0 0 auto;
    `}

  ${({ $align }) =>
    $align === "right" &&
    css`
      justify-content: flex-end;
    `}
`;

const LifeContainer = styled.div`
  display: flex;
  gap: clamp(4px, 1vw, 6px);
  -webkit-app-region: no-drag;
`;

const Heart = styled.span<{ $active: boolean }>`
  font-size: clamp(16px, 4vw, 20px);
  transition: all 0.3s ease;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));

  opacity: ${({ $active }) => ($active ? 1 : 0.3)};
  transform: ${({ $active }) => ($active ? "scale(1)" : "scale(0.9)")};
  -webkit-app-region: no-drag;
  user-select: none; /* 텍스트 선택 방지 */
`;

const ComboContainer = styled.div`
  text-align: center;
  -webkit-app-region: no-drag;
`;

const ComboNumber = styled.div<{ $gamePhase: string }>`
  font-size: clamp(18px, 4.5vw, 22px);
  font-weight: 700;
  color: #f97316;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
  -webkit-app-region: no-drag;
  user-select: none; /* 텍스트 선택 방지 */

  ${({ $gamePhase }) =>
    $gamePhase === "warning" &&
    css`
      animation: ${comboPulse} 0.8s ease-in-out infinite;
    `}
`;

const ComboLabel = styled.div`
  font-size: clamp(9px, 2vw, 10px);
  color: rgba(107, 114, 128, 0.8);
  margin-top: 2px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  -webkit-app-region: no-drag;
  user-select: none; /* 텍스트 선택 방지 */
`;

const StatusDot = styled.div<{ $gamePhase: string }>`
  width: clamp(10px, 2.5vw, 14px);
  height: clamp(10px, 2.5vw, 14px);
  margin-right: 10px;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  border: 2px solid rgba(255, 255, 255, 0.3);
  -webkit-app-region: no-drag;

  ${({ $gamePhase }) =>
    $gamePhase === "idle" &&
    css`
      background: linear-gradient(135deg, #10b981, #059669);
      animation: ${gentlePulse} 3s ease-in-out infinite;
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "warning" &&
    css`
      background: linear-gradient(135deg, #f59e0b, #d97706);
      animation: ${comboPulse} 1.5s ease-in-out infinite;
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "danger" &&
    css`
      background: linear-gradient(135deg, #ef4444, #dc2626);
      animation: ${dangerPulse} 1.5s ease-in-out infinite;
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "fever" &&
    css`
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      animation: ${feverGlow} 0.5s ease-in-out infinite;
      box-shadow: 0 0 2px rgba(139, 92, 246, 0.6);
    `}
`;

const ScoreContainer = styled.div`
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  -webkit-app-region: no-drag;
`;

const Score = styled.span`
  min-width: 20px;
  font-size: clamp(16px, 4vw, 20px);
  font-weight: 700;
  color: #999;
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  -webkit-app-region: no-drag;
  user-select: none; /* 텍스트 선택 방지 */
`;

const ScoreLabel = styled.span`
  font-size: clamp(9px, 2vw, 10px);
  color: rgba(107, 114, 128, 0.7);
  font-weight: 500;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  -webkit-app-region: no-drag;
  user-select: none; /* 텍스트 선택 방지 */
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: clamp(6px, 1.5vw, 8px);
  -webkit-app-region: no-drag;
`;

const Button = styled.button<{ $variant?: string; $active?: boolean }>`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: clamp(8px, 2vw, 10px);
  padding: clamp(6px, 1.5vw, 8px);
  font-size: clamp(12px, 3vw, 14px);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: clamp(32px, 8vw, 40px);
  min-height: clamp(32px, 8vw, 40px);

  &:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  -webkit-app-region: no-drag;
  user-select: none;
`;

const TimerSection = styled.div`
  width: clamp(300px, 85vw, 600px);
  margin: 0 auto; // 중앙 정렬
  pointer-events: none;
  margin-top: 16px; // 위 여백 추가

  /* 드래그 가능 */
  -webkit-app-region: drag;
  user-select: none; /* 텍스트 드래그 방지 */
`;

const TimerBar = styled.div`
  width: 100%;
  height: clamp(4px, 1vw, 6px);
  background: rgba(0, 0, 0, 0.08);
  border-radius: clamp(2px, 0.5vw, 3px);
  overflow: hidden;
  margin-bottom: clamp(8px, 2vw, 12px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
  -webkit-app-region: no-drag;
`;

const TimerProgress = styled.div<{ $width: number; $gamePhase: string }>`
  height: 100%;
  width: ${({ $width }) => $width}%;
  transition: width 0.1s ease;
  border-radius: clamp(2px, 0.5vw, 3px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  -webkit-app-region: no-drag;

  ${({ $gamePhase }) =>
    $gamePhase === "idle" &&
    css`
      background: linear-gradient(90deg, #10b981, #059669);
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "warning" &&
    css`
      background: linear-gradient(90deg, #f59e0b, #d97706);
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "danger" &&
    css`
      background: linear-gradient(90deg, #ef4444, #dc2626);
    `}

  ${({ $gamePhase }) =>
    $gamePhase === "fever" &&
    css`
      background: linear-gradient(90deg, #8b5cf6, #6366f1);
    `}
`;

const Countdown = styled.div`
  text-align: center;
  pointer-events: none;
  -webkit-app-region: no-drag;
  user-select: none; /* 텍스트 드래그 방지 */
`;

const CountdownText = styled.span`
  font-size: clamp(24px, 6vw, 32px);
  font-weight: 700;
  color: #ef4444;
  text-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  display: block;
  animation: ${comboPulse} 1s infinite;
  -webkit-app-region: no-drag;
  user-select: none; /* 텍스트 선택 방지 */
`;

const CountdownMessage = styled.div`
  font-size: clamp(11px, 2.5vw, 13px);
  color: #ef4444;
  font-weight: 500;
  margin-top: 4px;
  opacity: 0.8;
  -webkit-app-region: no-drag;
  user-select: none; /* 텍스트 선택 방지 */
`;

const GameOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  pointer-events: auto;
  backdrop-filter: blur(8px);
  -webkit-app-region: no-drag;
`;

const GameOverContent = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  padding: clamp(8px, 2vw, 12px); /* 더 작게 */
  border-radius: clamp(8px, 2vw, 12px); /* 더 작게 */
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  animation: ${fadeInUp} 0.4s ease-out;
  max-width: 200px; /* 더 작게 */
  width: 60vw; /* 더 작게 */
  border: 1px solid rgba(255, 255, 255, 0.3);
`;

const GameOverTitle = styled.h2`
  margin: 0 0 6px; /* 더 작게 */
  color: #ef4444;
  font-size: clamp(12px, 3vw, 16px); /* 더 작게 */
  font-weight: 700;
`;

const GameOverScore = styled.p`
  margin: 0 0 8px; /* 더 작게 */
  font-size: clamp(10px, 2.5vw, 12px); /* 더 작게 */
  color: #6b7280;
  font-weight: 500;
`;

const RestartButton = styled.button`
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  padding: clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px); /* 더 작게 */
  border-radius: clamp(4px, 1vw, 6px); /* 더 작게 */
  font-size: clamp(10px, 2.5vw, 12px); /* 더 작게 */
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3); /* 더 작게 */

  &:hover {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(16, 185, 129, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

// 컨텍스트 메뉴 스타일
const ContextMenuOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  pointer-events: auto;
  backdrop-filter: blur(8px);
  -webkit-app-region: no-drag;
`;

const ContextMenuContent = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  padding: 24px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  animation: ${fadeInUp} 0.4s ease-out;
  min-width: 300px;
  border: 1px solid rgba(255, 255, 255, 0.3);
`;

const ContextMenuTitle = styled.h3`
  margin: 0 0 20px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  font-weight: 600;
`;

const OpacitySliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
`;

const OpacityLabel = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 500;
`;

const OpacitySlider = styled.input`
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const OpacityValue = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
`;
