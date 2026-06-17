# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A web-based voice chat platform. No accounts — users enter a nickname, create or join a **room** by 6-character room code. Everyone is equal (no admin/roles). Voice chat via LiveKit SFU (Cloud-hosted, no self-hosted SFU needed for dev).

**MVP scope (current):** voice only — no text chat, no screen sharing, no admin roles. Those are deferred to later phases.

## Repo structure

```
voice-chat/
├── server/                Fastify API server (TypeScript, port 3001)
│   └── src/
│       ├── index.ts       Entry point — inits SQLite, registers routes
│       ├── routes.ts      3 REST endpoints (rooms CRUD + LiveKit token signing)
│       └── db.ts          sql.js (WASM SQLite) — initDb, dbRun, dbGet, dbAll
├── frontend/              React 19 + Vite SPA (TypeScript, port 5173)
│   └── src/
│       ├── App.tsx               Routes: / → Home, /prejoin/:code → PreJoin, /room/:code → Room
│       ├── pages/
│       │   ├── Home.tsx          Create room or join by room code; nickname entry; recent rooms
│       │   ├── PreJoin.tsx       Nickname input + microphone permission & test before entering
│       │   └── Room.tsx          LiveKitRoom — token fetch, participant grid, speaker mute, toolbar
│       ├── components/
│       │   └── Toolbar.tsx       Mic toggle (LiveKit TrackToggle) + speaker toggle + leave button
│       └── lib/
│           ├── api.ts            Typed fetch for 3 endpoints (createRoom, checkRoom, getLiveKitToken)
│           ├── session.ts        localStorage: sessionId (UUID), recent rooms (max 10)
│           └── roomChannel.ts    BroadcastChannel — prevents same-room multi-tab echo
├── docker-compose.yml      Caddy + server + livekit + redis (self-hosted, not needed for Cloud dev)
├── livekit.yaml            LiveKit SFU config (only for self-hosted Docker mode)
└── Caddyfile               Reverse proxy (prod only)
```

## Commands

```bash
# Start backend (from voice-chat/server/)
npm run dev          # tsx watch → http://localhost:3001

# Start frontend (from voice-chat/frontend/)
npm run dev          # vite → http://localhost:5173 (proxies /api → :3001)

# TypeScript check (no emit)
cd server && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

## Environment variables

Server loads from `server/.env` (dotenv):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `LIVEKIT_URL` | **Yes** | `ws://localhost:7880` | LiveKit Cloud URL (wss://...livekit.cloud) |
| `LIVEKIT_API_KEY` | **Yes** | `devkey` | LiveKit API key |
| `LIVEKIT_API_SECRET` | **Yes** | `secret` | LiveKit API secret |
| `PORT` | No | `3001` | Server port |
| `BASE_URL` | No | `http://localhost:5173` | Used in share URL generation |
| `DB_PATH` | No | `server/data.db` | SQLite file path |

## API endpoints

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| `POST` | `/api/rooms` | `{ name }` | `{ code, name, shareUrl }` | Room code: 6-char, charset `A-Z,2-9` (no 0/O/I/L) |
| `GET` | `/api/rooms/:code` | — | `{ exists, code, name, created_at }` | Case-insensitive. Returns 404 with `exists: false` if not found |
| `POST` | `/api/token` | `{ code, nickname }` | `{ token, livekitUrl, roomName, roomCode, roomName2 }` | Verifies room exists before signing. `roomName2` = room display name |

## Database (sql.js WASM SQLite)

One table — `rooms`:

| Column | Type | Notes |
|--------|------|-------|
| `code` | TEXT PK | 6-char room code, uppercase |
| `name` | TEXT NOT NULL | Room display name (2-32 chars) |
| `created_at` | INTEGER | Unix timestamp |

Persistence: **every `dbRun()` call exports the full WASM buffer to disk**. This is fine for low-write workloads but would not scale to high concurrency. Delete `data.db` to reset the database.

## Key architecture details

### Room entry flow & React Router state

When navigating to `/room/:code`, **`location.state` must carry `{ nickname, roomName }`**. The Home page and PreJoin page both pass this via React Router `navigate(path, { state })`. If `state.nickname` is missing (e.g. page refresh), the Room page redirects to `/`. There is no fallback to sessionStorage — state is React Router's in-memory state only.

### LiveKit JWT signing

- Identity format: `{nickname}#{random6}` — the random suffix prevents participant identity collisions when users pick the same nickname
- Room name = 6-char room code directly (no prefix)
- Grants: `roomJoin`, `canPublish`, `canSubscribe` only (no `canPublishData` — text chat is deferred)
- TTL: 10 minutes (only used to establish connection; LiveKit maintains the session after)
- `livekitUrl` returned to client: the `wss://` LiveKit Cloud URL; browser connects directly to LiveKit for media

### Speaker mute mechanism

The speaker toggle uses **DOM-level audio element muting**, not React conditional rendering. `RoomAudioRenderer` is always mounted. A `useEffect` with `MutationObserver` watches for dynamically-added `<audio>` elements and sets `audio.muted = true/false` based on `speakerOn` state. This is necessary because LiveKit SDK manages audio elements internally — unmounting the React wrapper does NOT stop audio playback.

### BroadcastChannel tab deduplication

`roomChannel.ts` prevents the same user from having two tabs in the same room (which causes acoustic echo since AEC can't cancel audio from another tab). Each tab has a unique `TAB_ID` (`crypto.randomUUID()`, generated at module load). On entering a room, the tab broadcasts `new-tab-joined` on a `BroadcastChannel`. The listener in any existing tab receives it, checks `tabId !== TAB_ID`, and navigates away. Messages from the same tab are ignored (they would self-receive if two BroadcastChannel instances exist in the same tab).

### Microphone constraints (echo cancellation)

PreJoin requests `getUserMedia` with explicit constraints:
```
{ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
```
This enables browser-level AEC. Without these, Chrome defaults may vary.

### Dependencies to know

- `@livekit/components-react` + `@livekit/components-styles` — both must be installed; styles are a separate npm package
- `livekit-client` — the underlying LiveKit SDK
- `nanoid` — used server-side for identity suffixes
- `bcryptjs` — **no longer used** (was for admin passwords; removed in MVP simplification)

### No TypeScript build for dev

- Server: `tsx watch` runs TypeScript directly (no `tsc` step)
- Frontend: Vite handles TypeScript transpilation on the fly
- `npm run build` in server is `tsc` → `dist/` (only needed for production/Docker)

## Known quirks & pitfalls

1. **React Router state lost on refresh** — users who refresh `/room/:code` get redirected to `/`. This is intentional: they must go through PreJoin again to re-enter their nickname and re-authorize the microphone.
2. **sql.js buffer export on every write** — if two writes happen in rapid succession, the second export could race with the first. Not an issue at current low volumes.
3. **`roomName2` field** — the token endpoint returns both `roomName` (LiveKit room = code) and `roomName2` (human-readable name). The naming is awkward but frontend relies on it.
4. **Caddyfile & docker-compose.yml** exist but are for self-hosted LiveKit deployments only. Cloud development does not use them.
5. **`talkroom/` directory** — frozen V1 implementation (WebRTC Mesh + Next.js), not maintained. Do not modify.
