import { useState, useEffect } from 'react';
import AuthPortal from './src/portals/AuthPortal.jsx';
import AdvocatePortal from './src/portals/AdvocatePortal.jsx';
import PWAManager from './PWAManager.jsx';
import SubscriptionGuard from './src/components/SubscriptionGuard.jsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState({
    id: "dev_user",
    email: "dev.advocate@nexus.com",
    role: "advocate",
    name: "Dev Advocate"
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Development mode bypasses AuthPortal
  }, []);

  const handleLogin = (token, user) => {
    localStorage.setItem('nj_token', token);
    localStorage.setItem('nj_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('nj_token');
    localStorage.removeItem('nj_user');
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'calc(var(--vh,1vh)*100)', background:'#020617' }}>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:56, height:56, background:'#f59e0b', borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:16, boxShadow:'0 8px 32px rgba(245,158,11,.35)' }}>
            <span style={{ fontSize:28, fontWeight:900, color:'#000', fontStyle:'italic' }}>N</span>
          </div>
          <div style={{ fontSize:12, color:'#475569', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase' }}>
            Loading Nexus Justice…
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <><PWAManager /><AuthPortal onLogin={handleLogin} /></>;

  // Only advocate role is supported in this portal
  if (currentUser.role !== 'advocate') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'calc(var(--vh,1vh)*100)', background:'#020617', fontFamily:"'Inter',system-ui,sans-serif" }}>
        <div style={{ textAlign:'center', maxWidth:440, padding:32 }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🔒</div>
          <h2 style={{ color:'#e2e8f0', fontWeight:900, fontSize:22, margin:'0 0 12px' }}>Advocate Portal Only</h2>
          <p style={{ color:'#475569', fontSize:13, lineHeight:1.7, marginBottom:24 }}>
            This portal is for advocate accounts only. Please use the appropriate portal for your account type.
          </p>
          <button onClick={handleLogout} style={{ padding:'12px 28px', background:'#6366f1', border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:900, cursor:'pointer' }}>
            ← Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PWAManager />
      <SubscriptionGuard user={currentUser}>
        <AdvocatePortal user={currentUser} onLogout={handleLogout} />
      </SubscriptionGuard>
    </>
  );
}
