// src/App.tsx
import { useState, useEffect, useRef } from "react";
import { useCamera } from "./hooks/useCamera";
import { useDisplaySettings } from "./hooks/useDisplaySettings";
import { useBlinkDetector } from "./useBlinkDetector";
import { useGameLogic } from "./useGameLogic";
import { GameUI } from "./GameUI";
import { VideoDisplay } from "./components/VideoDisplay";
import { ControlPanel } from "./components/ControlPanel";
import { ReportModal } from "./components/ReportModal";
import { useInit } from "./hooks/useInit";
import { UserModal } from "./components/UserModal";
import { ApiKeyModal } from "./components/ApiKeyModal";

export default function App() {
  // 카메라 관련 로직
  const { videoRef, state, ready, error, startCamera, stopCamera } =
    useCamera();

  // 화면 표시 설정 관련 로직
  const {
    mirrored,
    showFace,
    showCharacter,
    setMirrored,
    setShowFace,
    setShowCharacter,
  } = useDisplaySettings();

  // HUD / ControlPanel 표시 상태
  const [showHUD, setShowHUD] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);

  // 투명도 관련 상태 (새 기능 유지)
  const [opacity, setOpacity] = useState(0.7);
  const [warningOpacity, setWarningOpacity] = useState(0.85);
  const [dangerOpacity, setDangerOpacity] = useState(1);
  const [showContextMenu, setShowContextMenu] = useState(false);

  // 깜빡임 감지 (초기화 여부에 따라 활성화)
  // 앱 시작 전 사용자가 'API 키 등록 여부'를 선택할 때까지
  // 감지/카메라 초기화 같은 부하작업은 실행되지 않도록 플래그를 사용합니다.
  const [showInitModal, setShowInitModal] = useState(true); // 초기 모달 표시 상태

  // 최초 설정 모달이 열려 있으면 깜빡임 감지 비활성화
  const blink = useBlinkDetector(videoRef);

  // 게임 로직
  const { gameState, resetGame, togglePause, restoreHeart, loseHeart } =
    useGameLogic(blink.blinks, blink.lastBlinkAt);

  // 투명도 변경 이벤트 리스너 (새 기능 유지)
  useEffect(() => {
    const handleOpacityChange = (event: any) => {
      const { type, opacity: newOpacity } = event.detail;
      switch (type) {
        case "normal":
          setOpacity(newOpacity);
          break;
        case "warning":
          setWarningOpacity(newOpacity);
          break;
        case "danger":
          setDangerOpacity(newOpacity);
          break;
        default:
          setOpacity(newOpacity);
      }
    };
    window.addEventListener("opacityChange", handleOpacityChange);
    return () =>
      window.removeEventListener("opacityChange", handleOpacityChange);
  }, []);

  const isBlinking = blink.state === "CLOSED" || blink.state === "CLOSING";

  // CLOSED → OPEN 전환 시 타임스탬프 기록
  useEffect(() => {
    if (prevBlinkState.current === "CLOSED" && blink.state === "OPEN") {
      setEvents((prev) => [...prev, new Date().toISOString()]);
    }
    prevBlinkState.current = blink.state;
  }, [blink.state]);

  // 서버 URL
  const API_BASE =
    (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";

  // 초기화 훅: 서버로부터 사용자 정보 및 API Key 상태 확인/조작
  const {
    userInfo,
    hasServerApiKey,
    showUserState,
    showUserModal,
    showApiKeyModal,
    tempUserName,
    tempApiKey,
    setTempUserName,
    setTempApiKey,
    setShowUserState,
    setShowUserModal,
    setShowApiKeyModal,
    handleUserSave,
    handleApiKeySave,
    handleApiKeyClear,
  } = useInit(API_BASE, () => {
    // onReady: 양쪽(사용자명 + 서버 API 키) 준비되면 앱 시작
    setShowInitModal(false);
    // started 상태를 관리하는 로직이 App에 있으면 setStarted(true) 호출 등으로 연결
  });

  // 카메라 표시 토글 (스트림은 유지)
  const toggleCamera = () => {
    if (showFace) {
      setShowFace(false);
    } else {
      setShowFace(true);
      if (state !== "ready") startCamera();
    }
  };

  // === Blink 이벤트 기록/전송/조회 ===
  const [events, setEvents] = useState<string[]>([]);
  const startedAt = useRef<string>(new Date().toISOString()); // 프로그램 시작 시각
  const prevBlinkState = useRef<string>(blink.state);

  // CLOSED → OPEN 전환 시 타임스탬프 기록
  useEffect(() => {
    if (prevBlinkState.current === "CLOSED" && blink.state === "OPEN") {
      setEvents((prev) => [...prev, new Date().toISOString()]);
    }
    prevBlinkState.current = blink.state;
  }, [blink.state]);

  // 데이터 서버로 전송
  const sendBlinkData = async () => {
    // 서버가 사용자 id로 API Key를 알고 있다고 가정: 클라이언트는 키를 전송하지 않음
    const payload = {
      id: localStorage.getItem("userId") ?? "1",
      events,
      startedAt: startedAt.current,
      endedAt: new Date().toISOString(),
    };
    try {
      const res = await fetch(`${API_BASE}/blink-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log("Blink data sent:", payload);
      return true;
    } catch (err) {
      console.error("Failed to send blink data:", err);
      return false;
    }
  };

  // 처리 결과 가져오기(JSON: report, daily_blink_per_minute, daily_line_plot_b64)
  const [processed, setProcessed] = useState<any | null>(null);
  const fetchProcessed = async () => {
    try {
      // 서버는 요청의 user_id(세션/쿠키/바디 등)으로 API Key 소유 여부를 확인한다고 가정
      const uid = localStorage.getItem("userId") ?? "1";
      const res = await fetch(
        `${API_BASE}/processed-data/${encodeURIComponent(String(uid))}`,
        {
          method: "GET",
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProcessed(json);
      console.log("processed:", json);
    } catch (e) {
      console.error(e);
    }
  };

  // 전송 후 즉시 분석결과 조회
  const sendAndFetch = async () => {
    if (!hasServerApiKey) {
      console.log("API Key is required.");
    }
    const ok = await sendBlinkData();
    if (ok) await fetchProcessed();
  };

  // render user modal (입력/저장)
  return (
    <div style={styles.wrap}>
      {/* 사용자명 입력 모달 (컴포넌트화) */}
      <UserModal
        visible={showUserModal && showInitModal}
        value={tempUserName}
        onChange={setTempUserName}
        onSave={handleUserSave}
        onClose={() => setShowUserModal(false)}
        disabled={!tempUserName.trim()}
      />

      {/* 시작하기 전 안내 모달 */}
      {!showUserModal && !hasServerApiKey && showInitModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: 420,
              maxWidth: "100%",
              background: "#fff",
              borderRadius: 8,
              padding: 20,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
          >
            <h3 style={{ marginTop: 0 }}>시작하기 전에</h3>
            <p style={{ color: "#444" }}>
              오늘의 촉촉 리포트를 받으려면 Open AI API Key를 등록해주세요.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
              <button
                onClick={() => { setShowInitModal(false); setShowApiKeyModal(true); } }
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#007BFF",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                API Key 등록하고 시작
              </button>
              <button
                onClick={() => { setShowInitModal(false); }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "#f6f6f6",
                  cursor: "pointer",
                }}
              >
                나중에 등록하기
              </button>
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
              (API Key는 설정 필드에서 언제든 입력/저장 가능합니다.)
            </p>
          </div>
        </div>
      )}

      {/* API Key 입력 모달 (컴포넌트화) */}
      <ApiKeyModal
        visible={!showUserModal && showApiKeyModal}
        value={tempApiKey}
        onChange={setTempApiKey}
        onSave={handleApiKeySave}
        onClose={() => setShowApiKeyModal(false)}
        disabled={!tempApiKey}
        subtitle="서버에 안전하게 보관됩니다."
      />

      {/* 게임 UI */}
      <GameUI
        hearts={gameState.hearts}
        combo={gameState.combo}
        score={gameState.score}
        isAlive={gameState.isAlive}
        gamePhase={gameState.gamePhase}
        timeRemaining={gameState.timeRemaining}
        countdown={gameState.countdown}
        isPaused={gameState.isPaused}
        onResetGame={resetGame}
        onTogglePause={togglePause}
        showControlPanel={showControlPanel}
        onToggleControlPanel={() => setShowControlPanel(!showControlPanel)}
        onToggleCamera={toggleCamera}
        isCameraOn={showFace}
        opacity={opacity}
        warningOpacity={warningOpacity}
        dangerOpacity={dangerOpacity}
        showContextMenu={showContextMenu}
        onToggleContextMenu={() => setShowContextMenu(!showContextMenu)}
        onSendAndFetch={sendAndFetch}
        // 사용자 정보 전달 (processed가 없으면 Guest)
        showUserHeader={showUserState}
        onToggleUserHeader={() => setShowUserState(!showUserState)}
        userName={
          userInfo?.status?.payload?.name ??
          processed?.user_name ??
          "Guest"
        }
        userId={
          userInfo?.status?.payload?.id ??
          processed?.user_id ??
          "1"
        }
        // honor 객체(또는 문자열)를 전달
        honor={userInfo?.honor ?? null}
      />

      {/* 컨트롤 패널 */}
      {showControlPanel && (
        <ControlPanel
          state={state}
          blinkState={blink.state}
          blinks={blink.blinks}
          ratioL={blink.ratioL}
          ratioR={blink.ratioR}
          closeT={blink.CLOSE_T}
          openT={blink.OPEN_T}
          mirrored={mirrored}
          showFace={showFace}
          showCharacter={showCharacter}
          showHUD={showHUD}
          onMirroredChange={setMirrored}
          onShowFaceChange={setShowFace}
          onShowCharacterChange={setShowCharacter}
          onShowHUDChange={setShowHUD}
          onStopCamera={stopCamera}
          onStartCamera={() => startCamera()}
          hasApiKey={hasServerApiKey}
          onOpenApiKeyModal={() => setShowApiKeyModal(true)}
          onClearApiKey={() => handleApiKeyClear()}
        />
      )}

      {/* 비디오/캐릭터 */}
      <VideoDisplay
        videoRef={videoRef}
        showFace={showFace}
        showCharacter={showCharacter}
        mirrored={mirrored}
        ready={ready}
        error={error}
        isBlinking={isBlinking}
      />

      {/* HUD */}
      {/* {showHUD && <p style={styles.hud}>{hudText}</p>} */}

      {/* <p style={styles.tip}>
        ※ 완전한 깜빡임 사이클(뜸→감음→뜸)을 감지합니다. 눈을 감고만 있으면
        카운트되지 않아요!
      </p> */}

      {/* 처리 결과 모달 (분리된 컴포넌트) */}
      <ReportModal
        visible={!!processed}
        processed={processed}
        onClose={() => setProcessed(null)}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    padding: "16px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    width: "100%",
    maxWidth: "100%",
    minWidth: "320px",
    margin: "0 auto",
    boxSizing: "border-box",
    background: "transparent",
  },
  title: {
    margin: "0 0 12px",
    fontSize: "clamp(16px, 4vw, 18px)",
    textAlign: "center",
  },
  tip: {
    color: "#666",
    marginTop: 12,
    fontSize: "clamp(11px, 2.5vw, 12px)",
    textAlign: "center",
  },
  hud: {
    color: "#333",
    marginTop: 8,
    fontSize: "clamp(12px, 2.5vw, 13px)",
    textAlign: "center",
    whiteSpace: "pre-wrap",
  },
  button: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ddd",
    background: "#f6f6f6",
    cursor: "pointer",
  },
  header: {
    padding: "8px 0",
    borderBottom: "1px solid #ddd",
    marginBottom: 16,
    textAlign: "center",
  },
  username: {
    fontSize: "14px",
    color: "#333",
    fontWeight: 500,
  },
};
