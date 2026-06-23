import { FastifyInstance } from "fastify";
import { dbRun, dbGet, dbAll } from "./db.js";
import { AccessToken } from "livekit-server-sdk";
import { nanoid } from "nanoid";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";
const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

// ── Helpers ──

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function registerRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════
  //  POST /api/rooms — 创建房间
  // ═══════════════════════════════════════════
  app.post("/api/rooms", async (request, reply) => {
    const { name } = request.body as { name?: string };

    if (!name || name.trim().length < 2 || name.length > 32) {
      return reply.status(400).send({ error: "房间名需要 2-32 个字符" });
    }

    const trimmedName = name.trim();

    // Generate unique room code
    let code = "";
    for (let i = 0; i < 10; i++) {
      code = generateRoomCode();
      const existing = dbGet("SELECT code FROM rooms WHERE code = ?", [code]);
      if (!existing) break;
    }
    if (!code) {
      return reply.status(500).send({ error: "生成房间号失败" });
    }

    dbRun("INSERT INTO rooms (code, name) VALUES (?, ?)", [code, trimmedName]);

    return {
      code,
      name: trimmedName,
      shareUrl: `${BASE_URL}/room/${code}`,
    };
  });

  // ═══════════════════════════════════════════
  //  GET /api/rooms/:code — 校验房间号
  // ═══════════════════════════════════════════
  app.get("/api/rooms/:code", async (request, reply) => {
    const { code } = request.params as { code: string };
    const room = dbGet(
      "SELECT code, name, created_at FROM rooms WHERE code = ?",
      [code.toUpperCase()]
    );

    if (!room) {
      return reply.status(404).send({ exists: false, error: "房间不存在" });
    }

    return { exists: true, ...room };
  });

  // ═══════════════════════════════════════════
  //  POST /api/token — 签发 LiveKit JWT
  // ═══════════════════════════════════════════
  app.post("/api/token", async (request, reply) => {
    const { code, nickname } = request.body as {
      code?: string;
      nickname?: string;
    };

    if (!code || !nickname || nickname.trim().length === 0) {
      return reply.status(400).send({ error: "房间号和昵称为必填" });
    }

    // Verify room exists
    const room = dbGet("SELECT code, name FROM rooms WHERE code = ?", [
      code.toUpperCase(),
    ]);
    if (!room) {
      return reply.status(404).send({ error: "房间不存在" });
    }

    const roomName = code.toUpperCase();
    const identity = `${nickname.trim()}#${nanoid(6)}`;

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: nickname.trim(),
      ttl: "10m",
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return {
      token,
      livekitUrl: LIVEKIT_URL,
      roomName,
      roomCode: room.code,
      roomName2: room.name,
    };
  });

  // ═══════════════════════════════════════════
  //  POST /api/rooms/:code/messages — 发送消息
  // ═══════════════════════════════════════════
  app.post("/api/rooms/:code/messages", async (request, reply) => {
    const { code } = request.params as { code: string };
    const { sessionId, nickname, content } = request.body as {
      sessionId?: string;
      nickname?: string;
      content?: string;
    };

    const roomCode = code.toUpperCase();

    // Validate room exists
    const room = dbGet("SELECT code FROM rooms WHERE code = ?", [roomCode]);
    if (!room) {
      return reply.status(404).send({ error: "房间不存在" });
    }

    // Validate fields
    if (!sessionId || !nickname || !nickname.trim()) {
      return reply.status(400).send({ error: "sessionId 和 nickname 为必填" });
    }
    if (!content || content.trim().length === 0) {
      return reply.status(400).send({ error: "消息内容不能为空" });
    }
    if (content.length > 2000) {
      return reply.status(400).send({ error: "消息内容不能超过 2000 字符" });
    }

    const id = nanoid();
    const now = Date.now();
    const trimmedNickname = nickname.trim();
    const trimmedContent = content.trim();

    dbRun(
      "INSERT INTO messages (id, room_code, sender_nickname, sender_session_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, roomCode, trimmedNickname, sessionId, trimmedContent, now]
    );

    return reply.status(201).send({
      id,
      room_code: roomCode,
      sender_nickname: trimmedNickname,
      sender_session_id: sessionId,
      content: trimmedContent,
      created_at: now,
    });
  });

  // ═══════════════════════════════════════════
  //  GET /api/rooms/:code/messages — 获取消息
  // ═══════════════════════════════════════════
  app.get("/api/rooms/:code/messages", async (request, reply) => {
    const { code } = request.params as { code: string };
    const query = request.query as {
      after?: string;
      before?: string;
      limit?: string;
    };

    const roomCode = code.toUpperCase();

    // Validate room exists
    const room = dbGet("SELECT code FROM rooms WHERE code = ?", [roomCode]);
    if (!room) {
      return reply.status(404).send({ error: "房间不存在" });
    }

    const limit = Math.min(
      parseInt(query.limit || "50", 10) || 50,
      100
    );

    let messages: any[];

    if (query.after) {
      // Polling mode: fetch messages after a given id
      const afterMsg = dbGet(
        "SELECT created_at FROM messages WHERE id = ?",
        [query.after]
      );
      const afterTime = afterMsg ? afterMsg.created_at : 0;

      messages = dbAll(
        `SELECT id, room_code, sender_nickname, sender_session_id, content, created_at
         FROM messages
         WHERE room_code = ? AND created_at >= ? AND id != ?
         ORDER BY created_at ASC, id ASC
         LIMIT ?`,
        [roomCode, afterTime, query.after, limit]
      );
    } else {
      // Initial load / load older mode: fetch messages before a timestamp
      const before = query.before
        ? parseInt(query.before, 10)
        : Date.now() + 1;

      messages = dbAll(
        `SELECT id, room_code, sender_nickname, sender_session_id, content, created_at
         FROM messages
         WHERE room_code = ? AND created_at < ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [roomCode, before, limit]
      );
      // Reverse to chronological order
      messages.reverse();
    }

    return {
      messages,
      hasMore: messages.length === limit,
    };
  });
}
