import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// ─── iOS momentum scroll fix ──────────────────────────────────────────────────
document.addEventListener('touchmove', function() {}, { passive: true });

// ─── --vh fix — belt-and-suspenders alongside index.html script ───────────────
function setVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setVh();

// ─── Service Worker Cleanup ───────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (e) => {
    if (e.data?.type === 'SW_SELF_DESTRUCT') {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      if (!sessionStorage.getItem('_sw_cleaned')) {
        sessionStorage.setItem('_sw_cleaned', '1');
        window.location.reload();
      }
    }
  });

  window.addEventListener('load', async () => {
    try { await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }); } catch {}
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    } catch {}
    setTimeout(() => sessionStorage.removeItem('_sw_cleaned'), 10000);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
