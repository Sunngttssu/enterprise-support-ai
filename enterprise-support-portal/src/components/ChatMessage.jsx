import { useEffect, useRef, useState } from 'react';
import { Bot, User, Copy, Check } from 'lucide-react';
import TypingIndicator from './TypingIndicator';

function RenderMarkdown({ text }) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={key++} style={{ margin: '16px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
          {lang && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '6px 14px', background: 'var(--bg-glass-heavy)', borderBottom: '1px solid var(--border-light)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
              {lang}
            </div>
          )}
          <pre style={{ background: 'var(--bg-glass-medium)', padding: '16px', overflowX: 'auto', fontSize: '13px', lineHeight: 1.6, fontFamily: 'monospace', color: 'var(--text-primary)', margin: 0 }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      i++; 
      continue;
    }

    elements.push(
      <span key={key++} style={{ display: 'block', minHeight: line.trim() === '' ? '14px' : 'auto' }}>
        {parseInline(line)}
      </span>
    );
    i++;
  }

  return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', letterSpacing: '0.01em' }}>{elements}</div>;
}

function parseInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={idx} style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={idx} style={{ background: 'var(--bg-glass-light)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isStreaming = message.isStreaming && !message.content;
  const showContent = message.content || isStreaming;

  return (
    <div
      className="animate-fade-in-up"
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: '16px',
        width: '100%',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          flexShrink: 0,
          background: isUser ? 'var(--user-gradient)' : 'var(--bg-glass-medium)', 
          backdropFilter: isUser ? 'none' : 'blur(12px)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isUser ? 'var(--shadow-glass)' : 'none',
          marginTop: '4px'
        }}
      >
        {isUser ? <User size={18} color="var(--text-primary)" strokeWidth={1.5} /> : <Bot size={18} color="var(--text-primary)" strokeWidth={1.5} />}
      </div>

      <div
        style={{
          maxWidth: isUser ? '75%' : '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          gap: '8px',
          flex: isUser ? 'none' : 1,
        }}
      >
        <div
          style={{
            padding: isUser ? '12px 18px' : '16px 20px',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px',
            background: isUser ? 'var(--user-gradient)' : 'var(--bg-glass-medium)', 
            backdropFilter: isUser ? 'none' : 'blur(12px)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            boxShadow: isUser ? 'var(--shadow-glass)' : 'var(--shadow-glass)',
            fontSize: '15px',
            lineHeight: 1.6,
            fontWeight: 300,
            width: isUser ? 'auto' : '100%',
            ...(message.isError ? { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' } : {}),
          }}
        >
          {isStreaming ? (
            <TypingIndicator />
          ) : showContent ? (
            <RenderMarkdown text={message.content} />
          ) : null}
        </div>

        {!isUser && message.content && !message.isStreaming && (
          <button
            onClick={handleCopy}
            title="Copy"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '4px',
              transition: 'color 0.2s',
              fontWeight: 400
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {copied ? <Check size={14} /> : <Copy size={14} strokeWidth={1.5} />}
            <span>{copied ? 'Copied' : ''}</span>
          </button>
        )}
      </div>
    </div>
  );
}
