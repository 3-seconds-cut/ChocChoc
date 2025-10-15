import React from "react";
import styled from "styled-components";

interface UserHeaderProps {
  userName?: string;
  userId?: string;
  honor?: string | { title?: string; color?: string; font_style?: string };
}

export const UserHeader: React.FC<UserHeaderProps> = ({ userName, userId, honor }) => {
  const displayName = userName ?? "Guest";
  const displayId = userId ?? "1";
  const initial = String(displayName).trim().charAt(0).toUpperCase() || "G";

  // honor 처리: 문자열 또는 객체 지원
  const honorTitle =
    typeof honor === "string" ? honor : honor?.title ?? "눈물 가뭄";
  const honorColor = typeof honor === "object" && honor?.color ? honor.color : "#888888";

  return (
    <Container>
      <Avatar>{initial}</Avatar>
      <Info>
        <NameRow>
          <Name>{displayName}</Name>
          <Honor style={{ color: honorColor }}>{honorTitle}</Honor>
        </NameRow>
        <Id>ID: {displayId}</Id>
      </Info>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  margin-bottom: 8px;
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #8b5cf6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Name = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #111;
`;

const Honor = styled.div`
  font-size: 14px;
  font-weight: 600;
  font-style: italic;
  color: #FF5000;
`;

const Id = styled.div`
  font-size: 11px;
  color: #666;
`;
