import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// ── Types ──

export interface ChatMessage {
  id: string;
  room_code: string;
  sender_nickname: string;
  sender_session_id: string;
  content: string;
  created_at: number;
}

interface RoomRecord {
  code: string;
  name: string;
  created_at: number;
}

// ── Helpers ──

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function parseMessage(raw: Record<string, unknown> | null): ChatMessage | null {
  if (!raw) return null;
  return {
    id: String(raw.id || ""),
    room_code: String(raw.room_code || ""),
    sender_nickname: String(raw.sender_nickname || ""),
    sender_session_id: String(raw.sender_session_id || ""),
    content: String(raw.content || ""),
    created_at: parseInt(String(raw.created_at || "0"), 10),
  };
}

function parseRoom(raw: Record<string, unknown> | null): RoomRecord | null {
  if (!raw || !raw.code) return null;
  return {
    code: String(raw.code),
    name: String(raw.name || ""),
    created_at: parseInt(String(raw.created_at || "0"), 10),
  };
}

// ── Rooms ──

export async function createRoom(name: string): Promise<{ code: string; name: string }> {
  let code = "";
  for (let i = 0; i < 10; i++) {
    code = generateRoomCode();
    const exists = await redis.exists(`room:${code}`);
    if (!exists) break;
    code = "";
  }
  if (!code) {
    throw new Error("生成房间号失败，请重试");
  }

  const now = Date.now();
  await redis.hset(`room:${code}`, {
    code,
    name,
    created_at: String(now),
  });

  return { code, name };
}

export async function getRoom(
  code: string
): Promise<RoomRecord | null> {
  const raw = await redis.hgetall(`room:${code}`);
  return parseRoom(raw);
}

export async function roomExists(code: string): Promise<boolean> {
  const result = await redis.exists(`room:${code}`);
  return result === 1;
}

// ── Messages ──

export async function addMessage(
  roomCode: string,
  sessionId: string,
  nickname: string,
  content: string
): Promise<ChatMessage> {
  const { nanoid } = await import("nanoid");
  const id = nanoid();
  const now = Date.now();

  const msg = {
    id,
    room_code: roomCode,
    sender_nickname: nickname.trim(),
    sender_session_id: sessionId,
    content: content.trim(),
    created_at: now,
  };

  // Store message data + add to sorted set atomically via pipeline
  const pipe = redis.pipeline();
  pipe.hset(`msg:${id}`, {
    id: msg.id,
    room_code: msg.room_code,
    sender_nickname: msg.sender_nickname,
    sender_session_id: msg.sender_session_id,
    content: msg.content,
    created_at: String(msg.created_at),
  });
  pipe.zadd(`msgs:${roomCode}`, { score: now, member: id });
  await pipe.exec();

  return msg;
}

export async function getMessages(
  roomCode: string,
  opts: {
    before?: number;
    after?: string;
    limit?: number;
  } = {}
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const limit = Math.min(opts.limit || 50, 100);

  let ids: string[];

  if (opts.after) {
    // Polling mode: fetch messages after a given message ID
    const afterTimeStr = await redis.hget(`msg:${opts.after}`, "created_at");
    const afterTime = afterTimeStr ? parseInt(String(afterTimeStr), 10) : 0;

    // Get messages with score >= afterTime (fetch one extra to filter)
    ids = await redis.zrange(`msgs:${roomCode}`, afterTime, Date.now(), {
      byScore: true,
      offset: 0,
      count: limit + 1,
    });

    // Filter out the exact "after" message, then limit
    ids = ids.filter((id) => id !== opts.after).slice(0, limit);
  } else {
    // Load older mode: fetch messages before a timestamp (newest first)
    const before = opts.before ?? Date.now() + 1;

    ids = await redis.zrange(`msgs:${roomCode}`, 0, before - 1, {
      byScore: true,
      rev: true,
      offset: 0,
      count: limit,
    });
    // Reverse to chronological order
    ids.reverse();
  }

  if (ids.length === 0) {
    return { messages: [], hasMore: false };
  }

  // Fetch all messages in parallel
  const pipe = redis.pipeline();
  ids.forEach((id) => pipe.hgetall(`msg:${id}`));
  const results = await pipe.exec();
  const messages = results
    .map((r) => parseMessage(r as Record<string, string> | null))
    .filter((m): m is ChatMessage => m !== null);

  return {
    messages,
    hasMore: ids.length === limit,
  };
}
