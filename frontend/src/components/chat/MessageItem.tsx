import type { ChatMessage } from "../../lib/api";

interface MessageItemProps {
  message: ChatMessage;
  showHeader: boolean;
}

/** Hash a sessionId string to a hue value (0-360) for avatar color. */
function sessionHue(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** Extract the first display character from a nickname. */
function avatarChar(nickname: string): string {
  // Prefer first CJK character or first alphanumeric
  return nickname.charAt(0).toUpperCase();
}

export default function MessageItem({ message, showHeader }: MessageItemProps) {
  const hue = sessionHue(message.sender_session_id);
  const time = new Date(message.created_at * 1000).toLocaleTimeString(
    "zh-CN",
    { hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div className={`chat-message ${!showHeader ? "chat-message--coalesced" : ""}`}>
      {showHeader ? (
        <div className="chat-message__header">
          <div
            className="chat-avatar"
            style={{ background: `hsl(${hue}, 55%, 45%)` }}
          >
            {avatarChar(message.sender_nickname)}
          </div>
          <span className="chat-message__nickname">
            {message.sender_nickname}
          </span>
          <span className="chat-message__time">{time}</span>
        </div>
      ) : (
        <span className="chat-message__time chat-message__time--hover">{time}</span>
      )}
      <div className="chat-message__content">{message.content}</div>
    </div>
  );
}
