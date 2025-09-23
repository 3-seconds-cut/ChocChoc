// src/components/ControlPanel.tsx
import React from "react";
import { GazeDirection } from "../hooks/useGazeDetector";

interface ControlPanelProps {
  state: "idle" | "loading" | "ready" | "error";
  blinkState: string;
  blinks: number;
  ratioL: number;
  ratioR: number;
  closeT: number;
  openT: number;
  mirrored: boolean;
  showFace: boolean;
  showCharacter: boolean;
  showHUD: boolean;
  onMirroredChange: (mirrored: boolean) => void;
  onShowFaceChange: (showFace: boolean) => void;
  onShowCharacterChange: (showCharacter: boolean) => void;
  onShowHUDChange: (showHUD: boolean) => void;
  onStopCamera: () => void;
  onStartCamera: () => void;

  // API Key 관련 props (optional)
  apiKey?: string | null;
  onOpenApiKeyModal?: () => void;
  onClearApiKey?: () => void;

  // 시선 감지 관련 props
  gazeEnabled?: boolean;
  gazeDirection?: GazeDirection;
  gazePos?: { px: number; py: number };
  calibratedPos?: { px: number; py: number };
  gazeReady?: boolean;
  onGazeEnabledChange?: (enabled: boolean) => void;
  onGazeCalibrate?: () => void;
  onGazeReset?: () => void;
}

