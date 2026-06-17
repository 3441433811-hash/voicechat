# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A web-based voice chat platform. No accounts — users enter a nickname, create or join a **room** by 6-character room code. Everyone is equal (no admin/roles). Voice chat is powered by LiveKit SFU. MVP scope only: no text chat, no screen sharing, no admin.

## Repo structure

```
voice-chat/
├── server/                Fastify API server (TypeScript, port 3001)
│   └── src/
│       ├── index.ts       Entry point — inits SQLite, registers routes
│       ├── routes.ts      3 REST endpoints for rooms and LiveKit tokens
│       └── db.ts          sql.js (WASM SQLite) — initDb, dbRun, dbGet, dbAll. One table: rooms.
├── frontend/              React 19 + Vite SPA (TypeScript, port 5173)
│   └── src/
│       ├── App.tsx               Route definitions (/, /prejoin/:code, /room/:code)
│       ├── pages/
│       │   ├── Home.tsx          Create room / join by room code, nickname entry
│       │   ├── PreJoin.tsx       Nickname + microphone permission/preview before joining
│       │   └── Room.tsx          LiveKitRoom — participant grid with speaking indicators, toolbar
│       ├── components/
│       │   └── Toolbar.tsx       Mute toggle + leave button
│       └── lib/
│           ├── api.ts        Typed fetch wrappers for 3 API endpoints
│           └── session.ts    localStorage helpers — sessionId (UUID), recent rooms
├── docker-compose.yml   4 services: caddy, server, livekit, redis
├── livekit.yaml         LiveKit SFU config (API keys, UDP port range)
└── Caddyfile            Reverse proxy
```

## Architecture

### Connection flow
- **Browser** → `/api/*` → Vite dev proxy (dev) or Caddy (prod) → Fastify `server:3001`
- **Browser** → LiveKit media/SFU → `wss://*.livekit.cloud` (SFU signaling + WebRTC media)

### Identity
- No user registration. Each browser tab gets a `sessionId` (crypto.randomUUID → localStorage).
- No roles — everyone has equal permissions in the room.
- **LiveKit JWT**: token endpoint signs a short-lived (10 min TTL) LiveKit JWT with `roomJoin`, `canPublish`, `canSubscribe` grants. Room name = 6-char room code. Identity = `{nickname}#{random6}` for uniqueness.

### Database (sql.js WASM SQLite)
One table:
- `rooms` — code (TEXT PK, 6-char), name (TEXT), created_at (INTEGER)

Persistence: `dbRun` auto-saves by exporting the full WASM buffer to disk after each write. Suitable for low-write workloads only.

## API endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/api/rooms` | `{ name }` | `{ code, name, shareUrl }` |
| `GET` | `/api/rooms/:code` | — | `{ exists, code, name, created_at }` |
| `POST` | `/api/token` | `{ code, nickname }` | `{ token, livekitUrl, roomName, roomCode, roomName2 }` |

## Commands

```bash
# Server (from server/)
npm run dev          # tsx watch → http://localhost:3001

# Frontend (from frontend/)
npm run dev          # vite → http://localhost:5173 (proxies /api to :3001)

# LiveKit Cloud (recommended, no Docker needed)
# 1. Create project at cloud.livekit.io → get Key/Secret/URL
# 2. Write to server/.env
# 3. Start server + frontend
```

## Environment variables

Server loads vars via dotenv from `server/.env`:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=your-secret-here
```

| Variable | Default | Used by |
|----------|---------|---------|
| `PORT` | `3001` | server |
| `LIVEKIT_URL` | `ws://localhost:7880` | server → included in token response |
| `LIVEKIT_API_KEY` | `devkey` | server → LiveKit JWT signing |
| `LIVEKIT_API_SECRET` | `secret` | server → LiveKit JWT signing |
| `BASE_URL` | `http://localhost:5173` | server → share URL generation |
| `DB_PATH` | `server/data.db` | server → SQLite file location |

## Key constraints

- **sql.js** (WASM) is used instead of better-sqlite3 — no native build tools needed on Windows. Full buffer export on every write.
- **No rooms table migration** — the DB is fresh on first run. Delete `data.db` to reset.
- **Nickname uniqueness**: identity appended with `#` + random 6-char suffix to avoid LiveKit participant identity conflicts.
- **Vite dev proxy** forwards `/api/*` to `localhost:3001`.
- **MVP scope**: voice only. Text chat, screen sharing, admin roles are deferred to later phases.
