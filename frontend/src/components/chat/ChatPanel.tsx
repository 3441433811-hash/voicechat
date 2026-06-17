import type { ChatMessage } from "../../lib/api";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  hasMore: boolean;
  onSend: (content: string) => void;
  onLoadOlder: () => void;
}

export default function ChatPanel({
  messages,
  loading,
  hasMore,
  onSend,
  onLoadOlder,
}: ChatPanelProps) {
  return (
    <div className="chat-panel">
      <div className="chat-panel__header">聊天</div>
      <MessageList
        messages={messages}
        loading={loading}
        hasMore={hasMore}
        onLoadOlder={onLoadOlder}
      />
      <MessageInput onSend={onSend} />
    </div>
  );
}
