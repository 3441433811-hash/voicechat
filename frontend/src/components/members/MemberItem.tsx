import type { Participant } from "livekit-client";
import { displayName, identityHue } from "./MemberListPanel";

interface MemberItemProps {
  participant: Participant;
  isLocal: boolean;
}

/** Derive the primary status label for a participant */
function getStatus(p: Participant): {
  type: "speaking" | "sharing" | "muted" | "online";
  label?: string;
} {
  if (p.isSpeaking) return { type: "speaking", label: "说话中" };
  if (p.isScreenShareEnabled) return { type: "sharing", label: "📺 共享中" };
  if (!p.isMicrophoneEnabled) return { type: "muted" };
  return { type: "online" };
}

function avatarChar(name: string): string {
  return name.charAt(0).toUpperCase();
}

export default function MemberItem({ participant, isLocal }: MemberItemProps) {
  const name = displayName(participant);
  const hue = identityHue(participant.identity);
  const status = getStatus(participant);

  return (
    <div className="member-item">
      {/* Avatar */}
      <div
        className={`member-item__avatar ${
          status.type === "speaking" ? "member-item__avatar--speaking" : ""
        } ${status.type === "muted" ? "member-item__avatar--muted" : ""}`}
        style={{ background: `hsl(${hue}, 55%, 45%)` }}
      >
        {avatarChar(name)}
      </div>

      {/* Info */}
      <div className="member-item__info">
        <span className="member-item__name">{name}</span>
        {isLocal && <span className="member-item__me">(我)</span>}
      </div>

      {/* Status label */}
      {status.label && (
        <span className={`member-item__status member-item__status--${status.type}`}>
          {status.label}
        </span>
      )}
    </div>
  );
}
