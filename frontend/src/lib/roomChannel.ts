// Cross-tab communication: ensure only one tab per room on the same device.
// When a new tab joins, it broadcasts — the existing tab hears it and leaves.

const CHANNEL_PREFIX = "room_v1_";

// Unique ID for this tab, so we can ignore our own broadcasts
const TAB_ID = crypto.randomUUID();

export function notifyRoomJoined(roomCode: string) {
  const bc = new BroadcastChannel(CHANNEL_PREFIX + roomCode);
  bc.postMessage({ type: "new-tab-joined", tabId: TAB_ID, timestamp: Date.now() });
  bc.close();
}

export function listenForDuplicate(roomCode: string, onDuplicate: () => void) {
  const bc = new BroadcastChannel(CHANNEL_PREFIX + roomCode);

  bc.onmessage = (event) => {
    if (event.data?.type === "new-tab-joined" && event.data?.tabId !== TAB_ID) {
      onDuplicate();
    }
  };

  return () => bc.close();
}
