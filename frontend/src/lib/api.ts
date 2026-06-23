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

// ── Chat Messages ──

export interface ChatMessage {
  id: string;
  room_code: string;
  sender_nickname: string;
  sender_session_id: string;
  content: string;
  created_at: number;
}

export async function sendMessage(
  code: string,
  sessionId: string,
  nickname: string,
  content: string
): Promise<ChatMessage> {
  const res = await fetch(
    `${API_BASE}/rooms/${encodeURIComponent(code)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, nickname, content }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "发送消息失败");
  }
  return res.json();
}

export async function getMessages(
  code: string,
  opts?: { after?: string; before?: number; limit?: number }
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (opts?.after) params.set("after", opts.after);
  if (opts?.before) params.set("before", String(opts.before));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/rooms/${encodeURIComponent(code)}/messages${qs ? "?" + qs : ""}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "获取消息失败");
  }
  return res.json();
}
