import { useState, useEffect } from 'react';
import api from '../../api.js';

const Icon = ({ path, size = 20, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {Array.isArray(path) ? path.map((d, i) => <path key={i} d={d} />) : <path d={path} />}
  </svg>
);

const STYLES = `
  @keyframes authFadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes authGlow{0%,100%{opacity:.3}50%{opacity:.7}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .auth-input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:13px 16px;color:#e2e8f0;font-size:13px;outline:none;box-sizing:border-box;transition:border .2s;font-family:inherit}
  .auth-input:focus{border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.04)}
  .auth-input::placeholder{color:#334155}
  .auth-btn{width:100%;padding:14px;background:#6366f1;border:none;border-radius:13px;color:#fff;font-size:13px;font-weight:900;cursor:pointer;letter-spacing:0.05em;transition:all .2s;font-family:inherit}
  .auth-btn:hover{background:#4f46e5;transform:translateY(-1px);box-shadow:0 8px 30px rgba(99,102,241,.4)}
  .auth-btn:disabled{background:rgba(99,102,241,.3);cursor:default;transform:none;box-shadow:none}
  .auth-link{background:none;border:none;color:#6366f1;cursor:pointer;font-size:12px;font-weight:700;text-decoration:underline;padding:0;font-family:inherit}
  .auth-link:hover{color:#818cf8}
  .field-label{font-size:10px;font-weight:900;color:#475569;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;display:block}
  .error-box{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px 14px;color:#f87171;font-size:12px;margin-bottom:14px}
  .success-box{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:10px 14px;color:#10b981;font-size:12px;margin-bottom:14px}
`;

function AuthShell({ children, title, sub }) {
  return (
    <div style={{ minHeight:'calc(var(--vh, 1vh) * 100)', background:'#020617', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Inter',system-ui,sans-serif", padding:20, position:'relative', overflow:'hidden' }}>
      <style>{STYLES}</style>
      <div style={{ position:'absolute', top:'10%', left:'15%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,.12) 0%,transparent 70%)', animation:'authGlow 4s ease infinite', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'5%', right:'10%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(245,158,11,.08) 0%,transparent 70%)', animation:'authGlow 5s ease infinite .5s', pointerEvents:'none' }} />
      <div style={{ width:'100%', maxWidth:480, animation:'authFadeUp .5s ease forwards' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, background:'#f59e0b', borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:14, boxShadow:'0 8px 32px rgba(245,158,11,.35)' }}>
            <span style={{ fontSize:28, fontWeight:900, color:'#000', fontStyle:'italic' }}>N</span>
          </div>
          <div style={{ fontSize:10, color:'#475569', fontWeight:900, letterSpacing:'0.3em', textTransform:'uppercase', marginBottom:4 }}>Nexus Justice v5</div>
          <h1 style={{ fontSize:28, fontWeight:900, color:'#e2e8f0', margin:0, letterSpacing:'-0.02em' }}>{title}</h1>
          {sub && <p style={{ fontSize:13, color:'#475569', margin:'8px 0 0' }}>{sub}</p>}
        </div>
        <div style={{ background:'#0a0f1d', borderRadius:24, padding:32, border:'1px solid rgba(255,255,255,.06)', boxShadow:'0 40px 80px rgba(0,0,0,.6)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display:'inline-block', width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite', verticalAlign:'middle', marginRight:8 }} />;
}

// ─── Sign In ──────────────────────────────────────────────────────────────────
function SignIn({ onSignIn, onGoSignUp, onGoForgot }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getDeviceId = () => {
    let id = localStorage.getItem('nj_device_id');
    if (!id) {
      id = 'DEV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,7).toUpperCase();
      localStorage.setItem('nj_device_id', id);
    }
    return id;
  };

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password, deviceId: getDeviceId() });
      onSignIn(res.data.token, res.data.user);
    } catch (e) {
      const errCode = e.response?.data?.error;
      if (errCode === 'device_limit') {
        setError('This account is active on 2 devices already. Contact your Agency to reset devices.');
      } else {
        setError(e.response?.data?.error || 'Login failed. Please try again.');
      }
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Welcome Back" sub="Sign in to your Nexus Justice Portal">
      {error && <div className="error-box">⚠ {error}</div>}
      <div style={{ marginBottom:16 }}>
        <label className="field-label">Email Address</label>
        <input className="auth-input" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
      </div>
      <div style={{ marginBottom:8 }}>
        <label className="field-label">Password</label>
        <div style={{ position:'relative' }}>
          <input className="auth-input" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={{ paddingRight:44 }} />
          <button onClick={() => setShowPass(v => !v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:14 }}>{showPass ? '🙈' : '👁'}</button>
        </div>
      </div>
      <div style={{ textAlign:'right', marginBottom:22 }}>
        <button className="auth-link" onClick={onGoForgot}>Forgot password?</button>
      </div>
      <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
        {loading && <Spinner />}
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
      <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#475569' }}>
        New advocate? <button className="auth-link" onClick={onGoSignUp}>Create account</button>
      </div>
      {/* Demo credentials — advocate only */}
      <div style={{ marginTop:20, padding:'10px 14px', background:'rgba(99,102,241,.06)', border:'1px solid rgba(99,102,241,.12)', borderRadius:10 }}>
        <div style={{ fontSize:9, color:'#6366f1', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:6 }}>Demo Credentials</div>
        <div style={{ fontSize:11, color:'#475569', marginBottom:2 }}>🧑‍⚖️ Advocate: <span style={{ color:'#94a3b8', fontWeight:700 }}>sanjay@nexusjustice.in</span> / <span style={{ color:'#94a3b8' }}>demo1234</span></div>
        <div style={{ fontSize:11, color:'#475569' }}>🤝 Affiliate: <span style={{ color:'#94a3b8', fontWeight:700 }}>sarah@lawpartner.in</span> / <span style={{ color:'#94a3b8' }}>demo1234</span></div>
      </div>
    </AuthShell>
  );
}

// ─── Advocate Sign Up ─────────────────────────────────────────────────────────
const SPECS = ['Criminal Law','Civil Law','Family Law','Corporate Law','IP Law','Tax Law','Labour Law','Constitutional Law','Real Estate Law','Other'];

function SignUp({ onGoSignIn, onSignUpSuccess }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'', confirmPassword:'', barCouncilNo:'', specialisation:'', affiliateCode:'' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) set('affiliateCode', ref);
  }, []);

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Full name is required.';
    if (!form.email.includes('@')) return 'Enter a valid email.';
    if (!/^\+?\d{8,15}$/.test(form.phone.replace(/\s/g,''))) return 'Enter a valid phone number.';
    return null;
  };
  const validateStep2 = () => {
    if (!form.barCouncilNo.trim()) return 'Bar Council number is required.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleNext = () => {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError(''); setStep(2);
  };

  const handleSubmit = async () => {
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.post('/api/auth/signup', form);
      onSignUpSuccess(res.data.user);
    } catch (e) {
      setError(e.response?.data?.error || 'Signup failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Advocate Sign Up" sub="Join Nexus Justice — create your advocate account">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24 }}>
        {[1,2].map(s => (
          <div key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:26, height:26, borderRadius:'50%', background: s<=step?'#6366f1':'rgba(255,255,255,.06)', border:`1px solid ${s<=step?'#6366f1':'rgba(255,255,255,.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color: s<=step?'#fff':'#334155' }}>{s}</div>
            <span style={{ fontSize:10, fontWeight:700, color: s===step?'#e2e8f0':'#334155', textTransform:'uppercase', letterSpacing:'0.1em' }}>{s===1?'Personal':'Professional'}</span>
            {s<2 && <div style={{ width:30, height:1, background:'rgba(255,255,255,.08)', marginLeft:4 }} />}
          </div>
        ))}
      </div>
      {error && <div className="error-box">⚠ {error}</div>}
      {step===1 && (
        <>
          <div style={{ marginBottom:14 }}>
            <label className="field-label">Full Name</label>
            <input className="auth-input" placeholder="Advocate Ramesh Kumar" value={form.name} onChange={e=>set('name',e.target.value)} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label className="field-label">Email Address</label>
            <input className="auth-input" type="email" placeholder="your@email.com" value={form.email} onChange={e=>set('email',e.target.value)} />
          </div>
          <div style={{ marginBottom:22 }}>
            <label className="field-label">Phone Number</label>
            <input className="auth-input" placeholder="+91 98765 43210" value={form.phone} onChange={e=>set('phone',e.target.value)} />
          </div>
          <button className="auth-btn" onClick={handleNext}>Continue →</button>
        </>
      )}
      {step===2 && (
        <>
          <div style={{ marginBottom:14 }}>
            <label className="field-label">Bar Council Enrolment No.</label>
            <input className="auth-input" placeholder="KL/1234/2010" value={form.barCouncilNo} onChange={e=>set('barCouncilNo',e.target.value)} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label className="field-label">Specialisation</label>
            <select value={form.specialisation} onChange={e=>set('specialisation',e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:'13px 16px', color:form.specialisation?'#e2e8f0':'#334155', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}>
              <option value="">Select specialisation…</option>
              {SPECS.map(s=><option key={s} value={s} style={{ background:'#0a0f1d' }}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label className="field-label">Affiliate / Referral Code <span style={{ color:'#334155', fontWeight:400, textTransform:'none' }}>(optional)</span></label>
            <input className="auth-input" placeholder="e.g. AFF-001" value={form.affiliateCode} onChange={e=>set('affiliateCode',e.target.value)} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label className="field-label">Password</label>
            <div style={{ position:'relative' }}>
              <input className="auth-input" type={showPass?'text':'password'} placeholder="Min. 8 characters" value={form.password} onChange={e=>set('password',e.target.value)} style={{ paddingRight:44 }} />
              <button onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:14 }}>{showPass?'🙈':'👁'}</button>
            </div>
          </div>
          <div style={{ marginBottom:22 }}>
            <label className="field-label">Confirm Password</label>
            <input className="auth-input" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>{setStep(1);setError('');}} style={{ padding:'13px 20px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:13, color:'#94a3b8', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
            <button className="auth-btn" onClick={handleSubmit} disabled={loading} style={{ flex:1 }}>
              {loading && <Spinner />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </div>
        </>
      )}
      <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#475569' }}>
        Already have an account? <button className="auth-link" onClick={onGoSignIn}>Sign in</button>
      </div>
    </AuthShell>
  );
}

// ─── Sign Up Success ──────────────────────────────────────────────────────────
function SignUpSuccess({ onGoSignIn }) {
  return (
    <AuthShell title="Application Submitted!" sub="">
      <div style={{ textAlign:'center', padding:'10px 0 20px' }}>
        <div style={{ width:64, height:64, background:'rgba(16,185,129,.1)', border:'2px solid rgba(16,185,129,.3)', borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:30, marginBottom:16 }}>✓</div>
        <p style={{ color:'#94a3b8', fontSize:13, lineHeight:1.7, margin:'0 0 20px' }}>
          Your account has been submitted for approval.<br/>
          <strong style={{ color:'#e2e8f0' }}>Agency HQ</strong> will review and activate your account shortly.
        </p>
        <div style={{ background:'rgba(245,158,11,.05)', border:'1px solid rgba(245,158,11,.15)', borderRadius:14, padding:18, textAlign:'left', marginBottom:24 }}>
          <div style={{ fontSize:9, color:'#f59e0b', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:10 }}>📱 Your Affiliate Link is Ready!</div>
          <p style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6 }}>Once approved, check your Notifications tab for your unique affiliate link to share and earn commissions!</p>
        </div>
        <button className="auth-btn" onClick={onGoSignIn}>Go to Sign In</button>
      </div>
    </AuthShell>
  );
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
function ForgotPassword({ onGoSignIn }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (e) { setError(e.response?.data?.error || 'Error sending reset link.'); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell title="Reset Password" sub="We'll send a reset link to your email">
      {sent ? (
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:16 }}>📧</div>
          <div className="success-box" style={{ textAlign:'left' }}>Reset link sent to <strong>{email}</strong>. Check your inbox.</div>
          <button className="auth-btn" onClick={onGoSignIn}>Back to Sign In</button>
        </div>
      ) : (
        <>
          {error && <div className="error-box">⚠ {error}</div>}
          <div style={{ marginBottom:22 }}>
            <label className="field-label">Registered Email Address</label>
            <input className="auth-input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} />
          </div>
          <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
            {loading && <Spinner />}
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <div style={{ textAlign:'center', marginTop:18 }}>
            <button className="auth-link" onClick={onGoSignIn}>← Back to Sign In</button>
          </div>
        </>
      )}
    </AuthShell>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function AuthPortal({ onLogin }) {
  const [screen, setScreen] = useState('signin');

  if (screen === 'signup') return <SignUp onGoSignIn={()=>setScreen('signin')} onSignUpSuccess={()=>setScreen('success')} />;
  if (screen === 'success') return <SignUpSuccess onGoSignIn={()=>setScreen('signin')} />;
  if (screen === 'forgot') return <ForgotPassword onGoSignIn={()=>setScreen('signin')} />;
  return <SignIn onSignIn={onLogin} onGoSignUp={()=>setScreen('signup')} onGoForgot={()=>setScreen('forgot')} />;
}
