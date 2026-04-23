/**
 * useChat.js
 * Custom hook that manages conversation state, online/offline routing,
 * and Fuse.js-powered local knowledge base fallback.
 *
 * Dependencies (install if not present):
 *   npm install fuse.js
 */
import { useState, useCallback, useRef, startTransition } from 'react';
import Fuse from 'fuse.js';
import { sendChatMessage } from '../utils/ollamaApi';

// ---------------------------------------------------------------------------
// Fuse.js configuration — adjust weights to tune offline search accuracy
// ---------------------------------------------------------------------------
const FUSE_OPTIONS = {
  // Fields in offline_graph.json to search across
  keys: [
    { name: 'symptoms',    weight: 0.5 },
    { name: 'error_code',  weight: 0.3 },
    { name: 'resolution',  weight: 0.2 },
  ],
  threshold: 0.45,        // 0.0 = exact, 1.0 = match anything; 0.45 is fairly permissive
  includeScore: true,     // lets us inspect match quality
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

  // Best match
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
// useChat hook
// ---------------------------------------------------------------------------
export function useChat() {
  const [messages, setMessages]     = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError]           = useState(null);
  const abortRef                    = useRef(null);
  // Ref mirror of isStreaming — lets sendMessage read the live value
  // without adding isStreaming to its useCallback dep array (which would
  // cause every child to re-subscribe on every token received).
  const isStreamingRef              = useRef(false);

  const sendMessage = useCallback(async (userText) => {
    // Read live value from ref — no stale closure, no dep on isStreaming
    if (!userText.trim() || isStreamingRef.current) return;

    setError(null);

    const userMsg = { id: Date.now(),     role: 'user',      content: userText };
    const assistantMsg = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    // Batch the two state writes into a single commit so React only
    // schedules one re-render for the "message added" transition.
    startTransition(() => {
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      isStreamingRef.current = true;
    });

    // ------------------------------------------------------------------
    // OFFLINE DETECTION — intercept before any network call
    // ------------------------------------------------------------------
    if (!navigator.onLine) {
      console.warn('📴 Navigator reports offline — routing to local knowledge base.');
      try {
        const offlineReply = await searchOfflineKnowledgeBase(userText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: offlineReply, isOffline: true } : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: '[OFFLINE MODE] ⚠️ Unexpected error during offline lookup.', isError: true }
              : m
          )
        );
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, isStreaming: false } : m))
        );
        setIsStreaming(false);
        isStreamingRef.current = false;
      }
      return; // bail out — do not attempt live API call
    }

    // ------------------------------------------------------------------
    // ONLINE PATH — normal backend call
    // ------------------------------------------------------------------
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const responseText = await sendChatMessage(userText, controller.signal);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: responseText } : m
        )
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errMsg = err.message.includes('fetch')
          ? '⚠️ Could not reach backend. Make sure it is running on http://127.0.0.1:8000.'
          : `⚠️ ${err.message}`;
        setError(errMsg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: errMsg, isError: true } : m
          )
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
        )
      );
      setIsStreaming(false);
      isStreamingRef.current = false;
      abortRef.current = null;
    }
  // No dep on `messages` (all updates use functional form) or `isStreaming`
  // (read via ref). This means sendMessage is created exactly ONCE for the
  // lifetime of the hook, preventing unnecessary child re-renders.
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages };
}
