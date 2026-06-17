const API_BASE = "/api";

// ── Rooms ──

export async function createRoom(name: string) {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "创建房间失败");
  }
  return res.json() as Promise<{
    code: string;
    name: string;
    shareUrl: string;
  }>;
}

export async function checkRoom(code: string) {
  const res = await fetch(
    `${API_BASE}/rooms/${encodeURIComponent(code)}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "房间不存在");
  }
  return res.json() as Promise<{
    exists: boolean;
    code: string;
    name: string;
    created_at: number;
  }>;
}

export async function getLiveKitToken(code: string, nickname: string) {
  const res = await fetch(`${API_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, nickname }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "获取令牌失败");
  }
  return res.json() as Promise<{
    token: string;
    livekitUrl: string;
    roomName: string;
    roomCode: string;
    roomName2: string;
  }>;
}
