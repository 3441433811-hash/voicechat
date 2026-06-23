import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  FocusLayout,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import {
  getLiveKitToken,
  getMessages,
  sendMessage,
  type ChatMessage,
} from "../lib/api";
import { addRecentRoom, getSessionId } from "../lib/session";
import { notifyRoomJoined, listenForDuplicate } from "../lib/roomChannel";
import Toolbar from "../components/Toolbar";
import ChatPanel from "../components/chat/ChatPanel";
import MemberListPanel from "../components/members/MemberListPanel";

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as
    | { nickname?: string; roomName?: string }
    | undefined;

  const [token, setToken] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [memberListOpen, setMemberListOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const publishRef = useRef<(msg: ChatMessage) => void>(() => {});
  const sessionId = getSessionId();

  // Mute/unmute all <audio> elements when speakerOn changes.
  // RoomAudioRenderer creates audio elements dynamically — we control them
  // at the DOM level because LiveKit SDK manages them internally.
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;

    const muteAll = () => {
      container.querySelectorAll<HTMLAudioElement>("audio").forEach((a) => {
        a.muted = !speakerOn;
      });
    };

    muteAll();

    // Watch for dynamically added audio elements
    const observer = new MutationObserver(muteAll);
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [speakerOn]);

  useEffect(() => {
    if (!state?.nickname || !code) {
      navigate("/");
      return;
    }

    // Cross-tab duplicate detection: if another tab joins this same room,
    // this tab leaves to prevent echo.
    const cleanup = listenForDuplicate(code, () => {
      navigate("/");
    });

    (async () => {
      try {
        const result = await getLiveKitToken(code, state.nickname!);
        setToken(result.token);
        setLivekitUrl(result.livekitUrl);

        // Notify other tabs that we joined this room
        notifyRoomJoined(code);

        // Save to recent rooms
        addRecentRoom({
          code: result.roomCode,
          name: result.roomName2,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setConnecting(false);
      }
    })();

    return cleanup;
  }, [code, state?.nickname]);

  // ── Chat: initial message load ──
  useEffect(() => {
    if (!token || !code) return;

    (async () => {
      setMessagesLoading(true);
      try {
        const result = await getMessages(code);
        setMessages(result.messages);
        setHasMoreMessages(result.hasMore);
        if (result.messages.length > 0) {
          lastMessageIdRef.current =
            result.messages[result.messages.length - 1].id;
        }
      } catch {
        // Silently ignore — chat messages are delivered via Data Channel
      } finally {
        setMessagesLoading(false);
      }
    })();
  }, [token, code]);

  // ── Chat: handle incoming Data Channel messages ──
  const handleDataMessage = useCallback(
    (msg: ChatMessage) => {
      // Ensure message belongs to this room
      if (msg.room_code.toUpperCase() !== code?.toUpperCase()) return;

      setMessages((prev) => {
        // Avoid duplicates (race with HTTP or replay)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      lastMessageIdRef.current = msg.id;

      // Track unread when chat is closed
      setChatOpen((open) => {
        if (!open) setUnreadCount((c) => c + 1);
        return open;
      });
    },
    [code]
  );

  // Reset unread when opening chat
  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  // ── Chat actions ──

  const handleSend = useCallback(
    async (content: string) => {
      if (!code) return;
      try {
        const msg = await sendMessage(code, sessionId, state?.nickname ?? "", content);
        setMessages((prev) => [...prev, msg]);
        lastMessageIdRef.current = msg.id;
        // Broadcast to other participants via LiveKit Data Channel (real-time)
        publishRef.current(msg);
      } catch {
        // Silently ignore
      }
    },
    [code, sessionId, state?.nickname]
  );

  const handleLoadOlder = useCallback(async () => {
    if (!code || messages.length === 0 || messagesLoading) return;
    try {
      const oldest = messages[0];
      const result = await getMessages(code, {
        before: oldest.created_at,
      });
      if (result.messages.length > 0) {
        setMessages((prev) => [...result.messages, ...prev]);
      }
      setHasMoreMessages(result.hasMore);
    } catch {
      // Silently ignore
    }
  }, [code, messages, messagesLoading]);

  const handleLeave = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (error) {
    return (
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <p style={{ color: "var(--danger)", fontSize: 16 }}>{error}</p>
        <button className="btn btn-ghost" onClick={() => navigate("/")}>
          ← 返回首页
        </button>
      </div>
    );
  }

  if (connecting || !token) {
    return (
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        正在连接...
      </div>
    );
  }

  return (
    <div
      ref={mainRef}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>
            {state?.roomName || "房间"}
          </h2>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "monospace",
            }}
          >
            房间号: {code}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="btn btn-ghost"
            style={{ padding: "6px 12px", fontSize: 13 }}
            onClick={() => setMemberListOpen((v) => !v)}
          >
            👥 成员
          </button>
          <button
            className="btn btn-ghost chat-toggle-btn"
            style={{ padding: "6px 12px", fontSize: 13 }}
            onClick={() => setChatOpen((v) => !v)}
          >
            💬 聊天
            {!chatOpen && unreadCount > 0 && (
              <span className="chat-toggle-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main area — voice + chat split */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect={true}
          audio={true}
          video={true}
          onDisconnected={handleLeave}
          style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0 }}
        >
          <ChatSync
            onMessage={handleDataMessage}
            onPublish={(pub) => { publishRef.current = pub; }}
          />
          <RoomAudioRenderer />

          {/* Voice area */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 20,
              minWidth: 0,
            }}
          >
            <ParticipantGrid />
          </div>

          {/* Member list panel */}
          {memberListOpen && <MemberListPanel />}

          <Toolbar
            onLeave={handleLeave}
            speakerOn={speakerOn}
            onToggleSpeaker={() => setSpeakerOn((v) => !v)}
          />
        </LiveKitRoom>

        {/* Chat panel */}
        {chatOpen && (
          <ChatPanel
            messages={messages}
            loading={messagesLoading}
            hasMore={hasMoreMessages}
            onSend={handleSend}
            onLoadOlder={handleLoadOlder}
          />
        )}
      </div>
    </div>
  );
}

