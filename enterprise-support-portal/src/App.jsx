import { useState, useEffect, useCallback, startTransition } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import RuixenBackground from './components/RuixenBackground';
import { useChat } from './hooks/useChat';
import { checkOllamaHealth } from './utils/ollamaApi';

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------
const LS_SESSIONS    = 'esp_sessions';
const LS_ALL_MSGS    = 'esp_all_messages';
const LS_ACTIVE_ID   = 'esp_active_session_id';

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* quota exceeded — fail silently */ }
}

// ---------------------------------------------------------------------------
// Session ID generator
// ---------------------------------------------------------------------------
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  // ── System health ─────────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(false);
  useEffect(() => {
    const check = async () => setIsOnline(await checkOllamaHealth());
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Session list (array of { id, title }) ─────────────────────────────────
  const [sessions, setSessions] = useState(() => loadJSON(LS_SESSIONS, []));

  // ── Messages map: { [sessionId]: Message[] } — the single source of truth ─
  const [allMessages, setAllMessages] = useState(() => loadJSON(LS_ALL_MSGS, {}));

  // ── Active session ────────────────────────────────────────────────────────
  const [activeSessionId, setActiveSessionId] = useState(
    () => loadJSON(LS_ACTIVE_ID, null)
  );

  // ── Persist sessions list whenever it changes ─────────────────────────────
  useEffect(() => { saveJSON(LS_SESSIONS, sessions); }, [sessions]);

  // ── Persist the full message map whenever any session's history changes ───
  useEffect(() => { saveJSON(LS_ALL_MSGS, allMessages); }, [allMessages]);

  // ── Persist the active session so the correct tab is restored on refresh ──
  useEffect(() => { saveJSON(LS_ACTIVE_ID, activeSessionId); }, [activeSessionId]);

  // ── Auto-update sidebar title from first message of each session ──────────
  useEffect(() => {
    if (!activeSessionId) return;
    const msgs = allMessages[activeSessionId];
    if (!msgs || msgs.length === 0) return;

    const firstUserMsg = msgs.find((m) => m.role === 'user');
    if (!firstUserMsg) return;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, title: firstUserMsg.content.slice(0, 38) + (firstUserMsg.content.length > 38 ? '…' : '') }
          : s
      )
    );
  // Only re-run when the active session's message count changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMessages[activeSessionId]?.length, activeSessionId]);

  // ── Plug into useChat, passing the shared map down ────────────────────────
  const { messages, isStreaming, error, sendMessage, stopStreaming } = useChat({
    activeSessionId,
    allMessages,
    setAllMessages,
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    const id = genId();
    const newSession = { id, title: 'New Conversation' };
    startTransition(() => {
      setSessions((prev) => {
        const updated = [newSession, ...prev];
        saveJSON(LS_SESSIONS, updated);
        return updated;
      });
      // Initialise an empty history for this session in the map
      setAllMessages((prev) => ({ ...prev, [id]: [] }));
      setActiveSessionId(id);
      saveJSON(LS_ACTIVE_ID, id);
    });
  }, []);

  /**
   * Switch to a session: just change the active ID.
   * The messages are already cached in allMessages — no clearing needed.
   */
  const handleSelectSession = useCallback((id) => {
    startTransition(() => {
      setActiveSessionId(id);
      saveJSON(LS_ACTIVE_ID, id);
    });
  }, []);

  const handleDeleteSession = useCallback((id) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveJSON(LS_SESSIONS, updated);
      return updated;
    });
    // Remove history for deleted session from the map
    setAllMessages((prev) => {
      const { [id]: _removed, ...rest } = prev;
      saveJSON(LS_ALL_MSGS, rest);
      return rest;
    });
    if (activeSessionId === id) {
      setActiveSessionId(null);
      saveJSON(LS_ACTIVE_ID, null);
    }
  }, [activeSessionId]);

  /**
   * Send a message. Auto-creates a session if none is active.
   */
  const handleSend = useCallback((text) => {
    if (!activeSessionId) {
      const id = genId();
      const newSession = { id, title: text.slice(0, 38) };
      startTransition(() => {
        setSessions((prev) => {
          const updated = [newSession, ...prev];
          saveJSON(LS_SESSIONS, updated);
          return updated;
        });
        setAllMessages((prev) => ({ ...prev, [id]: [] }));
        setActiveSessionId(id);
        saveJSON(LS_ACTIVE_ID, id);
      });
      // sendMessage is outside startTransition — network must start immediately
      sendMessage(text);
    } else {
      sendMessage(text);
    }
  }, [activeSessionId, sendMessage]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <RuixenBackground>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          background: 'transparent',
          color: '#f8fafc',
          overflow: 'hidden',
        }}
      >
        <Header isOnline={isOnline} />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            sessions={sessions}
            activeSession={activeSessionId}
            onNewChat={handleNewChat}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
          />

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            <ChatWindow messages={messages} isStreaming={isStreaming} />

            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: '24px' }}>
              <ChatInput
                onSend={handleSend}
                onStop={stopStreaming}
                isStreaming={isStreaming}
              />
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="animate-fade-in"
            style={{
              position: 'fixed',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(239, 68, 68, 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#fff',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.25)',
              zIndex: 100,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </RuixenBackground>
  );
}
