import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { getLiveKitToken } from "../lib/api";
import { addRecentRoom } from "../lib/session";
import { notifyRoomJoined, listenForDuplicate } from "../lib/roomChannel";
import Toolbar from "../components/Toolbar";

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
        <button
          className="btn btn-ghost"
          style={{ padding: "6px 12px", fontSize: 13 }}
          onClick={() => {
            const url = `${window.location.origin}/prejoin/${code}`;
            navigator.clipboard.writeText(url).catch(() => {});
          }}
        >
          📋 复制邀请链接
        </button>
      </div>

      {/* Main area — participant grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 20,
        }}
      >
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={handleLeave}
          style={{ height: "100%" }}
        >
          <RoomAudioRenderer />
          <ParticipantGrid />
          <Toolbar
            onLeave={handleLeave}
            speakerOn={speakerOn}
            onToggleSpeaker={() => setSpeakerOn((v) => !v)}
          />
        </LiveKitRoom>
      </div>
    </div>
  );
}

function ParticipantGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Microphone, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  );

  return (
    <div
      style={{
        height: "calc(100% - 80px)",
        overflow: "auto",
        padding: 8,
      }}
    >
      <GridLayout tracks={tracks} style={{ gap: 12 }}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}
