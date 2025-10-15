import React from "react";

interface ReportModalProps {
  visible: boolean;
  processed: any | null;
  onClose?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ visible, processed, onClose }) => {
  if (!visible || !processed) return null;

  return (
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
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: 720,
          maxWidth: "100%",
          maxHeight: "85vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 8,
          padding: 20,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            "{String(processed.user_name ?? processed.userName ?? "Guest")}"의 눈 건강 리포트 💾
          </div>
          <div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 18,
                cursor: "pointer",
                padding: 6,
              }}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {"message" in processed && !("report" in processed) && (
            <div style={{ marginBottom: 6 }}>{String(processed.message)}</div>
          )}

          {"honor" in processed && processed.honor && (
            <div style={{ margin: "10px 0", textAlign: "center", color: processed.honor.color || "#21c074", fontWeight: 700, fontSize: 32 }}>
              🎉 신규 칭호 획득! <span style={{ color: processed.honor.color || "#21c074" }}>{processed.honor.title}</span>
            </div>
          )}

          {"daily_blink_per_minute" in processed && (
            <div style={{ marginTop: 6 }}>
              <b>오늘의 평균 눈 깜빡임 횟수 👁️</b>{" "}
              {Number(processed.daily_blink_per_minute || 0).toFixed(2)}회 / 분
            </div>
          )}

          {"report" in processed && (
            <div style={{ marginTop: 12, textAlign: "center", fontSize: 15 }}>
              <b>['촉💦'의 한 마디]</b>
            </div>
          )}

          {"report" in processed && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                maxHeight: 320,
                overflow: "auto",
                background: "#f9f9f9",
                padding: 12,
                borderRadius: 6,
                marginTop: 8,
              }}
            >
              {processed.report}
            </pre>
          )}

          {"daily_line_plot_b64" in processed && processed.daily_line_plot_b64 && (
            <>
              <div style={{ marginTop: 12, textAlign: "center", fontSize: 15 }}>
                <b>[오늘의 깜빡✨ 그래프]</b>
              </div>
              <img
                alt="plot"
                style={{ width: "100%", marginTop: 8, borderRadius: 6 }}
                src={`data:image/png;base64,${processed.daily_line_plot_b64}`}
              />
            </>
          )}
        </div>

        <div style={{ marginTop: 14, textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ddd",
              background: "#f6f6f6",
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};