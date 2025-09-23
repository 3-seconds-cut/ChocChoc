// src/components/GameOverModal.tsx
import React from "react";
import styled, { keyframes } from "styled-components";

interface GameOverModalProps {
  isVisible: boolean;
  score: number;
  combo: number;
  onContinueGame: () => void;
  onEndGame: () => void;
}

// 애니메이션 키프레임
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const heartBreak = keyframes`
  0% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.1) rotate(-5deg); }
  50% { transform: scale(0.9) rotate(5deg); }
  75% { transform: scale(1.05) rotate(-2deg); }
  100% { transform: scale(1) rotate(0deg); }
`;

// 스타일드 컴포넌트
const ModalOverlay = styled.div<{ isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: ${props => props.isVisible ? 'flex' : 'none'};
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
`;

const ModalContainer = styled.div`
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  color: white;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  animation: ${fadeIn} 0.5s ease-out;
  max-width: 400px;
  width: 90%;
  border: 3px solid rgba(255, 255, 255, 0.2);
`;

const GameOverTitle = styled.h1`
  font-size: 2.5rem;
  margin: 0 0 20px 0;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  color: #ff6b6b;
`;

const BrokenHeart = styled.div`
  font-size: 4rem;
  margin: 20px 0;
  animation: ${heartBreak} 1s ease-in-out;
  filter: drop-shadow(0 0 10px rgba(255, 107, 107, 0.5));
`;

const ScoreSection = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 20px;
  margin: 20px 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const ScoreItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 10px 0;
  font-size: 1.2rem;
`;

const ScoreLabel = styled.span`
  color: #e8e8e8;
`;

const ScoreValue = styled.span`
  font-weight: bold;
  color: #ffd93d;
  font-size: 1.3rem;
`;

const Message = styled.p`
  font-size: 1.1rem;
  margin: 20px 0;
  color: #e8e8e8;
  line-height: 1.5;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 30px;
  justify-content: center;
`;

const Button = styled.button<{ variant: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;

  ${props => props.variant === 'primary' ? `
    background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
    color: white;
    box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
    }
  ` : `
    background: rgba(255, 255, 255, 0.1);
    color: #e8e8e8;
    border: 2px solid rgba(255, 255, 255, 0.3);

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }
  `}

  &:active {
    transform: translateY(0);
  }
`;

const RevivalHint = styled.div`
  background: rgba(255, 215, 61, 0.1);
  border: 2px solid rgba(255, 215, 61, 0.3);
  border-radius: 10px;
  padding: 15px;
  margin: 20px 0;
  color: #ffd93d;
  font-size: 0.95rem;
  line-height: 1.4;
`;

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isVisible,
  score,
  combo,
  onContinueGame,
  onEndGame,
}) => {
  if (!isVisible) return null;

  return (
    <ModalOverlay isVisible={isVisible}>
      <ModalContainer>
        <GameOverTitle>게임 오버</GameOverTitle>

        <BrokenHeart>💔</BrokenHeart>

        <ScoreSection>
          <ScoreItem>
            <ScoreLabel>최종 점수:</ScoreLabel>
            <ScoreValue>{score.toLocaleString()}</ScoreValue>
          </ScoreItem>
          <ScoreItem>
            <ScoreLabel>최대 콤보:</ScoreLabel>
            <ScoreValue>{combo}</ScoreValue>
          </ScoreItem>
        </ScoreSection>

        <Message>
          모든 생명을 잃었습니다!<br />
          어떻게 하시겠습니까?
        </Message>

        <RevivalHint>
          💡 <strong>다시 시작하기</strong><br />
          점수와 콤보가 초기화되고<br />
          새로운 게임이 시작됩니다!
        </RevivalHint>

        <ButtonContainer>
          <Button variant="primary" onClick={onContinueGame}>
            🔄 다시 시작하기
          </Button>
          <Button variant="secondary" onClick={onEndGame}>
            🚪 앱 종료
          </Button>
        </ButtonContainer>
      </ModalContainer>
    </ModalOverlay>
  );
};