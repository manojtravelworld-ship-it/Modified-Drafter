import { useState, useEffect, useRef } from 'react';

const S = `
  @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse3{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .pwa-overlay{position:fixed;inset:0;background:rgba(2,6,23,.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:0 0 env(safe-area-inset-bottom,16px) 0}
  .pwa-sheet{background:linear-gradient(180deg,#0d1526 0%,#070b14 100%);border-radius:28px 28px 0 0;padding:28px 24px 32px;width:100%;max-width:520px;animation:slideUp .35s cubic-bezier(.34,1.56,.64,1) forwards;border:1px solid rgba(255,255,255,.06);border-bottom:none}
  .pwa-btn{width:100%;padding:15px;border:none;border-radius:16px;font-size:14px;font-weight:900;cursor:pointer;letter-spacing:0.04em;transition:all .18s;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:10px}
  .pwa-btn-primary{background:linear-gradient(135deg,#f59e0b,#d97706);color:#000}
  .pwa-btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(245,158,11,.4)}
  .pwa-btn-secondary{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)!important;color:#64748b;margin-top:10px}
  .perm-row{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);margin-bottom:10px;cursor:pointer;transition:all .18s}
  .perm-row:hover{background:rgba(99,102,241,.06);border-color:rgba(99,102,241,.2)}
  .perm-row.granted{background:rgba(16,185,129,.05);border-color:rgba(16,185,129,.2)}
  .perm-row.denied{background:rgba(239,68,68,.05);border-color:rgba(239,68,68,.15)}
  .perm-icon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
  .badge{font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;padding:3px 9px;border-radius:20px}
`;

// ─── Install Banner ───────────────────────────────────────────────────────────
function InstallBanner({ onDismiss }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPhone|iPad|iPod/.test(ua) && !window.MSStream);
    setIsAndroid(/Android/.test(ua));

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setInstalled(true); setTimeout(onDismiss, 2000); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') { setInstalled(true); setTimeout(onDismiss, 1800); }
  };

  if (installed) return (
    <div className="pwa-overlay">
      <div className="pwa-sheet" style={{ textAlign:'center', paddingTop:36 }}>
        <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
        <div style={{ fontSize:20, fontWeight:900, color:'#10b981', marginBottom:6 }}>App Installed!</div>
        <div style={{ fontSize:13, color:'#475569' }}>Nexus Justice is now on your home screen.</div>
      </div>
    </div>
  );

  return (
    <div className="pwa-overlay">
      <div className="pwa-sheet">
        {/* Logo + Header */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:22 }}>
          <img src="/icon-192.png" alt="Nexus Justice" style={{ width:60, height:60, borderRadius:16, border:'2px solid rgba(245,158,11,.3)', flexShrink:0 }} />
          <div>
            <div style={{ fontSize:9, color:'#f59e0b', fontWeight:900, letterSpacing:'0.25em', textTransform:'uppercase', marginBottom:3 }}>Install App</div>
            <div style={{ fontSize:20, fontWeight:900, color:'#e2e8f0', letterSpacing:'-0.02em' }}>Nexus Justice</div>
            <div style={{ fontSize:11, color:'#475569', fontWeight:600 }}>AI Solutions · Legal SaaS</div>
          </div>
          <div style={{ marginLeft:'auto', flexShrink:0 }}>
            
          </div>
        </div>

        {/* Feature pills */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:22 }}>
          {['⚡ Works Offline','🔔 Push Alerts','🎙 Voice AI','📱 Native Feel','🔒 Secure'].map(f => (
            <span key={f} style={{ fontSize:11, color:'#64748b', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:20, padding:'5px 12px', fontWeight:600 }}>{f}</span>
          ))}
        </div>

        {/* Install button OR iOS instructions */}
        {isIOS ? (
          <div style={{ background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.15)', borderRadius:16, padding:'16px 18px', marginBottom:14 }}>
            <div style={{ fontSize:10, color:'#818cf8', fontWeight:900, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:10 }}>To install on iPhone/iPad:</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                ['1','Tap the Share button','↑ at the bottom of Safari'],
                ['2','Scroll and tap','Add to Home Screen'],
                ['3','Tap','Add — done!']
              ].map(([n, a, b]) => (
                <div key={n} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(99,102,241,.2)', color:'#818cf8', fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{n}</div>
                  <div style={{ fontSize:12, color:'#94a3b8' }}>{a} <strong style={{ color:'#e2e8f0' }}>{b}</strong></div>
                </div>
              ))}
            </div>
          </div>
        ) : deferredPrompt ? (
          <button className="pwa-btn pwa-btn-primary" onClick={handleInstall} disabled={installing}>
            {installing
              ? <><span style={{ width:18, height:18, border:'2px solid rgba(0,0,0,.3)', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> Installing…</>
              : <><span style={{ fontSize:20 }}>📱</span> Install App</>
            }
          </button>
        ) : (
          <div style={{ background:'rgba(255,255,255,.03)', borderRadius:14, padding:'14px 16px', marginBottom:14, fontSize:12, color:'#475569', textAlign:'center' }}>
            {isAndroid ? 'Tap the ⋮ menu → "Add to Home screen"' : 'Open in Chrome/Edge on your device for the best install experience.'}
          </div>
        )}

        <button className="pwa-btn pwa-btn-secondary" style={{ border:'1px solid rgba(255,255,255,.1)' }} onClick={onDismiss}>
          Maybe Later
        </button>
      </div>
    </div>
  );
}

