import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Square } from 'lucide-react';

const SUGGESTIONS = [
  "How do I reset my password?",
  "Tell me about your enterprise API.",
  "What is the system status?",
];

export default function ChatInput({ onSend, onStop, isStreaming, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Stable submit handler — only recreated if onSend/isStreaming identity changes.
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (text.trim() && !isStreaming) {
      onSend(text.trim());
      setText('');
    }
  }, [text, isStreaming, onSend]);

  // Single stable handler for ALL suggestion chips.
  // Reads which suggestion was clicked via the data-suggestion attribute
  // so we don't create a new arrow function per chip per render.
  const handleSuggestionClick = useCallback((e) => {
    const suggestion = e.currentTarget.dataset.suggestion;
    if (suggestion) onSend(suggestion);
  }, [onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
      <div 
        className="animate-fade-in-up" 
        style={{ 
          marginBottom: '16px', 
          display: 'flex', 
          gap: '8px', 
          flexWrap: 'wrap', 
          justifyContent: 'center' 
        }}
      >
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            data-suggestion={suggestion}
            onClick={handleSuggestionClick}
            disabled={disabled || isStreaming}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'var(--bg-glass-heavy)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 400,
              cursor: (disabled || isStreaming) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: (disabled || isStreaming) ? 0.5 : 1,
              letterSpacing: '0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !isStreaming) {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.background = 'var(--bg-glass-medium)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && !isStreaming) {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-medium)';
                e.currentTarget.style.background = 'var(--bg-glass-heavy)';
              }
            }}
          >
            <Sparkles size={12} strokeWidth={1.5} />
            {suggestion}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          background: 'var(--bg-glass-heavy)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid',
          borderColor: isFocused ? 'var(--text-muted)' : 'var(--border-medium)',
          borderRadius: '24px',
          padding: '12px 16px',
          boxShadow: isFocused ? '0 0 0 1px var(--text-muted), var(--shadow-heavy)' : 'var(--shadow-glass)',
          transition: 'all 0.2s',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask me anything..."
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            maxHeight: '120px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '15px',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            padding: '4px 8px',
            fontFamily: 'inherit',
            fontWeight: 300,
            letterSpacing: '0.02em',
          }}
          className="placeholder-opacity"
        />

        <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#ef4444',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              title="Stop generating"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim() || disabled}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: text.trim() ? 'var(--text-primary)' : 'var(--bg-glass-light)',
                border: '1px solid var(--border-light)',
                color: text.trim() ? 'var(--bg-app)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: text.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              <Send size={16} strokeWidth={2} style={{ marginLeft: '2px' }} />
            </button>
          )}
        </div>
      </form>

      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 300, letterSpacing: '0.03em' }}>
          AI models can make mistakes. Verify important information securely.
        </span>
      </div>
    </div>
  );
}
