import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, checkRoom } from "../lib/api";
import { getRecentRooms } from "../lib/session";

const RANDOM_NAMES = [
  "快乐的熊猫", "勇敢的狮子", "聪明的海豚", "温柔的猫咪",
  "闪电侠", "星空漫步者", "深海潜水员", "雪山飞狐",
  "午后红茶", "深夜咖啡", "清晨阳光", "黄昏晚霞",
];

export default function Home() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"create" | "join">("create");

  // Create form
  const [roomName, setRoomName] = useState("");

  // Join form
  const [roomCode, setRoomCode] = useState("");

  // Nickname
  const [nickname, setNickname] = useState(
    () => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const recentRooms = getRecentRooms();

  const handleCreate = async () => {
    if (!roomName.trim() || roomName.trim().length < 2) {
      setError("房间名至少需要 2 个字符");
      return;
    }
    if (!nickname.trim()) {
      setError("请输入你的昵称");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await createRoom(roomName.trim());
      navigate(`/room/${result.code}`, {
        state: { nickname: nickname.trim(), roomName: result.name },
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("请输入房间号");
      return;
    }
    if (!nickname.trim()) {
      setError("请输入你的昵称");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await checkRoom(code);
      navigate(`/prejoin/${result.code}`, {
        state: { nickname: nickname.trim(), roomName: result.name },
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
        gap: 32,
      }}
    >
      {/* Logo */}
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
          🎙️
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>语音聊天室</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 6 }}>
          输入昵称即可加入，无需注册
        </p>
      </div>

      {/* Card */}
      <div className="card" style={{ width: "100%", maxWidth: 440 }}>
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 24,
            background: "var(--bg)",
            borderRadius: 8,
            padding: 3,
          }}
        >
          <button
            onClick={() => setTab("create")}
            style={{
              flex: 1,
              padding: "8px 16px",
              borderRadius: 6,
              fontWeight: 500,
              fontSize: 14,
              background: tab === "create" ? "var(--bg-card)" : "transparent",
              color: tab === "create" ? "var(--text)" : "var(--text-muted)",
            }}
          >
            创建房间
          </button>
          <button
            onClick={() => setTab("join")}
            style={{
              flex: 1,
              padding: "8px 16px",
              borderRadius: 6,
              fontWeight: 500,
              fontSize: 14,
              background: tab === "join" ? "var(--bg-card)" : "transparent",
              color: tab === "join" ? "var(--text)" : "var(--text-muted)",
            }}
          >
            加入房间
          </button>
        </div>

        {/* Nickname input (shared) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <label
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            你的昵称
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="你的昵称"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError("");
              }}
              maxLength={20}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-ghost"
              style={{ padding: "6px 10px", fontSize: 13 }}
              onClick={() =>
                setNickname(
                  RANDOM_NAMES[
                    Math.floor(Math.random() * RANDOM_NAMES.length)
                  ]
                )
              }
            >
              🎲
            </button>
          </div>
        </div>

        <div
          style={{
            margin: "16px 0",
            borderTop: "1px solid var(--border)",
          }}
        />

        {/* Create form */}
        {tab === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              房间名
            </label>
            <input
              placeholder="输入房间名，如：周末开黑小队"
              value={roomName}
              onChange={(e) => {
                setRoomName(e.target.value);
                setError("");
              }}
              maxLength={32}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />

            <button
              className="btn btn-primary btn-lg"
              onClick={handleCreate}
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? "创建中..." : "创建房间"}
            </button>
          </div>
        )}

        {/* Join form */}
        {tab === "join" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              房间号
            </label>
            <input
              placeholder="输入 6 位房间号"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                setError("");
              }}
              maxLength={6}
              style={{
                textAlign: "center",
                fontSize: 20,
                letterSpacing: 4,
                fontWeight: 600,
              }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              autoFocus
            />
            <button
              className="btn btn-primary btn-lg"
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? "查找中..." : "加入房间"}
            </button>
          </div>
        )}

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 14, marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>

      {/* Recent rooms */}
      {recentRooms.length > 0 && (
        <div className="card" style={{ width: "100%", maxWidth: 440 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            最近加入的房间
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recentRooms.map((r) => (
              <div
                key={r.code}
                onClick={() =>
                  navigate(`/prejoin/${r.code}`, {
                    state: { nickname: nickname.trim(), roomName: r.name },
                  })
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {r.name.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 14,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontFamily: "monospace",
                    }}
                  >
                    {r.code}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
