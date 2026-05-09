import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Upload, Trash2, CheckCircle, AlertCircle,
  Loader2, X, Network, Shield, Activity, ChevronRight, FileText, RefreshCw
} from 'lucide-react';
import RuixenBackground from './RuixenBackground';

// ─── Lazy-load force-graph (pure 2D canvas, zero AFRAME/WebXR deps) ────────
let _FGCache = null;
async function loadForceGraph() {
  if (_FGCache) return _FGCache;
  const mod = await import('force-graph');
  _FGCache = mod.default || mod;
  return _FGCache;
}

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// ─── Shared card style (mirrors Sidebar / ChatInput glass aesthetic) ────────
const card = {
  background: 'var(--bg-glass-medium)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--border-light)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-glass)',
};

// ─── Icon badge (matches Header logo badge) ─────────────────────────────────
function IconBadge({ children, color = 'var(--border-medium)' }) {
  return (
    <div style={{
      width: '34px', height: '34px', borderRadius: '8px',
      background: 'var(--accent-bg)', border: `1px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const map = {
    success: { border: 'rgba(34,197,94,0.4)',  text: '#22c55e', icon: <CheckCircle size={15} /> },
    error:   { border: 'rgba(239,68,68,0.4)',   text: '#ef4444', icon: <AlertCircle size={15} /> },
    loading: { border: 'var(--border-medium)', text: 'var(--text-secondary)', icon: <Loader2 size={15} style={{ animation: 'adSpin 1s linear infinite' }} /> },
  };
  const c = map[toast.type] || map.loading;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      style={{
        ...card,
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', minWidth: '280px',
        borderColor: c.border,
      }}
    >
      <span style={{ color: c.text, flexShrink: 0 }}>{c.icon}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, fontWeight: 400 }}>{toast.message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
        <X size={13} />
      </button>
    </motion.div>
  );
}

// ─── Graph Visualizer ────────────────────────────────────────────────────────
function GraphVisualizer({ refreshTrigger }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts]       = useState({ nodes: 0, links: 0 });
  const canvasRef = useRef(null);
  const graphRef  = useRef(null);

  const fetchGraphData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const r = await fetch(`${API}/api/admin/graph-data`);
      const data = await r.json();
      const nm = new Map();
      data.forEach(({ source, target }) => {
        if (!nm.has(source)) nm.set(source, { id: source, nt: 'source' });
        if (!nm.has(target)) nm.set(target, { id: target, nt: 'target' });
      });
      const nodes = [...nm.values()];
      const links = data.map(({ source, target }) => ({ source, target }));
      setGraphData({ nodes, links });
      setCounts({ nodes: nodes.length, links: links.length });
    } catch (e) {
      console.error("Failed to fetch graph data", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (refreshTrigger > 0) fetchGraphData(true);
    else fetchGraphData();
  }, [fetchGraphData, refreshTrigger]);

  useEffect(() => {
    if (loading || !canvasRef.current || !graphData.nodes.length) return;
    loadForceGraph().then(FG => {
      if (graphRef.current) {
        try { graphRef.current.pauseAnimation?.(); } catch {}
      }
      canvasRef.current.innerHTML = '';
      const el  = canvasRef.current;
      const { width, height } = el.getBoundingClientRect();
      // Read the system-online green from CSS variables for source nodes
      const isDark = document.documentElement.classList.contains('dark');
      const srcColor  = '#22c55e';          // matches System Online indicator
      const tgtColor  = isDark ? '#818cf8' : '#6366f1';
      graphRef.current = FG()(el)
        .width(width || 640).height(height || 400)
        .backgroundColor('transparent')
        .graphData({ nodes: graphData.nodes.map(n => ({...n})), links: graphData.links.map(l => ({...l})) })
        .nodeColor(n => n.nt === 'source' ? srcColor : tgtColor)
        .nodeRelSize(4)
        .nodeLabel('id')
        .nodeCanvasObject((node, ctx, scale) => {
          const color = node.nt === 'source' ? srcColor : tgtColor;
          const r = 5;
          ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.shadowColor = color; ctx.shadowBlur = 10;
          ctx.fill(); ctx.shadowBlur = 0;
          if (scale > 1.6) {
            const lbl = node.id.length > 14 ? node.id.slice(0, 12) + '…' : node.id;
            ctx.font = `${10 / scale}px Inter, sans-serif`;
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)';
            ctx.textAlign = 'center';
            ctx.fillText(lbl, node.x, node.y + r + 6 / scale);
          }
        })
        .nodeCanvasObjectMode(() => 'replace')
        .linkColor(() => isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)')
        .linkWidth(1)
        .linkDirectionalArrowLength(4)
        .linkDirectionalArrowRelPos(1);
    });
    return () => { try { graphRef.current?.pauseAnimation?.(); } catch {} };
  }, [loading, graphData]);

  const legend = [
    { color: '#22c55e', label: 'Source' },
    { color: '#6366f1', label: 'Target' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IconBadge color="var(--border-medium)">
            <Network size={16} color="var(--text-secondary)" strokeWidth={1.5} />
          </IconBadge>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.01em' }}>Knowledge Graph</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontWeight: 300 }}>
              {loading ? 'Loading…' : `${counts.nodes} nodes · ${counts.links} edges`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {legend.map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 300 }}>{label}</span>
            </div>
          ))}
          <div style={{ width: '1px', height: '14px', background: 'var(--border-medium)', margin: '0 4px' }} />
          <button
            onClick={() => fetchGraphData(true)}
            disabled={loading || refreshing}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-light)',
              borderRadius: '20px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading || refreshing ? 'not-allowed' : 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              if (!loading && !refreshing) {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-medium)';
              }
            }}
            onMouseLeave={e => {
              if (!loading && !refreshing) {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }
            }}
          >
            <RefreshCw size={12} style={{ animation: refreshing ? 'adSpin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div style={{
        flex: 1, borderRadius: '10px', overflow: 'hidden', position: 'relative',
        background: 'var(--accent-bg)',
        border: '1px solid var(--border-light)',
      }}>
        {loading ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', zIndex: 10 }}>
            <Loader2 size={24} color="var(--text-muted)" style={{ animation: 'adSpin 1s linear infinite' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 300 }}>Fetching graph data…</span>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 10 }}>
            <Database size={28} color="var(--text-muted)" strokeWidth={1.5} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 300 }}>No graph data — upload a PDF to populate</span>
          </div>
        ) : (
          <>
            {refreshing && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'var(--bg-glass-medium)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', zIndex: 10
              }}>
                <Loader2 size={24} color="var(--text-muted)" style={{ animation: 'adSpin 1s linear infinite' }} />
              </div>
            )}
            <div ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Control Panel ────────────────────────────────────────────────────────────
function ControlPanel({ addToast, removeToast, onRefreshGraph }) {
  const [dragging, setDragging]       = useState(false);
  const [file, setFile]               = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef();
  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, []);

  const startPolling = () => {
    setUploadStatus('processing');
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/admin/ingestion-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'idle') {
            clearInterval(pollTimerRef.current);
            setUploadStatus('success');
            onRefreshGraph();
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 3000);
  };

  const handleDrop = e => {
    e.preventDefault(); setDragging(false);
    if (uploadStatus === 'success' || uploadStatus === 'processing') return; // Don't allow drop if showing success or processing
    const f = e.dataTransfer.files[0];
    if (f?.name.toLowerCase().endsWith('.pdf')) {
      setFile(f);
      setUploadStatus('idle');
      setErrorMessage('');
    }
    else addToast({ type: 'error', message: 'Only PDF files are accepted.' });
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');
    const tid = addToast({ type: 'loading', message: `Uploading ${file.name}…` });
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API}/api/admin/upload-manual`, { method: 'POST', body: form });
      removeToast(tid);
      if (res.ok) {
        startPolling();
      } else {
        const e = await res.json().catch(() => ({}));
        setUploadStatus('error');
        setErrorMessage(e.detail || 'Upload failed due to a server error.');
      }
    } catch {
      removeToast(tid);
      setUploadStatus('error');
      setErrorMessage('Network error — server unreachable.');
    } finally {
      setUploading(false);
    }
  };

  const handleClearCache = async () => {
    setConfirmClear(false);
    const tid = addToast({ type: 'loading', message: 'Flushing semantic cache…' });
    try {
      const res = await fetch(`${API}/api/admin/clear-cache`, { method: 'DELETE' });
      removeToast(tid);
      if (res.ok) addToast({ type: 'success', message: '✓ Semantic cache cleared.' });
      else addToast({ type: 'error', message: 'Failed to clear cache.' });
    } catch { removeToast(tid); addToast({ type: 'error', message: 'Network error — server unreachable.' }); }
  };

  // ── Drop zone border color ──
  const dropBorder = dragging
    ? '1.5px dashed #22c55e'
    : file
      ? '1.5px dashed rgba(34,197,94,0.45)'
      : '1.5px dashed var(--border-medium)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Knowledge Ingestion card ──────────────────────────────────── */}
      <div style={{ ...card, padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <IconBadge color="rgba(34,197,94,0.35)">
            <Upload size={15} color="#22c55e" strokeWidth={1.5} />
          </IconBadge>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Knowledge Ingestion</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontWeight: 300 }}>Upload PDF manuals to expand the graph</p>
          </div>
        </div>

        {uploadStatus === 'success' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '12px',
              marginBottom: '4px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={20} color="#22c55e" strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#22c55e', margin: '0 0 6px' }}>✅ Successfully Ingested!</p>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                The graph has been updated with the new facts.
              </p>
            </div>
            <button
              onClick={() => { setFile(null); setUploadStatus('idle'); }}
              style={{
                marginTop: '4px',
                background: 'transparent',
                border: '1px solid rgba(34,197,94,0.4)',
                borderRadius: '20px',
                padding: '6px 16px',
                color: '#22c55e',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Upload Another Manual
            </button>
          </motion.div>
        ) : uploadStatus === 'processing' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              padding: '24px 16px',
              borderRadius: '12px',
              background: 'var(--accent-bg)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '12px',
              marginBottom: '4px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color="#818cf8" strokeWidth={1.5} style={{ animation: 'adSpin 2s linear infinite' }} />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 6px' }}>AI is analyzing document...</p>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                Extracting entities and relationships.<br/>This may take a few minutes.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: dropBorder,
                borderRadius: '10px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'rgba(34,197,94,0.04)' : 'var(--accent-bg)',
                transition: 'all 0.2s',
                marginBottom: '12px',
              }}
            >
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0] || null); setUploadStatus('idle'); setErrorMessage(''); }} />
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <FileText size={18} color="#22c55e" strokeWidth={1.5} />
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: '13px', fontWeight: 400, color: '#22c55e', margin: 0 }}>{file.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontWeight: 300 }}>{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); setUploadStatus('idle'); setErrorMessage(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', marginLeft: '6px' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={20} color="var(--text-muted)" strokeWidth={1.5} style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 3px', fontWeight: 300 }}>
                    Drop a PDF here or <span style={{ color: '#22c55e', fontWeight: 400 }}>browse</span>
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontWeight: 300 }}>Only .pdf files accepted</p>
                </>
              )}
            </div>

            {uploadStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '10px 12px', borderRadius: '8px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  marginBottom: '12px',
                }}
              >
                <AlertCircle size={14} color="#ef4444" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 400, lineHeight: '1.4' }}>{errorMessage}</span>
              </motion.div>
            )}

            {/* Upload button — mirrors GlowingButton / ChatInput submit aesthetics */}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={{
                width: '100%', padding: '10px',
                borderRadius: '20px',               // pill — matches ChatInput border-radius
                border: '1px solid',
                borderColor: file && !uploading ? 'rgba(34,197,94,0.45)' : 'var(--border-light)',
                background: file && !uploading ? 'var(--accent-bg)' : 'transparent',
                color: file && !uploading ? '#22c55e' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: 400,
                cursor: file && !uploading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={e => { if (file && !uploading) e.currentTarget.style.background = 'rgba(34,197,94,0.08)'; }}
              onMouseLeave={e => { if (file && !uploading) e.currentTarget.style.background = 'var(--accent-bg)'; }}
            >
              {uploading
                ? <><Loader2 size={13} style={{ animation: 'adSpin 1s linear infinite' }} /> Uploading File...</>
                : <><Upload size={13} strokeWidth={1.5} /> Upload &amp; Ingest</>
              }
            </button>
          </>
        )}
      </div>

      {/* ── Cache Management card ────────────────────────────────────── */}
      <div style={{ ...card, padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <IconBadge color="rgba(239,68,68,0.3)">
            <Trash2 size={15} color="#ef4444" strokeWidth={1.5} />
          </IconBadge>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Cache Management</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontWeight: 300 }}>Upstash Redis semantic cache</p>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.65', fontWeight: 300 }}>
          Flushing the cache removes all cached LLM responses. Subsequent requests will be slower until the cache repopulates.
        </p>

        <AnimatePresence>
          {confirmClear && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '10px', padding: '12px', marginBottom: '12px',
              }}
            >
              <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '10px', fontWeight: 400 }}>
                ⚠ This cannot be undone. Confirm flush?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleClearCache}
                  style={{ flex: 1, padding: '8px', borderRadius: '20px', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontSize: '12px', fontWeight: 400, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Yes, Flush
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: '20px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setConfirmClear(true)}
          style={{
            width: '100%', padding: '10px', borderRadius: '20px',
            background: 'transparent', border: '1px solid var(--border-medium)',
            color: '#ef4444', fontSize: '13px', fontWeight: 400, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            transition: 'all 0.2s', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
        >
          <Trash2 size={13} strokeWidth={1.5} />
          Clear Semantic Cache
        </button>
      </div>

      {/* ── Stats chips ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {[
          { icon: Activity, label: 'Pipeline', value: 'Active',  color: '#22c55e' },
          { icon: Shield,   label: 'Access',   value: 'Admin',   color: 'var(--text-secondary)' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon size={14} color={color} strokeWidth={1.5} />
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, fontWeight: 300, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
              <p style={{ fontSize: '12px', color, margin: 0, fontWeight: 500 }}>{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AdminDashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [toasts, setToasts] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const nextId = useRef(0);

  const addToast = useCallback(toast => {
    const id = ++nextId.current;
    setToasts(p => [...p, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback(id => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  return (
    <RuixenBackground>
      {/* Scoped spin keyframe — won't conflict with global styles */}
      <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        minHeight: '100vh',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 300,
        letterSpacing: '0.02em',
        overflowY: 'auto',
      }}>
        {/* Toast stack */}
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <AnimatePresence>
            {toasts.map(t => <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />)}
          </AnimatePresence>
        </div>

        {/* ── Page header — same glass treatment as main Header ── */}
        <div style={{
          padding: '16px 28px',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-glass-light)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Network size={16} color="var(--text-secondary)" strokeWidth={1.5} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, letterSpacing: '0.04em' }}>
            GraphSentinel
          </span>
          <ChevronRight size={12} color="var(--text-muted)" />
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>Admin Console</span>
        </div>

        {/* ── Content ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ padding: '28px 28px 48px' }}
        >
          {/* Title row */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '0.01em' }}>
              Admin Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontWeight: 300 }}>
              Knowledge graph visualization, PDF ingestion &amp; cache management
            </p>
          </div>

          {/* Two-column grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) 340px',
            gap: '20px',
            alignItems: 'start',
          }}>

            {/* Graph panel — same card style as Sidebar */}
            <div style={{
              ...card,
              padding: '20px',
              height: '520px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <GraphVisualizer refreshTrigger={refreshTrigger} />
            </div>

            {/* Control panel */}
            <ControlPanel addToast={addToast} removeToast={removeToast} onRefreshGraph={() => setRefreshTrigger(p => p + 1)} />
          </div>

          {/* Responsive breakpoint */}
          <style>{`
            @media (max-width: 860px) {
              .adGrid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </motion.div>
      </div>
    </RuixenBackground>
  );
}