// ─── Permissions Modal ────────────────────────────────────────────────────────
function PermissionsModal({ onDone }) {
  const [perms, setPerms] = useState({
    mic:    { status:'idle', label:'Microphone', emoji:'🎙', desc:'Voice-to-AI queries, dictation, legal consultation by voice', color:'#6366f1' },
    camera: { status:'idle', label:'Camera', emoji:'📹', desc:'Video capture in Command Center, document scanning', color:'#10b981' },
    drive:  { status:'idle', label:'Google Drive', emoji:'📂', desc:'Save & sync case files, drafts, documents to your Drive', color:'#f59e0b' },
    notify: { status:'idle', label:'Notifications', emoji:'🔔', desc:'Agency approvals, new broadcasts, commission alerts', color:'#8b5cf6' },
  });
  const [driveLoading, setDriveLoading] = useState(false);
  const allDone = Object.values(perms).every(p => p.status !== 'idle');

  const set = (key, status) => setPerms(p => ({ ...p, [key]: { ...p[key], status } }));

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      set('mic', 'granted');
    } catch (e) {
      set('mic', e.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      set('camera', 'granted');
    } catch (e) {
      set('camera', e.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  };

  const requestGoogleDrive = async () => {
    setDriveLoading(true);
    // Google Drive OAuth — opens consent popup
    // In production this uses your Google OAuth client ID
    const CLIENT_ID = window.GOOGLE_CLIENT_ID || '';
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';

    if (!CLIENT_ID) {
      // No client ID configured — mark as skipped with info
      set('drive', 'skipped');
      setDriveLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: window.location.origin + '/auth/google/callback',
        response_type: 'token',
        scope: SCOPES,
        prompt: 'consent',
        include_granted_scopes: 'true',
      });
      const popup = window.open(
        `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        'google-drive-auth',
        'width=500,height=600,left=200,top=100'
      );
      // Listen for callback message
      const handler = (e) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          localStorage.setItem('nj_gdrive_token', e.data.token);
          set('drive', 'granted');
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
      // Fallback timeout
      setTimeout(() => { window.removeEventListener('message', handler); set('drive', 'skipped'); setDriveLoading(false); }, 30000);
    } catch { set('drive', 'error'); }
    setDriveLoading(false);
  };

  const requestNotify = async () => {
    if (!('Notification' in window)) { set('notify', 'unsupported'); return; }
    const result = await Notification.requestPermission();
    set('notify', result === 'granted' ? 'granted' : 'denied');
  };

  const handlers = { mic: requestMic, camera: requestCamera, drive: requestGoogleDrive, notify: requestNotify };

  const statusBadge = (status) => {
    const map = {
      idle:        { label:'Tap to Allow', bg:'rgba(99,102,241,.1)',  color:'#818cf8' },
      granted:     { label:'✓ Allowed',    bg:'rgba(16,185,129,.1)', color:'#10b981' },
      denied:      { label:'✕ Denied',     bg:'rgba(239,68,68,.1)',  color:'#f87171' },
      error:       { label:'⚠ Error',      bg:'rgba(245,158,11,.1)', color:'#f59e0b' },
      skipped:     { label:'↷ Skipped',    bg:'rgba(255,255,255,.05)', color:'#475569' },
      unsupported: { label:'Not available', bg:'rgba(255,255,255,.05)', color:'#334155' },
    };
    const s = map[status] || map.idle;
    return <span className="badge" style={{ background:s.bg, color:s.color, border:`1px solid ${s.color}33` }}>{s.label}</span>;
  };

  return (
    <div className="pwa-overlay">
      <div className="pwa-sheet">
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <img src="/icon-192.png" alt="" style={{ width:44, height:44, borderRadius:12 }} />
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:'#e2e8f0' }}>Permissions</div>
            <div style={{ fontSize:11, color:'#475569' }}>Nexus Justice needs access to work fully</div>
          </div>
        </div>
        <p style={{ fontSize:12, color:'#334155', marginBottom:18, lineHeight:1.6 }}>
          Tap each item to grant permission. You can change these anytime in your browser settings.
        </p>

        {Object.entries(perms).map(([key, p]) => (
          <div
            key={key}
            className={`perm-row ${p.status === 'granted' ? 'granted' : p.status === 'denied' ? 'denied' : ''}`}
            onClick={() => p.status === 'idle' && handlers[key]?.()}
            style={{ cursor: p.status === 'idle' ? 'pointer' : 'default' }}
          >
            <div className="perm-icon" style={{ background:`${p.color}18`, border:`1px solid ${p.color}30` }}>
              {key === 'drive' && driveLoading
                ? <span style={{ width:20, height:20, border:`2px solid ${p.color}44`, borderTopColor:p.color, borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
                : p.emoji
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0', marginBottom:2 }}>{p.label}</div>
              <div style={{ fontSize:11, color:'#475569', lineHeight:1.4 }}>{p.desc}</div>
            </div>
            {statusBadge(p.status)}
          </div>
        ))}

        <button
          className="pwa-btn pwa-btn-primary"
          style={{ marginTop:16 }}
          onClick={onDone}
        >
          {allDone ? '✓ All Set — Enter App' : 'Continue →'}
        </button>
        <button className="pwa-btn pwa-btn-secondary" style={{ border:'1px solid rgba(255,255,255,.08)' }} onClick={onDone}>
          Skip for Now
        </button>
      </div>
    </div>
  );
}

// ─── Main PWAManager ──────────────────────────────────────────────────────────
export default function PWAManager() {
  const [showInstall, setShowInstall] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (hasShownRef.current) return;
    hasShownRef.current = true;

    const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    const dismissed = sessionStorage.getItem('nj_install_dismissed');
    const permsSet   = localStorage.getItem('nj_perms_shown');

    if (!alreadyInstalled && !dismissed) {
      // Small delay so app loads first
      setTimeout(() => setShowInstall(true), 1800);
    } else if (!permsSet) {
      setTimeout(() => setShowPerms(true), 800);
    }
  }, []);

  const handleInstallDismiss = () => {
    sessionStorage.setItem('nj_install_dismissed', '1');
    setShowInstall(false);
    // After install prompt, show permissions
    const permsSet = localStorage.getItem('nj_perms_shown');
    if (!permsSet) setTimeout(() => setShowPerms(true), 600);
  };

  const handlePermsDone = () => {
    localStorage.setItem('nj_perms_shown', '1');
    setShowPerms(false);
  };

  return (
    <>
      <style>{S}</style>
      {showInstall && <InstallBanner onDismiss={handleInstallDismiss} />}
      {showPerms   && !showInstall && <PermissionsModal onDone={handlePermsDone} />}
    </>
  );
}
