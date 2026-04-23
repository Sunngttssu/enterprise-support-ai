import { useState, useEffect, useCallback, startTransition } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import RuixenBackground from './components/RuixenBackground';
import { useChat } from './hooks/useChat';
import { checkOllamaHealth } from './utils/ollamaApi';

function loadSessions() {
  try { return JSON.parse(localStorage.getItem('esp_sessions') || '[]'); }
  catch { return []; }
}
function saveSessions(sessions) {
  localStorage.setItem('esp_sessions', JSON.stringify(sessions));
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function App() {
  // Removed forced dark mode so ThemeToggle controls it

  const [isOnline, setIsOnline] = useState(false);
  useEffect(() => {
    const check = async () => setIsOnline(await checkOllamaHealth());
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const [sessions, setSessions] = useState(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages } = useChat();

  useEffect(() => {
    if (!activeSessionId || messages.length === 0) return;
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages,
              title: messages[0]?.content?.slice(0, 38) + (messages[0]?.content?.length > 38 ? '…' : '') || s.title,
            }
          : s
      );
      saveSessions(updated);
      return updated;
    });
  }, [messages, activeSessionId]);

  const handleNewChat = useCallback(() => {
    const id = genId();
    const newSession = { id, title: 'New Conversation', messages: [] };
    setSessions((prev) => {
      const updated = [newSession, ...prev];
      saveSessions(updated);
      return updated;
    });
    setActiveSessionId(id);
    clearMessages();
  }, [clearMessages]);

  const handleSelectSession = useCallback((id) => {
    setActiveSessionId(id);
    clearMessages();
  }, [clearMessages]);

  const handleDeleteSession = useCallback((id) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSessions(updated);
      return updated;
    });
    if (activeSessionId === id) {
      setActiveSessionId(null);
      clearMessages();
    }
  }, [activeSessionId, clearMessages]);

  const handleSend = useCallback((text) => {
    if (!activeSessionId) {
      const id = genId();
      const newSession = { id, title: text.slice(0, 38), messages: [] };
      // Wrap heavy session-creation + localStorage write in startTransition
      // so the click is acknowledged instantly and React treats the
      // session state update as a non-urgent (interruptible) render.
      startTransition(() => {
        setSessions((prev) => {
          const updated = [newSession, ...prev];
          saveSessions(updated);
          return updated;
        });
        setActiveSessionId(id);
      });
    }
    // sendMessage is intentionally outside startTransition — it must
    // run immediately so the network request starts without delay.
    sendMessage(text);
  }, [activeSessionId, sendMessage]);

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
              position: 'relative'
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