export function ControlPanel({
  state,
  blinkState,
  blinks,
  ratioL,
  ratioR,
  closeT,
  openT,
  mirrored,
  showFace,
  showCharacter,
  showHUD,
  onMirroredChange,
  onShowFaceChange,
  onShowCharacterChange,
  onShowHUDChange,
  onStopCamera,
  onStartCamera,
  apiKey,
  onOpenApiKeyModal,
  onClearApiKey,
  gazeEnabled = false,
  gazeDirection = "NO_FACE",
  gazePos = { px: 0, py: 0 },
  calibratedPos = { px: 0, py: 0 },
  gazeReady = false,
  onGazeEnabledChange,
  onGazeCalibrate,
  onGazeReset,
}: ControlPanelProps) {
  const getBlinkStateColor = () => {
    if (blinkState === "CLOSED" || blinkState === "CLOSING") return "#ff5050";
    if (blinkState === "OPENING") return "#f7b731";
    if (blinkState === "OPEN") return "#21c074";
    return "#999";
  };

  const getBlinkStateText = () => {
    switch (blinkState) {
      case "UNKNOWN":
        return "대기중";
      case "OPEN":
        return "눈뜸";
      case "CLOSING":
        return "감는중";
      case "CLOSED":
        return "눈감음";
      case "OPENING":
        return "뜨는중";
      default:
        return blinkState;
    }
  };

  // 브라우저 환경 정보
  const getEnvironmentInfo = () => {
    const isElectron = navigator.userAgent.includes("Electron");
    const isSecure =
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
    const hasMediaDevices = !!navigator.mediaDevices;

    return {
      isElectron,
      isSecure,
      hasMediaDevices,
      userAgent: isElectron ? "Electron" : "Browser",
    };
  };

  const envInfo = getEnvironmentInfo();

  return (
    <div style={styles.panel}>
      {/* 환경 정보 */}
      <div style={styles.environmentInfo}>
        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>
          환경: {envInfo.userAgent} |{envInfo.isSecure ? " 🔒" : " ⚠️"} |
          {envInfo.hasMediaDevices ? " 📹" : " ❌"}
        </div>
      </div>

      {/* API Key 상태 */}
      <div style={styles.apiRow}>
        <div style={{ fontSize: 12, color: "#ddd" }}>
          API Key:{" "}
          <b style={{ color: apiKey ? "#21c074" : "#ffb86b" }}>
            {apiKey ? "등록됨" : "미등록"}
          </b>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            style={styles.smallButton}
            onClick={() => {
              // 안전하게 App 쪽 핸들러 호출 (App에서는 setTempApiKey/setShowApiKeyModal 등을 처리)
              if (onOpenApiKeyModal) onOpenApiKeyModal();
            }}
            title={apiKey ? "API Key 수정" : "API Key 등록"}
          >
            {apiKey ? "수정" : "등록"}
          </button>
          {apiKey && onClearApiKey && (
            <button
              style={styles.smallButtonDanger}
              onClick={() => { if (onClearApiKey) onClearApiKey(); }}
              title="API Key 삭제"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <div>
        Cam:{" "}
        <b
          style={{
            color:
              state === "ready"
                ? "#21c074"
                : state === "error"
                ? "#ff5050"
                : "#999",
          }}
        >
          {state}
        </b>
      </div>
      <div>
        State:{" "}
        <button
          style={{
            ...styles.stateButton,
            backgroundColor: getBlinkStateColor(),
            color: "white",
            border: "none",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "bold",
          }}
          onClick={() => onShowHUDChange(!showHUD)}
          title={showHUD ? "HUD 숨기기" : "HUD 보기"}
        >
          {getBlinkStateText()}
        </button>
      </div>

      {/* 시선 감지 섹션 */}
      <div style={{ marginTop: 8, padding: 8, border: "1px solid #444", borderRadius: 4 }}>
        <div style={{ fontSize: 11, color: "#ccc", marginBottom: 4 }}>
          🎯 시선 감지 (Gaze Detection)
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <label style={{ fontSize: 10, color: "#ddd" }}>
            <input
              type="checkbox"
              checked={gazeEnabled}
              onChange={(e) => onGazeEnabledChange?.(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            활성화
          </label>
          <span style={{ fontSize: 10, color: gazeReady ? "#21c074" : "#999" }}>
            {gazeReady ? "준비됨" : "대기중"}
          </span>
        </div>

        {gazeEnabled && (
          <>
            <div style={{ fontSize: 10, color: "#ddd", marginBottom: 4 }}>
              방향: <span style={{
                color: gazeDirection === "NO_FACE" ? "#ff5050" :
                      gazeDirection === "EYES_CLOSED" ? "#ffb86b" : "#21c074",
                fontWeight: "bold"
              }}>
                {gazeDirection}
              </span>
            </div>

            <div style={{ fontSize: 9, color: "#aaa", marginBottom: 4 }}>
              원시: px={gazePos.px.toFixed(2)}, py={gazePos.py.toFixed(2)}
            </div>

            <div style={{ fontSize: 9, color: "#aaa", marginBottom: 6 }}>
              보정: px={calibratedPos.px.toFixed(2)}, py={calibratedPos.py.toFixed(2)}
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              <button
                style={{
                  ...styles.smallButton,
                  fontSize: 9,
                  padding: "2px 6px",
                  backgroundColor: "#007bff",
                  color: "white",
                }}
                onClick={onGazeCalibrate}
                disabled={!gazeReady}
                title="현재 위치를 중앙으로 캘리브레이션 (키보드 C)"
              >
                캘리브레이션
              </button>
              <button
                style={{
                  ...styles.smallButton,
                  fontSize: 9,
                  padding: "2px 6px",
                  backgroundColor: "#6c757d",
                  color: "white",
                }}
                onClick={onGazeReset}
                title="캘리브레이션 초기화 (키보드 R)"
              >
                리셋
              </button>
            </div>
          </>
        )}
      </div>
      <div>
        Blinks: <b>{blinks}</b>
      </div>
      <div>
        Ratio L/R: {ratioL.toFixed(3)} / {ratioR.toFixed(3)}
      </div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
        평균: {((ratioL + ratioR) / 2).toFixed(3)}| 임계값: 감음&lt;{closeT} /
        뜸&gt;{openT}
      </div>
      <div style={{ fontSize: 12, color: "#666" }}>
        완전한 깜빡임 사이클 감지 (뜸→감음→뜸)
      </div>

      {/* HUD 표시 상태 */}
      <div style={{ fontSize: 11, color: "#888" }}>
        HUD: {showHUD ? "🟢 표시" : "�� 숨김"}
      </div>

      {/* 설정 토글들 */}
      <div style={styles.settings}>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={mirrored}
            onChange={(e) => onMirroredChange(e.target.checked)}
          />
          미러 모드
        </label>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={showFace}
            onChange={(e) => onShowFaceChange(e.target.checked)}
          />
          얼굴 보기
        </label>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={showCharacter}
            onChange={(e) => onShowCharacterChange(e.target.checked)}
          />
          캐릭터 보기
        </label>
      </div>

      {state === "ready" ? (
        <button style={styles.buttonSecondary} onClick={onStopCamera}>
          중지
        </button>
      ) : (
        <button style={styles.button} onClick={onStartCamera}>
          시작
        </button>
      )}

      {/* 브라우저 문제 해결 팁 */}
      {!envInfo.isSecure && (
        <div style={styles.warning}>
          ⚠️ HTTPS가 필요합니다. localhost에서 실행하거나 HTTPS 환경을
          사용하세요.
        </div>
      )}

      {!envInfo.hasMediaDevices && (
        <div style={styles.warning}>
          ❌ 이 브라우저는 카메라를 지원하지 않습니다.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: "flex",
    gap: "clamp(8px, 2vw, 12px)", // 반응형 gap
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "clamp(8px, 2vw, 12px)", // 반응형 margin
    background: "#5e5e5e",
    padding: "clamp(8px, 2.5vw, 12px)", // 반응형 padding
    borderRadius: "clamp(6px, 1.5vw, 10px)", // 반응형 border-radius
    fontSize: "clamp(11px, 2.5vw, 13px)", // 반응형 폰트 크기
  },
  environmentInfo: {
    width: "100%",
    marginBottom: "8px",
  },
  warning: {
    width: "100%",
    fontSize: "10px",
    color: "#ff6b35",
    background: "rgba(255, 107, 53, 0.1)",
    padding: "4px 8px",
    borderRadius: "4px",
    marginTop: "8px",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(4px, 1.5vw, 6px)", // 반응형 gap
    fontSize: "clamp(10px, 2.5vw, 12px)", // 반응형 폰트 크기
  },
  button: {
    background: "#21c074",
    color: "white",
    border: "none",
    padding: "clamp(6px 12px, 2vw 4vw, 8px 16px)", // 반응형 padding
    borderRadius: "clamp(3px, 1vw, 4px)", // 반응형 border-radius
    cursor: "pointer",
    fontSize: "clamp(10px, 2.5vw, 12px)", // 반응형 폰트 크기
  },
  buttonSecondary: {
    background: "#ff5050",
    color: "white",
    border: "none",
    padding: "clamp(6px 12px, 2vw 4vw, 8px 16px)", // 반응형 padding
    borderRadius: "clamp(3px, 1vw, 4px)", // 반응형 border-radius
    cursor: "pointer",
    fontSize: "clamp(10px, 2.5vw, 12px)", // 반응형 폰트 크기
  },
  settings: {
    display: "flex",
    gap: "clamp(6px, 1.5vw, 8px)", // 반응형 gap
    marginBottom: "clamp(6px, 1.5vw, 8px)", // 반응형 margin
    flexWrap: "wrap",
  },
  apiRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: "8px",
    borderRadius: "4px",
    background: "rgba(255, 255, 255, 0.1)",
    marginBottom: "8px",
  },
  smallButton: {
    background: "#333",
    color: "white",
    border: "none",
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "clamp(10px, 2vw, 12px)", // 반응형 폰트 크기
  },
  smallButtonDanger: {
    background: "#ff5050",
    color: "white",
    border: "none",
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "clamp(10px, 2vw, 12px)", // 반응형 폰트 크기
  },
};
