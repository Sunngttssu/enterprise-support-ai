import { useState } from 'react';
import { MessageSquare, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import GlowingButton from './GlowingButton';

export default function Sidebar({ sessions, activeSession, onNewChat, onSelectSession, onDeleteSession }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        width: collapsed ? '68px' : '280px',
        minWidth: collapsed ? '68px' : '280px',
        borderRight: '1px solid var(--border-light)',
        background: 'var(--bg-glass-light)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1), min-width 0.3s cubic-bezier(0.16,1,0.3,1)',
        position: 'relative',
        zIndex: 30,
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle Sidebar"
        style={{
          position: 'absolute',
          right: '-12px',
          top: '20px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'var(--bg-glass-heavy)',
          border: '1px solid var(--border-medium)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 40,
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div style={{ padding: '24px 16px', display: 'flex', justifyContent: 'center' }}>
        {collapsed ? (
          <button
            onClick={onNewChat}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--accent-gradient)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glass)',
            }}
            title="New Chat"
          >
            <span style={{ fontSize: '20px', lineHeight: 1, fontWeight: 300 }}>+</span>
          </button>
        ) : (
          <div style={{ width: '100%' }}>
            <GlowingButton onClick={onNewChat}>
              <span style={{ fontSize: '16px', fontWeight: 300 }}>+</span> New Session
            </GlowingButton>
          </div>
        )}
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', padding: '0 8px 8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            History
          </p>
          {sessions.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px', fontWeight: 300 }}>No history yet.</p>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSession}
                onSelect={() => onSelectSession(session.id)}
                onDelete={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
              />
            ))
          )}
        </div>
      )}
    </aside>
  );
}

function SessionItem({ session, isActive, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: isActive ? 'var(--accent-hover)' : hovered ? 'var(--accent-bg)' : 'transparent',
        border: '1px solid',
        borderColor: isActive ? 'var(--border-medium)' : 'transparent',
        transition: 'all 0.2s',
      }}
    >
      <MessageSquare size={14} color={isActive ? 'var(--text-primary)' : 'var(--text-secondary)'} strokeWidth={1.5} />
      <span style={{ fontSize: '13px', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? 400 : 300 }}>
        {session.title}
      </span>
      {hovered && (
        <button
          onClick={onDelete}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <Trash2 size={13} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
