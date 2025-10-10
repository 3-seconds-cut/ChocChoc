import { useState, useEffect } from "react";

type APIBase = string;

export function useInit(API_BASE: APIBase, onReady?: () => void) {
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [hasServerApiKey, setHasServerApiKey] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempUserName, setTempUserName] = useState("");
  const [tempApiKey, setTempApiKey] = useState("");

  const fetchUserInfo = async (userId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/get-user-status?user_id=${encodeURIComponent(userId)}`,
        { method: "POST" }
      );
      if (!res.ok) return null;
      const status = await res.json();
      const res2 = await fetch(
        `${API_BASE}/get-user-honor?user_id=${encodeURIComponent(userId)}`,
        { method: "POST" }
      );
      const honor = res2.ok ? await res2.json() : null;
      const info = { status, honor };
      setUserInfo(info);
      if (status?.payload?.name) {
        localStorage.setItem("userName", String(status.payload.name));
      }
      return info;
    } catch (e) {
      console.error("useInit.fetchUserInfo failed", e);
      return null;
    }
  };

  const fetchHasApiKey = async (userId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/has-apikey?user_id=${encodeURIComponent(userId)}`,
        { method: "GET" }
      );
      if (!res.ok) return false;
      const json = await res.json();
      return Boolean(json?.has_api_key);
    } catch (e) {
      console.error("useInit.fetchHasApiKey failed", e);
      return false;
    }
  };

  const registerUser = async (id: string, name?: string) => {
    try {
      const res = await fetch(`${API_BASE}/register-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: String(id), name: name ?? "" }),
      });
      if (!res.ok) {
        console.warn("useInit.registerUser failed:", res.status);
        return null;
      }
      const json = await res.json();
      const savedId = json?.user?.id ?? id;
      localStorage.setItem("userId", String(savedId));
      if (json?.user?.name) localStorage.setItem("userName", String(json.user.name));
      return json?.user ?? null;
    } catch (e) {
      console.error("useInit.registerUser error:", e);
      return null;
    }
  };

  const registerApiKey = async (apiKey: string, userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/register-apikey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, user_id: userId }),
      });
      if (!res.ok) throw new Error("register-apikey failed");
      setHasServerApiKey(true);
      return true;
    } catch (e) {
      console.error("useInit.registerApiKey failed", e);
      return false;
    }
  };

  const clearApiKey = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/clear-apikey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) throw new Error("clear-apikey failed");
      setHasServerApiKey(false);
      return true;
    } catch (e) {
      console.error("useInit.clearApiKey failed", e);
      return false;
    }
  };

  const tryStartIfReady = () => {
    const hasUserName =
      Boolean(userInfo?.status?.payload?.name) || Boolean(localStorage.getItem("userName"));
    if (hasUserName && hasServerApiKey) {
      onReady?.();
    }
  };

  useEffect(() => {
    (async () => {
      const uid = localStorage.getItem("userId") ?? "1";
      const info = await fetchUserInfo(String(uid));
      const serverName = info?.status?.payload?.name;
      if (!serverName || serverName === "") {
        setTempUserName(serverName ?? "");
        setShowUserModal(true);
      }
      const hasKey = await fetchHasApiKey(String(uid));
      setHasServerApiKey(hasKey);
      tryStartIfReady();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // user save wrapper used by UI
  const handleUserSave = async () => {
    const uid = localStorage.getItem("userId") ?? "1";
    const created = await registerUser(String(uid), tempUserName.trim() || "Guest");
    if (created) await fetchUserInfo(String(uid));
    setShowUserModal(false);
    tryStartIfReady();
  };

  const handleApiKeySave = async () => {
    const uid = localStorage.getItem("userId") ?? "1";
    const ok = await registerApiKey(tempApiKey, uid);
    if (ok) {
      setTempApiKey("");
      setShowApiKeyModal(false);
      tryStartIfReady();
    } else {
      alert("API Key 등록 중 오류가 발생했습니다.");
    }
  };

  const handleApiKeyClear = async () => {
    const uid = localStorage.getItem("userId") ?? "1";
    const ok = await clearApiKey(uid);
    if (!ok) alert("API Key 삭제 중 오류가 발생했습니다.");
  };

  return {
    // states
    userInfo,
    hasServerApiKey,
    showUserModal,
    showApiKeyModal,
    tempUserName,
    tempApiKey,
    // setters (if App needs them)
    setTempUserName,
    setTempApiKey,
    setShowUserModal,
    setShowApiKeyModal,
    // handlers
    handleUserSave,
    handleApiKeySave,
    handleApiKeyClear,
    // helpers (if useful)
    fetchUserInfo,
    fetchHasApiKey,
  };
}