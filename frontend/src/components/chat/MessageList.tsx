import { useEffect, useRef, useCallback, useState } from "react";
import type { ChatMessage } from "../../lib/api";
import MessageItem from "./MessageItem";

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  hasMore: boolean;
  onLoadOlder: () => void;
}

/** Whether to show a header for `msg` (false if same sender within 5 min of previous). */
function shouldShowHeader(
  msg: ChatMessage,
  index: number,
  messages: ChatMessage[]
): boolean {
  if (index === 0) return true;
  const prev = messages[index - 1];
  if (prev.sender_session_id !== msg.sender_session_id) return true;
  if (msg.created_at - prev.created_at > 300) return true;
  return false;
}

export default function MessageList({
  messages,
  loading,
  hasMore,
  onLoadOlder,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [prevScrollTop, setPrevScrollTop] = useState(0);
  const prevLengthRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const isNewMessage = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (isNewMessage && autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Track scroll position to toggle autoScroll
  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const { scrollTop, scrollHeight, clientHeight } = list;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(atBottom);

    // Load older when scrolled to top
    if (scrollTop < 30 && scrollTop < prevScrollTop && hasMore && !loading) {
      onLoadOlder();
    }
    setPrevScrollTop(scrollTop);
  }, [hasMore, loading, onLoadOlder, prevScrollTop]);

  // Empty state
  if (messages.length === 0 && !loading) {
    return (
      <div className="chat-message-list">
        <div className="chat-empty">还没有消息，发送第一条吧！</div>
      </div>
    );
  }

  return (
    <div className="chat-message-list" ref={listRef} onScroll={handleScroll}>
      {loading && (
        <div className="chat-loading">加载中...</div>
      )}
      {messages.map((msg, i) => (
        <MessageItem
          key={msg.id}
          message={msg}
          showHeader={shouldShowHeader(msg, i, messages)}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
