// Session management — anonymous user identity + recent rooms

const SESSION_KEY = "talk_session_id";
const RECENT_ROOMS_KEY = "talk_recent_rooms";

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// ── Recent rooms ──

export function getRecentRooms(): Array<{
  code: string;
  name: string;
}> {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addRecentRoom(room: { code: string; name: string }) {
  const recent = getRecentRooms().filter((r) => r.code !== room.code);
  recent.unshift(room);
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(recent.slice(0, 10)));
}
