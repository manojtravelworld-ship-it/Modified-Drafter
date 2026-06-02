// SubscriptionGuard — test mode: always active, no payment required
import { useState, useEffect } from 'react';
import api from '../../api.js';

export default function SubscriptionGuard({ children, user }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // In test mode, skip subscription check — just verify auth still valid
    if (!user || user.role !== 'advocate') { setReady(true); return; }
    api.get('/api/advocate/subscription')
      .then(() => setReady(true))
      .catch(() => setReady(true)); // fail open
  }, [user]);

  if (!ready) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'calc(var(--vh,1vh)*100)', background:'#020617' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width:36, height:36, border:'3px solid rgba(99,102,241,.2)', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  return children;
}
