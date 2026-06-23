import { useParticipants, useLocalParticipant } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import MemberItem from "./MemberItem";

/** Parse display name from participant (strip #suffix from identity as fallback) */
export function displayName(p: Participant): string {
  return p.name || p.identity.replace(/#.*$/, "");
}

/** Hash identity to a stable hue (0-360) for avatar color */
export function identityHue(identity: string): number {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = (hash * 31 + identity.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** Sort: speaking > screen share > alphabetical by display name */
function sortMembers(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) => {
    if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
    if (a.isScreenShareEnabled !== b.isScreenShareEnabled)
      return a.isScreenShareEnabled ? -1 : 1;
    return displayName(a).localeCompare(displayName(b), "zh-CN");
  });
}

export default function MemberListPanel() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const sorted = sortMembers(participants);

  return (
    <div className="member-panel">
      <div className="member-panel__header">
        成员 <span className="member-panel__count">({participants.length})</span>
      </div>
      <div className="member-list">
        {sorted.map((p) => (
          <MemberItem
            key={p.identity}
            participant={p}
            isLocal={p.identity === localParticipant.identity}
          />
        ))}
      </div>
    </div>
  );
}
