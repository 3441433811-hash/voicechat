import { FastifyInstance } from "fastify";
import { createRoom, getRoom, roomExists, addMessage, getMessages } from "./kv.js";
import { AccessToken } from "livekit-server-sdk";
import { nanoid } from "nanoid";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";

export async function registerRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════
  //  POST /api/rooms — 创建房间
  // ═══════════════════════════════════════════
  app.post("/api/rooms", async (request, reply) => {
    const { name } = request.body as { name?: string };

    if (!name || name.trim().length < 2 || name.length > 32) {
      return reply.status(400).send({ error: "房间名需要 2-32 个字符" });
    }

    try {
      const result = await createRoom(name.trim());
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "生成房间号失败" });
    }
  });

  // ═══════════════════════════════════════════
  //  GET /api/rooms/:code — 校验房间号
  // ═══════════════════════════════════════════
  app.get("/api/rooms/:code", async (request, reply) => {
    const { code } = request.params as { code: string };
    const room = await getRoom(code.toUpperCase());

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
    const room = await getRoom(code.toUpperCase());
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
    const exists = await roomExists(roomCode);
    if (!exists) {
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

    const msg = await addMessage(roomCode, sessionId, nickname, content);

    return reply.status(201).send(msg);
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
    const exists = await roomExists(roomCode);
    if (!exists) {
      return reply.status(404).send({ error: "房间不存在" });
    }

    const limit = Math.min(
      parseInt(query.limit || "50", 10) || 50,
      100
    );

    const result = await getMessages(roomCode, {
      after: query.after,
      before: query.before ? parseInt(query.before, 10) : undefined,
      limit,
    });

    return result;
  });
}
