import { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RuixenBackground from './RuixenBackground';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

export default function AdminLogin({ onSuccess }) {
  const [password, setPassword]   = useState('');
  const [showPw,   setShowPw]     = useState(false);
  const [error,    setError]      = useState('');
  const [loading,  setLoading]    = useState(false);
  const [focused,  setFocused]    = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');

    // Simulate a brief async check so it feels deliberate
    await new Promise(r => setTimeout(r, 550));

    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      onSuccess();
    } else {
      setError('Invalid credentials. Access denied.');
      setPassword('');
      inputRef.current?.focus();
    }
    setLoading(false);
  };

  return (
    <RuixenBackground>
      <style>{`@keyframes lgSpin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        padding: '24px',
        boxSizing: 'border-box',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: '380px',
          }}
        >
          {/* ── Card ──────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--bg-glass-heavy)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-medium)',
            borderRadius: '20px',
            padding: '36px 32px',
            boxShadow: 'var(--shadow-heavy)',
          }}>

            {/* Lock badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'var(--accent-gradient)',
                border: '1px solid var(--border-medium)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-glass)',
              }}>
                <ShieldCheck size={26} color="var(--text-primary)" strokeWidth={1.5} />
              </div>
            </div>

            {/* Heading */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h1 style={{
                fontSize: '18px', fontWeight: 500,
                color: 'var(--text-primary)',
                margin: '0 0 6px',
                letterSpacing: '0.01em',
              }}>
                Admin Authentication
              </h1>
              <p style={{
                fontSize: '13px', color: 'var(--text-secondary)',
                margin: 0, fontWeight: 300, letterSpacing: '0.02em',
              }}>
                Restricted access — GraphSentinel Console
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Password field — mirrors ChatInput pill style */}
              <label style={{
                display: 'block',
                fontSize: '11px', fontWeight: 500,
                color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: '8px',
              }}>
                Password
              </label>

              <div style={{
                position: 'relative',
                display: 'flex', alignItems: 'center',
                background: 'var(--bg-glass-medium)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid',
                borderColor: error
                  ? 'rgba(239,68,68,0.5)'
                  : focused
                    ? 'var(--text-muted)'
                    : 'var(--border-medium)',
                borderRadius: '24px',
                padding: '11px 16px',
                boxShadow: focused
                  ? '0 0 0 1px var(--text-muted), var(--shadow-glass)'
                  : 'var(--shadow-glass)',
                transition: 'all 0.2s',
                marginBottom: '8px',
              }}>
                <Lock size={14} color="var(--text-muted)" strokeWidth={1.5} style={{ flexShrink: 0, marginRight: '10px' }} />
                <input
                  ref={inputRef}
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 300,
                    letterSpacing: '0.04em',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', padding: '2px', flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  tabIndex={-1}
                  title={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                </button>
              </div>

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="err"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 12px', borderRadius: '10px',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      marginBottom: '16px',
                    }}
                  >
                    <AlertCircle size={13} color="#ef4444" strokeWidth={1.5} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 400 }}>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {!error && <div style={{ height: '16px' }} />}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!password.trim() || loading}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '24px',
                  border: '1px solid',
                  borderColor: password.trim() && !loading
                    ? 'var(--border-medium)'
                    : 'var(--border-light)',
                  background: password.trim() && !loading
                    ? 'var(--text-primary)'
                    : 'var(--accent-bg)',
                  color: password.trim() && !loading
                    ? 'var(--bg-glass-heavy)'
                    : 'var(--text-muted)',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '0.02em',
                  cursor: password.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (password.trim() && !loading) e.currentTarget.style.opacity = '0.88';
                }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {loading
                  ? <><Loader2 size={15} style={{ animation: 'lgSpin 1s linear infinite' }} /> Verifying…</>
                  : 'Login to Console'
                }
              </button>
            </form>
          </div>

          {/* Footer note */}
          <p style={{
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '16px',
            fontWeight: 300,
            letterSpacing: '0.03em',
          }}>
            Session-scoped access · GraphSentinel v1.0
          </p>
        </motion.div>
      </div>
    </RuixenBackground>
  );
}
