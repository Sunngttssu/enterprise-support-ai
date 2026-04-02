/**
 * useChat.js
 * Custom hook that manages the full conversation state and Ollama streaming.
 */
import { useState, useCallback, useRef } from 'react';
import { sendChatMessage } from '../utils/ollamaApi';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || isStreaming) return;

    setError(null);

    const userMsg = { id: Date.now(), role: 'user', content: userText };
    const assistantMsg = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const responseText = await sendChatMessage(userText, controller.signal);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: responseText }
            : m
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
      abortRef.current = null;
    }
  }, [messages, isStreaming]);

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
