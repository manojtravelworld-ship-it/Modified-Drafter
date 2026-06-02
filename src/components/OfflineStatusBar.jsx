// ─── OfflineStatusBar.jsx ─────────────────────────────────────────────────────
// Nexus Justice v5 — shows online/offline status and sync state.
// Gemma 3n is always server-side — no local model download bar needed.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

export default function OfflineStatusBar({
  isOnline,
  pendingSyncCount = 0,
  onSync,
  // Legacy props accepted but ignored — no local model download in v5
  localModelStatus,
  localModelProgress,
  localModelProgressText,
  onEnableLocalAI,
  onDisableLocalAI,
}) {
  const [justCameOnline, setJustCameOnline] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setJustCameOnline(true);
      setTimeout(() => setJustCameOnline(false), 3000);
    }
  }, [isOnline]);

  // Only show bar when offline, just reconnected, or pending sync
  if (isOnline && !justCameOnline && pendingSyncCount === 0) return null;

  const bg = !isOnline
    ? 'rgba(245,158,11,0.95)'
    : pendingSyncCount > 0
    ? 'rgba(16,185,129,0.95)'
    : 'rgba(16,185,129,0.95)';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: bg,
      backdropFilter: 'blur(12px)',
      padding: '6px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 11, fontWeight: 800, color: '#000',
      letterSpacing: '0.04em',
      boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
      transition: 'all 0.3s',
    }}>
      {/* Left: status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: !isOnline ? '#92400e' : '#065f46',
          boxShadow: `0 0 6px ${!isOnline ? '#92400e' : '#065f46'}`,
          flexShrink: 0,
        }} />
        {!isOnline && (
          <span>📵 OFFLINE — Gemini 2.5 Flash requires internet connection</span>
        )}
        {isOnline && pendingSyncCount > 0 && (
          <span>🔄 Back online — {pendingSyncCount} item{pendingSyncCount !== 1 ? 's' : ''} to sync</span>
        )}
        {justCameOnline && pendingSyncCount === 0 && (
          <span>✅ Connected — Gemini 2.5 Flash AI ready</span>
        )}
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isOnline && pendingSyncCount > 0 && onSync && (
          <button
            onClick={onSync}
            style={{ padding: '3px 10px', background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 10, color: '#000', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}
          >
            Sync Now
          </button>
        )}
        {isOnline && (
          <span style={{ fontSize: 10, opacity: 0.7 }}>
            🤖 Gemini 2.5 Flash
          </span>
        )}
      </div>
    </div>
  );
}