function ChatSync({
  onMessage,
  onPublish,
}: {
  onMessage: (msg: ChatMessage) => void;
  onPublish: (publish: (msg: ChatMessage) => void) => void;
}) {
  const room = useRoomContext();

  // Register the publish callback so the parent can broadcast
  useEffect(() => {
    onPublish((msg: ChatMessage) => {
      const encoded = new TextEncoder().encode(JSON.stringify(msg));
      room.localParticipant.publishData(encoded, { reliable: true });
    });
  }, [room, onPublish]);

  // Listen for incoming data messages from other participants
  useEffect(() => {
    const handler = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as ChatMessage;
        onMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };
    room.on("dataReceived", handler);
    return () => {
      room.off("dataReceived", handler);
    };
  }, [room, onMessage]);

  return null;
}

function ParticipantGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Microphone, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenTracks = tracks.filter(
    (t) => t.source === Track.Source.ScreenShare
  );
  const micTracks = tracks.filter(
    (t) => t.source === Track.Source.Microphone
  );
  const hasScreenShare = screenTracks.length > 0;

  return (
    <div
      style={{
        height: "calc(100% - 80px)",
        display: "flex",
        flexDirection: "column",
        padding: 8,
        gap: 8,
      }}
    >
      {/* Screen share area — FocusLayout avoids the ParticipantTile flex-column height bug */}
      {hasScreenShare ? (
        <div className="screen-share-area" style={{ flex: 1, minHeight: 0 }}>
          {screenTracks.map((track) => (
            <FocusLayout
              key={track.publication?.trackSid}
              trackRef={track}
            />
          ))}
        </div>
      ) : (
        <div
          className="screen-share-area screen-share-area--empty"
          style={{ flexShrink: 0 }}
        >
          <span className="screen-share-area__empty-text">
            点击底部 🖥️ 共享你的屏幕
          </span>
        </div>
      )}

      {/* Voice participants */}
      <div style={{ flexShrink: 0 }}>
        <GridLayout tracks={micTracks} style={{ gap: 12 }}>
          <ParticipantTile />
        </GridLayout>
      </div>
    </div>
  );
}
