/**
 * useChat.js
 * Custom hook that manages conversation state, online/offline routing,
 * and Fuse.js-powered local knowledge base fallback.
 *
 * ARCHITECTURE NOTE (session persistence refactor):
 *   `messages` are no longer owned here. The hook receives:
 *     - activeSessionId  → which session is active
 *     - allMessages      → the full { [sessionId]: Message[] } map (owned by App)
 *     - setAllMessages   → updater for that map
 *   This makes switching sessions instant and loss-free.
 *
 * Dependencies:
 *   npm install fuse.js
 */
import { useState, useCallback, useRef, startTransition } from 'react';
import Fuse from 'fuse.js';
import { sendChatMessage } from '../utils/ollamaApi';

// ---------------------------------------------------------------------------
// Fuse.js configuration — adjust weights to tune offline search accuracy
// ---------------------------------------------------------------------------
const FUSE_OPTIONS = {
  keys: [
    { name: 'symptoms',   weight: 0.5 },
    { name: 'error_code', weight: 0.3 },
    { name: 'resolution', weight: 0.2 },
  ],
  threshold: 0.45,
  includeScore: true,
  minMatchCharLength: 3,
};

// ---------------------------------------------------------------------------
// Offline helper — fetches local JSON, runs Fuse search, returns a string
// ---------------------------------------------------------------------------
async function searchOfflineKnowledgeBase(userMessage) {
  let knowledgeBase;
  try {
    const res = await fetch('/offline_graph.json');
    if (!res.ok) throw new Error('offline_graph.json not found');
    knowledgeBase = await res.json();
  } catch {
    return '[OFFLINE MODE] ⚠️ Could not load the local knowledge base. Please reconnect to get live support.';
  }

  const fuse = new Fuse(knowledgeBase, FUSE_OPTIONS);
  const results = fuse.search(userMessage);

  if (results.length === 0) {
    return (
      '[OFFLINE MODE] 🔌 No internet connection. Your query did not match any stored enterprise issue. ' +
      'Please reconnect and try again, or contact the IT Helpdesk directly.'
    );
  }

  const best = results[0].item;
  return (
    `[OFFLINE MODE] 📴 Here is a cached resolution for a similar issue:\n\n` +
    `**Error Code:** ${best.error_code}\n` +
    `**Symptoms:** ${best.symptoms}\n\n` +
    `**Resolution:**\n${best.resolution}\n\n` +
    `_This answer is from the local knowledge cache. Reconnect for live, personalised support._`
  );
}

// ---------------------------------------------------------------------------
// Internal helper: update a single session's message array inside the map
// ---------------------------------------------------------------------------
function updateSession(setAllMessages, sessionId, updater) {
  setAllMessages((prev) => ({
    ...prev,
    [sessionId]: updater(prev[sessionId] ?? []),
  }));
}

// ---------------------------------------------------------------------------
// useChat hook
// ---------------------------------------------------------------------------
export function useChat({ activeSessionId, allMessages, setAllMessages }) {
  const [isStreaming, setIsStreaming]   = useState(false);
  const [error, setError]              = useState(null);
  const abortRef                       = useRef(null);
  // Ref mirror of isStreaming to avoid stale closures inside sendMessage
  const isStreamingRef                 = useRef(false);

  // Derive the current session's messages from the shared map
  const messages = allMessages[activeSessionId] ?? [];

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || isStreamingRef.current || !activeSessionId) return;

    setError(null);

    const userMsg      = { id: Date.now(),     role: 'user',      content: userText };
    const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: '', isStreaming: true };

    // Optimistically append both messages in one transition
    startTransition(() => {
      updateSession(setAllMessages, activeSessionId, (prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      isStreamingRef.current = true;
    });

    // ------------------------------------------------------------------
    // OFFLINE PATH
    // ------------------------------------------------------------------
    if (!navigator.onLine) {
      console.warn('📴 Navigator reports offline — routing to local knowledge base.');
      try {
        const offlineReply = await searchOfflineKnowledgeBase(userText);
        updateSession(setAllMessages, activeSessionId, (prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: offlineReply, isOffline: true } : m
          )
        );
      } catch {
        updateSession(setAllMessages, activeSessionId, (prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: '[OFFLINE MODE] ⚠️ Unexpected error during offline lookup.', isError: true }
              : m
          )
        );
      } finally {
        updateSession(setAllMessages, activeSessionId, (prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, isStreaming: false } : m))
        );
        setIsStreaming(false);
        isStreamingRef.current = false;
      }
      return;
    }

    // ------------------------------------------------------------------
    // ONLINE PATH
    // ------------------------------------------------------------------
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const responseText = await sendChatMessage(userText, activeSessionId, controller.signal);
      updateSession(setAllMessages, activeSessionId, (prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: responseText } : m
        )
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errMsg = err.message.includes('fetch')
          ? `⚠️ Could not reach the GraphSentinel backend. Please try again in a moment.`
          : `⚠️ ${err.message}`;
        setError(errMsg);
        updateSession(setAllMessages, activeSessionId, (prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: errMsg, isError: true } : m
          )
        );
      }
    } finally {
      updateSession(setAllMessages, activeSessionId, (prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
        )
      );
      setIsStreaming(false);
      isStreamingRef.current = false;
      abortRef.current = null;
    }
  // activeSessionId + setAllMessages are stable refs; safe as deps
  }, [activeSessionId, setAllMessages]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    if (activeSessionId) {
      updateSession(setAllMessages, activeSessionId, () => []);
    }
    setError(null);
  }, [activeSessionId, setAllMessages]);

  return { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages };
}
