import { createRoom, getRoom, roomExists, addMessage, getMessages } from "../server/src/kv.js";
import { AccessToken } from "livekit-server-sdk";
import { nanoid } from "nanoid";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";

// ── Helpers ──

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

async function parseBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ── Route matching helpers ──

function matchPath(
  pathname: string,
  pattern: string
): Record<string, string> | null {
  // Convert pattern "/api/rooms/:code/messages" to regex
  const paramNames: string[] = [];
  const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  const match = pathname.match(new RegExp(`^${regexStr}$`));
  if (!match) return null;

  const params: Record<string, string> = {};
  paramNames.forEach((name, i) => {
    params[name] = match[i + 1];
  });
  return params;
}

// ── Handler ──

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // GET /api/health
    if (pathname === "/api/health" && method === "GET") {
      return json({ status: "ok" });
    }

    // POST /api/rooms
    if (pathname === "/api/rooms" && method === "POST") {
      const { name } = await parseBody(req);

      if (!name || name.trim().length < 2 || name.length > 32) {
        return json({ error: "房间名需要 2-32 个字符" }, 400);
      }

      try {
        const result = await createRoom(name.trim());
        return json(result, 201);
      } catch (err: any) {
        return json({ error: err.message || "生成房间号失败" }, 500);
      }
    }

    // POST /api/token
    if (pathname === "/api/token" && method === "POST") {
      const { code, nickname } = await parseBody(req);

      if (!code || !nickname || nickname.trim().length === 0) {
        return json({ error: "房间号和昵称为必填" }, 400);
      }

      const room = await getRoom(code.toUpperCase());
      if (!room) {
        return json({ error: "房间不存在" }, 404);
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

      return json({
        token,
        livekitUrl: LIVEKIT_URL,
        roomName,
        roomCode: room.code,
        roomName2: room.name,
      });
    }

    // GET /api/rooms/:code
    const roomMatch = matchPath(pathname, "/api/rooms/:code");
    if (roomMatch && method === "GET") {
      const code = roomMatch.code.toUpperCase();
      const room = await getRoom(code);
      if (!room) {
        return json({ exists: false, error: "房间不存在" }, 404);
      }
      return json({ exists: true, ...room });
    }

    // POST /api/rooms/:code/messages
    const msgMatch = matchPath(pathname, "/api/rooms/:code/messages");
    if (msgMatch) {
      const roomCode = msgMatch.code.toUpperCase();

      if (method === "POST") {
        const { sessionId, nickname, content } = await parseBody(req);

        const exists = await roomExists(roomCode);
        if (!exists) {
          return json({ error: "房间不存在" }, 404);
        }

        if (!sessionId || !nickname || !nickname.trim()) {
          return json({ error: "sessionId 和 nickname 为必填" }, 400);
        }
        if (!content || content.trim().length === 0) {
          return json({ error: "消息内容不能为空" }, 400);
        }
        if (content.length > 2000) {
          return json({ error: "消息内容不能超过 2000 字符" }, 400);
        }

        const msg = await addMessage(roomCode, sessionId, nickname, content);
        return json(msg, 201);
      }

      if (method === "GET") {
        const exists = await roomExists(roomCode);
        if (!exists) {
          return json({ error: "房间不存在" }, 404);
        }

        const limit = Math.min(
          parseInt(url.searchParams.get("limit") || "50", 10) || 50,
          100
        );

        const result = await getMessages(roomCode, {
          after: url.searchParams.get("after") || undefined,
          before: url.searchParams.get("before")
            ? parseInt(url.searchParams.get("before")!, 10)
            : undefined,
          limit,
        });

        return json(result);
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (err: any) {
    console.error("API error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
