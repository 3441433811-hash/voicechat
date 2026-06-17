import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

export default function PreJoin() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as
    | { nickname?: string; roomName?: string }
    | undefined;

  const [nickname, setNickname] = useState(state?.nickname || "");
  const [micOk, setMicOk] = useState(false);
  const [micError, setMicError] = useState("");
  const [checking, setChecking] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  // Request microphone permission on mount
  useEffect(() => {
    if (!state?.nickname) {
      navigate(`/prejoin/${code}`, { state: { nickname: "", roomName: state?.roomName }, replace: true });
      return;
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;
        setMicOk(true);
      } catch (err: any) {
        setMicError(
          err.name === "NotAllowedError"
            ? "麦克风权限被拒绝，请在浏览器设置中允许"
            : "无法访问麦克风"
        );
      } finally {
        setChecking(false);
      }
    })();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleJoin = () => {
    if (!nickname.trim()) return;
    // Stop mic test stream before joining
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    navigate(`/room/${code}`, {
      state: { nickname: nickname.trim(), roomName: state?.roomName || "" },
    });
  };

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: 28,
          }}
        >
          🎤
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          {state?.roomName || "加入房间"}
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4, fontFamily: "monospace" }}>
          房间号: {code}
        </p>
      </div>

      <div className="card" style={{ width: "100%", maxWidth: 440 }}>
        {/* Nickname */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          <label
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            你的昵称
          </label>
          <input
            placeholder="输入你的昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
        </div>

        {/* Mic status */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "var(--bg)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {checking ? (
            <>
              <div style={{ color: "var(--text-muted)" }}>⏳</div>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                检测麦克风...
              </span>
            </>
          ) : micOk ? (
            <>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--green)",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 14 }}>麦克风就绪</span>
            </>
          ) : (
            <>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--danger)",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 14, color: "var(--danger)" }}>
                {micError}
              </span>
            </>
          )}
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={handleJoin}
          disabled={!nickname.trim()}
          style={{ width: "100%" }}
        >
          进入房间
        </button>
      </div>

      <button
        className="btn btn-ghost"
        onClick={() => navigate("/")}
      >
        ← 返回首页
      </button>
    </div>
  );
}
