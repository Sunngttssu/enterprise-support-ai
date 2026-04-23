import { memo } from 'react';
import { Network } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

// memo: Header only re-renders when isOnline flips, not on every
// parent state change (e.g., session updates, typing, messages).
export default memo(function Header({ isOnline }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 28px',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-glass-light)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glass)',
            border: '1px solid var(--border-medium)'
          }}
        >
          <Network size={18} color="var(--text-primary)" strokeWidth={2} />
        </div>
        <h1
          style={{
            fontSize: '17px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
          }}
        >
          GraphSentinel
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: 'var(--bg-glass-light)',
            border: '1px solid var(--border-light)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isOnline ? '#22c55e' : '#ef4444',
              boxShadow: isOnline ? '0 0 12px rgba(34, 197, 94, 0.4)' : 'none',
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 500, color: isOnline ? '#22c55e' : '#ef4444', letterSpacing: '0.02em' }}>
            {isOnline ? 'System Online' : 'System Offline'}
          </span>
        </div>
        
        {/* Toggle Theme specifically requested by user */}
        <ThemeToggle />
      </div>
    </header>
  );
});
