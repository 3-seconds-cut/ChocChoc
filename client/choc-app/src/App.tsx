// src/App.tsx
import { useState, useEffect, useRef } from "react";
import { useCamera } from "./hooks/useCamera";
import { useDisplaySettings } from "./hooks/useDisplaySettings";
import { useBlinkDetector } from "./useBlinkDetector";
import { useGazeDetector } from "./hooks/useGazeDetector";
import { useGameLogic } from "./useGameLogic";
import { GameUI } from "./GameUI";
import { VideoDisplay } from "./components/VideoDisplay";
import { ControlPanel } from "./components/ControlPanel";
import { GameOverModal } from "./components/GameOverModal";
import { RevivalGame } from "./components/RevivalGame";
// import { useMicVAD } from "./hooks/useMicVAD"; // VAD 비활성

// Electron API 타입 선언
declare global {
  interface Window {
    electron?: {
      closeApp: () => void;
    };
  }
}

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
  // 감지/카메라 초기화 같은 부하작업은 실행되지 않도록 `started` 플래그를 사용합니다.
  const [started, setStarted] = useState(false);
  const [showApiInitModal, setShowApiInitModal] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tempApiKey, setTempApiKey] = useState(""); // 입력용 임시 상태

  // 시선 감지 활성화 여부
  const [gazeEnabled, setGazeEnabled] = useState(false);

  // 게임 오버 관련 상태
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameOverScore, setGameOverScore] = useState(0);
  const [gameOverCombo, setGameOverCombo] = useState(0);

  // 부활 게임 관련 상태
  const [showRevivalGame, setShowRevivalGame] = useState(false);

  // 모달이 열려 있으면 깜빡임 감지 비활성화
  const blink = useBlinkDetector(videoRef, started && !showApiInitModal && !showGameOverModal && !showRevivalGame);

  // 시선 감지 (깜빡임 감지와 독립적으로 동작, 부활 게임 중에는 항상 활성화)
  const gaze = useGazeDetector(videoRef, (gazeEnabled || showRevivalGame) && started && !showApiInitModal && !showGameOverModal);

  // 게임 로직
  const { gameState, resetGame, togglePause, restoreHeart, loseHeart } =
    useGameLogic(blink.blinks, blink.lastBlinkAt);

  // 게임 오버 감지 및 모달 표시
  useEffect(() => {
    if (!gameState.isAlive && !showGameOverModal) {
      setGameOverScore(gameState.score);
      setGameOverCombo(gameState.combo);
      setShowGameOverModal(true);
    }
  }, [gameState.isAlive, showGameOverModal, gameState.score, gameState.combo]);

  // 게임 오버 모달 핸들러
  const handleContinueGame = () => {
    console.log("부활 게임을 시작합니다!");
    setShowGameOverModal(false);

    // 부활 게임을 위해 카메라와 얼굴 표시 강제 활성화
    console.log("현재 카메라 상태:", { state, ready });

    // 카메라가 준비되지 않았으면 강제로 시작
    if (state !== "ready") {
      console.log("카메라 재시작 중...");
      startCamera();
    }

    // 얼굴 표시 활성화
    setShowFace(true);

    // 바로 부활 게임 시작
    setShowRevivalGame(true);
  };

  const handleEndGame = () => {
    console.log("앱을 종료합니다.");
    setShowGameOverModal(false);
    // 앱 종료 (Electron 환경에서)
    if (window.electron && window.electron.closeApp) {
      window.electron.closeApp();
    } else {
      // 웹 환경에서는 창 닫기 시도
      window.close();
      // 만약 window.close()가 작동하지 않으면 페이지 새로고침으로 리셋
      if (!window.closed) {
        window.location.reload();
      }
    }
  };

  // 부활 게임 핸들러
  const handleRevivalGameComplete = () => {
    console.log("부활 게임 완료! 게임을 다시 시작합니다!");
    setShowRevivalGame(false);
    resetGame(); // 게임을 완전히 리셋 (점수, 콤보, 하트 초기화)
    // 모든 상태가 초기화되고 새 게임이 시작됨
  };

  const handleRevivalGameCancel = () => {
    console.log("부활 게임을 취소합니다.");
    setShowRevivalGame(false);
    setShowGameOverModal(true); // 게임 오버 모달로 되돌아감
  };

  // 모달로 인해 강제로 일시정지한 여부 추적 (timeRemaining 감소 중지 목적)
  const modalPausedRef = useRef(false);
  useEffect(() => {
    const shouldPause = showApiInitModal || showGameOverModal;

    if (shouldPause) {
      // 모달 열렸을 때 게임이 실행중이면 일시정지 시키고 표시
      if (!gameState.isPaused) {
        togglePause();
        modalPausedRef.current = true;
      }
    } else {
      // 모달로 인해 일시정지시킨 경우 모달 닫히면 원래대로 되돌림
      if (modalPausedRef.current) {
        togglePause();
        modalPausedRef.current = false;
      }
    }
    // gameState.isPaused, togglePause는 의존성으로 포함
  }, [showApiInitModal, showGameOverModal, gameState.isPaused, togglePause]);

  // 🎤 VAD 상태 (비활성)
  // const vad = useMicVAD(true);

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

  // 서버 URL
  const API_BASE =
    (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";

  // 데이터 서버로 전송
  const sendBlinkData = async () => {
    if (!apiKey) {
      console.error("API Key가 필요합니다.");
      return false;
    }

    const payload = {
      id: "1",
      events,
      startedAt: startedAt.current,
      endedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_BASE}/blink-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`, // API 키 추가
        },
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
    if (!apiKey) {
      console.error("API Key가 필요합니다.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/processed-data/1`, {
        headers: {
          Authorization: `Bearer ${apiKey}`, // API 키 추가
        },
      });
      const json = await res.json();
      setProcessed(json);
      console.log("processed:", json);
    } catch (e) {
      console.error(e);
    }
  };

  // 전송 후 즉시 분석결과 조회
  const sendAndFetch = async () => {
    if (!apiKey) {
      // API 키가 없으면 입력 모달을 띄움
      console.log("API Key is required.");
      setShowApiKeyModal(true);
      return;
    }

    const ok = await sendBlinkData();
    if (ok) await fetchProcessed();
  };

  // HUD 표시 문자열
  const hudText = (() => {
    const avg = isFinite(blink.avgRatio) ? blink.avgRatio : 0;
    const min = isFinite(blink.windowMin) ? blink.windowMin : 0;
    const max = isFinite(blink.windowMax) ? blink.windowMax : 0;
    const lastTs = blink.lastCalibratedAt
      ? new Date(blink.lastCalibratedAt).toLocaleTimeString()
      : "-";
    return `평균: ${avg.toFixed(3)} | 임계값: 감음<${blink.CLOSE_T.toFixed(
      2
    )} / 뜸>${blink.OPEN_T.toFixed(2)} | 최솟값: ${min.toFixed(
      3
    )} / 최댓값: ${max.toFixed(3)} | 최근 갱신: ${lastTs}`;
  })();

  useEffect(() => {
    const savedApiKey = localStorage.getItem("apiKey");
    if (savedApiKey) setApiKey(savedApiKey);
  }, []);

  const handleApiKeySave = async () => {
    const cleaned = tempApiKey.trim();
    setApiKey(cleaned);
    localStorage.setItem("apiKey", cleaned);
    setShowApiKeyModal(false);

    // 서버에 API Key 전달
    try {
      const res = await fetch(`${API_BASE}/register-apikey`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ api_key: tempApiKey }),
      });
      if (!res.ok) throw new Error("API Key 등록 실패");
      // 필요하다면 서버 응답 처리
    } catch (e) {
      alert("서버에 API Key 등록 중 오류가 발생했습니다.");
      setStarted(false);
      return;
    }

    setStarted(true);
    setShowApiInitModal(false);
  };

  return (
    <div style={styles.wrap}>
      {/* 시작 전 모달 */}
      {!started && !apiKey && (
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
                onClick={() => setShowApiKeyModal(true)}
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
                onClick={() => { setStarted(true); setShowApiInitModal(false); }}
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

      {/* API Key 입력 모달 */}
      {showApiKeyModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 20,
          }}
        >
          <div
            style={{
              width: 380,
              maxWidth: "100%",
              background: "#fff",
              borderRadius: 8,
              padding: 20,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
          >
            <h3 style={{ marginTop: 0 }}>API Key 입력</h3>
            <input
              type="text"
              placeholder="API Key를 입력하세요"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: 4,
                border: "1px solid #ddd",
                width: "100%",
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={handleApiKeySave}
                disabled={!tempApiKey}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: tempApiKey ? "#007BFF" : "#ccc",
                  color: "#fff",
                  cursor: tempApiKey ? "pointer" : "not-allowed",
                }}
              >
                저장하고 시작
              </button>
              <button
                onClick={() => setShowApiKeyModal(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "#f6f6f6",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 게임 오버 모달 */}
      <GameOverModal
        isVisible={showGameOverModal}
        score={gameOverScore}
        combo={gameOverCombo}
        onContinueGame={handleContinueGame}
        onEndGame={handleEndGame}
      />

      {/* 부활 게임 */}
      <RevivalGame
        isVisible={showRevivalGame}
        gazeDirection={gaze.direction}
        onGameComplete={handleRevivalGameComplete}
        onGameCancel={handleRevivalGameCancel}
        cameraReady={state === "ready" && ready}
        gazeReady={gaze.isReady}
        videoElement={videoRef.current}
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
          apiKey={apiKey}
          onOpenApiKeyModal={() => {
            setTempApiKey(apiKey || ""); // 기존 API Key를 입력 필드에 채움
            setShowApiKeyModal(true); // 모달 열기
          }}
          onClearApiKey={() => {
            setApiKey(null); // API Key 초기화
            localStorage.removeItem("apiKey"); // 로컬 스토리지에서 삭제
          }}
          gazeEnabled={gazeEnabled}
          gazeDirection={gaze.direction}
          gazePos={gaze.gazePos}
          calibratedPos={gaze.calibratedPos}
          gazeReady={gaze.isReady}
          onGazeEnabledChange={setGazeEnabled}
          onGazeCalibrate={gaze.calibrate}
          onGazeReset={gaze.reset}
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

      {/* 시선 감지 디버깅 오버레이 */}
      {gazeEnabled && gaze.isReady && (
        <div style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: "rgba(0,0,0,0.8)",
          color: "#fff",
          padding: 12,
          borderRadius: 8,
          fontSize: 12,
          fontFamily: "monospace",
          zIndex: 1000,
        }}>
          <div style={{ marginBottom: 4, fontWeight: "bold" }}>
            🎯 시선 감지 상태
          </div>
          <div>방향: <span style={{
            color: gaze.direction === "NO_FACE" ? "#ff5050" :
                  gaze.direction === "EYES_CLOSED" ? "#ffb86b" : "#21c074",
            fontWeight: "bold"
          }}>
            {gaze.direction}
          </span></div>
          <div>원시 좌표: ({gaze.gazePos.px.toFixed(2)}, {gaze.gazePos.py.toFixed(2)})</div>
          <div>보정 좌표: ({gaze.calibratedPos.px.toFixed(2)}, {gaze.calibratedPos.py.toFixed(2)})</div>
          <div>임계값: τx={gaze.thresholds.tau_x}, τy={gaze.thresholds.tau_y}</div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
            C: 캘리브레이션 | R: 리셋
          </div>
        </div>
      )}

      {/* <p style={styles.tip}>
        ※ 완전한 깜빡임 사이클(뜸→감음→뜸)을 감지합니다. 눈을 감고만 있으면
        카운트되지 않아요!
      </p> */}

      {/* 임시 결과 패널 */}
      {processed && (
        <div
          style={{
            position: "relative",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            padding: 12,
            borderRadius: 8,
            marginTop: 10,
            fontFamily: "monospace",
          }}
        >
          <div
            style={{
              marginBottom: 8,
              fontWeight: 700,
              textAlign: "center",
              fontSize: "18px",
            }}
          >
            <b>"{String(processed.user_name)}"의 눈 건강 리포트 💾</b>
          </div>

          {"message" in processed && !("report" in processed) && (
            <div style={{ marginBottom: 6 }}>{String(processed.message)}</div>
          )}

          {"daily_blink_per_minute" in processed && (
            <div style={{ marginTop: 6 }}>
              <b>오늘의 평균 눈 깜박임 횟수 👁️</b>{" "}
              {Number(processed.daily_blink_per_minute || 0).toFixed(2)}회 / 분
            </div>
          )}

          {"report" in processed && (
            <div
              style={{ marginTop: 6, textAlign: "center", fontSize: "15px" }}
            >
              <b>['촉💦'의 한 마디]</b>
            </div>
          )}

          {"report" in processed && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                maxHeight: 220,
                overflow: "auto",
              }}
            >
              {processed.report}
            </pre>
          )}

          {"daily_line_plot_b64" in processed && (
            <div
              style={{ marginTop: 6, textAlign: "center", fontSize: "15px" }}
            >
              <b>[오늘의 깜빡✨ 그래프]</b>
            </div>
          )}

          {"daily_line_plot_b64" in processed &&
            processed.daily_line_plot_b64 && (
              <img
                alt="plot"
                style={{ width: "100%", marginTop: 8, borderRadius: 6 }}
                src={`data:image/png;base64,${processed.daily_line_plot_b64}`}
              />
            )}
        </div>
      )}
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
};
