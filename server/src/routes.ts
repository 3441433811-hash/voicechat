import { FastifyInstance } from "fastify";
import { dbRun, dbGet } from "./db.js";
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
}
