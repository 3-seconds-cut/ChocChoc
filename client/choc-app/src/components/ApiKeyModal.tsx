import React from "react";

interface ApiKeyModalProps {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClose?: () => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  visible,
  value,
  onChange,
  onSave,
  onClose,
  disabled,
  title = "API Key 입력",
  subtitle,
}) => {
  if (!visible) return null;
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
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {subtitle && <p style={{ color: "#444" }}>{subtitle}</p>}
        <input
          type="text"
          placeholder="API Key를 입력하세요"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
            onClick={onSave}
            disabled={disabled}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              background: disabled ? "#ccc" : "#007BFF",
              color: "#fff",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            저장하고 시작
          </button>
          {onClose && (
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
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
};