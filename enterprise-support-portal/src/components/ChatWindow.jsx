import { useEffect, useRef, memo } from 'react';
import ChatMessage from './ChatMessage';
import { Bot, Zap, Shield, Clock } from 'lucide-react';

const WELCOME_FEATURES = [
  { icon: Zap, title: 'Instant', desc: 'Real-time answers' },
  { icon: Shield, title: 'Secure', desc: '100% local operation' },
  { icon: Clock, title: '24/7', desc: 'Always available' },
];

export default function ChatWindow({ messages, isStreaming }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  const isEmpty = messages.length === 0;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 20px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div 
        style={{ 
          width: '100%', 
          maxWidth: '800px', 
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          paddingTop: '32px',
          paddingBottom: '160px' // Space for floating input
        }}
      >
        {isEmpty ? (
          <WelcomeScreen />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {isStreaming && messages[messages.length - 1]?.content && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '52px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    background: 'var(--text-muted)',
                    borderRadius: '50%',
                    animation: 'pulse-glow 1.5s infinite',
                  }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 300, letterSpacing: '0.02em' }}>Generating...</span>
              </div>
            )}

            <div ref={bottomRef} style={{ height: '1px' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// Memoized: WelcomeScreen has no props and never needs to re-render after
// the first message arrives, so memo() makes it completely skip-able.
const WelcomeScreen = memo(function WelcomeScreen() {
  return (
    <div
      className="animate-fade-in"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '40px',
        opacity: 0.9,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'var(--bg-glass-medium)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-heavy)',
          }}
        >
          <Bot size={32} color="var(--text-primary)" strokeWidth={1} />
        </div>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '0.01em', marginBottom: '8px' }}>
            How can I help you today?
          </h2>
          <p style={{ fontSize: '15px', fontWeight: 300, color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6, letterSpacing: '0.01em' }}>
            Enterprise AI powered by Ollama. Ask about orders, policies, or technical support.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {WELCOME_FEATURES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            style={{
              background: 'var(--bg-glass-medium)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: '200px',
              boxShadow: 'var(--shadow-glass)'
            }}
          >
            <Icon size={20} color="var(--text-primary)" strokeWidth={1.5} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{title}</p>
              <p style={{ fontSize: '12px', fontWeight: 300, color: 'var(--text-secondary)' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
