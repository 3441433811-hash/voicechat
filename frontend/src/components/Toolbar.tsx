import { TrackToggle, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";

interface ToolbarProps {
  onLeave: () => void;
  speakerOn: boolean;
  onToggleSpeaker: () => void;
}

export default function Toolbar({ onLeave, speakerOn, onToggleSpeaker }: ToolbarProps) {
  const { localParticipant } = useLocalParticipant();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "16px 24px",
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        zIndex: 100,
      }}
    >
      {/* Mic toggle */}
      <TrackToggle
        source={Track.Source.Microphone}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          border: "none",
          cursor: "pointer",
          background: localParticipant?.isMicrophoneEnabled
            ? "var(--bg-hover)"
            : "var(--danger)",
          color: localParticipant?.isMicrophoneEnabled
            ? "var(--text)"
            : "#fff",
        }}
      >
        {localParticipant?.isMicrophoneEnabled ? "🎤" : "🔇"}
      </TrackToggle>

      {/* Speaker toggle */}
      <button
        onClick={onToggleSpeaker}
        title={speakerOn ? "关闭扬声器" : "打开扬声器"}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          border: "none",
          cursor: "pointer",
          background: speakerOn ? "var(--bg-hover)" : "var(--danger)",
          color: speakerOn ? "var(--text)" : "#fff",
        }}
      >
        {speakerOn ? "🔊" : "🔇"}
      </button>

      {/* Leave button */}
      <button
        onClick={onLeave}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          border: "none",
          cursor: "pointer",
          background: "var(--danger)",
          color: "#fff",
        }}
      >
        ✕
      </button>
    </div>
  );
}
