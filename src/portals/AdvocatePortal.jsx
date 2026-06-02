import React, { useState, useRef, useEffect, useCallback } from "react";
import { useHybridAI } from "../utils/useHybridAI.js";
import { useLiveVoice, startCamera, stopCamera, isSecureContext } from "../utils/useLiveVoice.js";
import OfflineStatusBar from "../components/OfflineStatusBar.jsx";
import { offlineDB } from "../utils/OfflineDB.js";
import { calculateDeadlines, CASE_TYPES } from "../utils/DeadlineEngine.js";
import { buildReviewPrompt, parseReviewResponse } from "../utils/ContractReview.js";
import api from '../../api.js';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Maximize2, RotateCcw, Zap, Copy, Download, BookOpen, 
  ChevronRight, AlertTriangle, AlertCircle, Check, Info, Send, Trash
} from 'lucide-react';

const Icon = ({ path, size = 20, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(path) ? path.map((d, i) => <path key={i} d={d} />) : <path d={path} />}
  </svg>
);

const CLIENTS = [
  { slNo: 1, name: 'Sreedharan K.', phone: '+91 9876543210', courtName: 'District Court, Aluva', caseNumber: 'OS 145/2025', oppAdvocateName: 'Ramesh Menon', nextPostingDate: '2026-03-15', purposeOfPosting: 'Filing Written Statement' },
  { slNo: 2, name: 'Elena Rodriguez', phone: '+1 555-0199', courtName: 'High Court', caseNumber: 'WP(C) 204/2026', oppAdvocateName: 'Sarah Jenkins', nextPostingDate: '2026-03-20', purposeOfPosting: 'Hearing' },
  { slNo: 3, name: 'Marcus Thorne', phone: '+1 555-0188', courtName: 'Magistrate Court', caseNumber: 'CC 55/2026', oppAdvocateName: 'David Clark', nextPostingDate: '2026-04-05', purposeOfPosting: 'Evidence' },
  { slNo: 4, name: 'Sarah Jenkins', phone: '+1 555-0177', courtName: 'Family Court', caseNumber: 'OP 89/2025', oppAdvocateName: 'Priya Sharma', nextPostingDate: '2026-03-10', purposeOfPosting: 'Counseling' },
  { slNo: 5, name: 'Orbital Tech Corp', phone: '+1 555-0166', courtName: 'Commercial Court', caseNumber: 'CS 12/2026', oppAdvocateName: 'Michael Chang', nextPostingDate: '2026-04-12', purposeOfPosting: 'Framing of Issues' },
];

const VOICE_RECORDS = [
  { id: 'H01', client: 'Sreedharan K.', date: '16/02/2026', duration: '3m 4s', summary: 'Property boundary dispute in Aluva. Neighbor encroaching via new fence. Needs interim injunction.' },
  { id: 'H02', client: 'Elena Rodriguez', date: '15/02/2026', duration: '12m 15s', summary: 'IP theft consultation. Competitor launched identical product. Cease & desist draft requested.' },
  { id: 'H03', client: 'Marcus Thorne', date: '10/02/2026', duration: '8m 42s', summary: 'Real estate fraud follow-up. New evidence documents provided. Court strategy scheduled.' },
];

const NOTIFICATIONS = [
  { id: 1, message: "Welcome to Nexus Justice v3.1. Your affiliate link is ready.", date: "2026-02-27", read: false, type: 'general' },
  { id: 2, message: "John Doe (555-0192) joined under you — congratulations!", date: "2026-02-27", read: false, type: 'payment' },
];

const DEMO_AI_REPLIES = [
  "Based on the consultation history, Section 6 of the Specific Relief Act, 1963 applies — recovery of possession of immovable property. I recommend filing an interim injunction under Order XXXIX Rules 1 & 2 of CPC to restrain further encroachment. Shall I draft the petition?",
  "Under the Consumer Protection Act 2019, you may approach the District Consumer Disputes Redressal Commission for claims up to ₹1 crore. The process is straightforward — no lawyer is mandatory. Would you like guidance on documentation?",
  "For IPR infringement, Section 51 of the Copyright Act or Section 29 of the Trade Marks Act, 1999 may apply. I recommend a Cease & Desist notice first, followed by a civil suit for injunction and damages. I can draft the notice now.",
];
let demoIdx = 0;

const LAW_CATEGORIES = [
  { id: 'railway', label: 'Railway Law', color: '#f59e0b' },
  { id: 'cooperative', label: 'Cooperative Law', color: '#10b981' },
  { id: 'property', label: 'Property Law', color: '#6366f1' },
  { id: 'criminal', label: 'Criminal Law', color: '#ef4444' },
  { id: 'labour', label: 'Labour Law', color: '#8b5cf6' },
];

const getCatRgb = (color) => {
  const map = { '#f59e0b': '245,158,11', '#10b981': '16,185,129', '#6366f1': '99,102,241', '#ef4444': '239,68,68', '#8b5cf6': '139,92,246' };
  return map[color] || '99,102,241';
};

// ── Inline subscription renew banner ─────────────────────────────────────────
function SubscriptionRenewBanner({ user }) {
  const [sub, setSub] = React.useState(null);
  const [payLoading, setPayLoading] = React.useState(false);
  const [payMsg, setPayMsg] = React.useState('');

  React.useEffect(() => {
    if (!user || user.role !== 'advocate') return;
    import('../../api.js').then(m => {
      m.default.get('/api/advocate/subscription')
        .then(r => setSub(r.data))
        .catch(() => {});
    });
  }, [user]);

  if (!sub || sub.status === 'active') return null;

  const handlePay = async () => {
    setPayLoading(true); setPayMsg('');
    try {
      const api = (await import('../../api.js')).default;
      const orderRes = await api.post('/api/payment/create-order', { months: 1, plan: sub.plan || 'Pro' });
      const { order, key } = orderRes.data;
      if (!key || !order) { setPayMsg('Payment gateway not configured. Contact Agency.'); setPayLoading(false); return; }
      if (!window.Razorpay) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      new window.Razorpay({
        key, amount: order.amount, currency: order.currency,
        name: 'Nexus Justice', description: `Subscription Renewal`,
        order_id: order.id,
        prefill: { name: user?.name || '', email: user?.email || '' },
        theme: { color: '#6366f1' },
        handler: async (resp) => {
          try {
            await api.post('/api/payment/verify', { ...resp, months: 1, plan: sub.plan || 'Pro' });
            setPayMsg('✅ Payment successful! Refreshing...');
            setTimeout(() => window.location.reload(), 1500);
          } catch { setPayMsg('Verification failed. Contact Agency.'); }
          setPayLoading(false);
        },
        modal: { ondismiss: () => setPayLoading(false) },
      }).open();
    } catch (e) { setPayMsg(e.response?.data?.error || 'Payment failed.'); setPayLoading(false); }
  };

  return (
    <div style={{
      background: sub.status === 'grace' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${sub.status === 'grace' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
      borderRadius: 14, padding: '16px 18px', marginBottom: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: sub.status === 'grace' ? '#f59e0b' : '#f87171', marginBottom: 4 }}>
          {sub.status === 'grace' ? `⚠️ Subscription expires in ${sub.daysLeft} day${sub.daysLeft !== 1 ? 's' : ''}` : '🔒 Subscription Expired'}
        </div>
        <div style={{ fontSize: 11, color: '#475569' }}>
          {sub.status === 'grace' ? 'Renew now to avoid service interruption.' : 'Renew to restore cloud AI access.'}
        </div>
        {payMsg && <div style={{ fontSize: 11, color: payMsg.startsWith('✅') ? '#10b981' : '#f87171', marginTop: 4 }}>{payMsg}</div>}
      </div>
      <button onClick={handlePay} disabled={payLoading} style={{
        padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: 10,
        color: '#fff', fontSize: 11, fontWeight: 900, cursor: payLoading ? 'not-allowed' : 'pointer',
        opacity: payLoading ? 0.6 : 1, whiteSpace: 'nowrap',
      }}>
        {payLoading ? '⏳ Opening...' : '💳 Renew Now'}
      </button>
    </div>
  );
}

export default function AdvocatePortal({ user, onLogout }) {
  const [view, setView] = useState("command");

  // ── NEW feature state ─────────────────────────────────────────────────────
  // [F10] Tasks per client
  const [clientTasks, setClientTasks] = useState({}); // { slNo: [{id,text,done,dueDate}] }
  const [taskLoadingFor, setTaskLoadingFor] = useState(null);
  // [F10-C7] Fee register
  const [feeRegister, setFeeRegister] = useState({}); // { slNo: [{id,date,desc,charged,received}] }
  const [feeModal, setFeeModal] = useState(null); // client object
  // [F10-C1] Today's priority
  const [todayPriority, setTodayPriority] = useState([]);
  // [F10-C3] Auto file naming
  const [suggestedFileName, setSuggestedFileName] = useState('');
  // [F10-C4] Review checkpoint
  const [reviewCheckpoint, setReviewCheckpoint] = useState(null); // { source, extracted, onConfirm, onEdit }
  // [F03/F10-C5] Intake questionnaire
  const [intakeModal, setIntakeModal] = useState(false);
  const [intakeStep, setIntakeStep] = useState(1);
  const [intakeCaseType, setIntakeCaseType] = useState('Original Suit');
  const [intakeFields, setIntakeFields] = useState({});
  const [intakeDraftLoading, setIntakeDraftLoading] = useState(false);
  // [F06] Court order extractor
  const [extractModal, setExtractModal] = useState(false);
  const [extractClientSlNo, setExtractClientSlNo] = useState(null);
  const [extractLoading, setExtractLoading] = useState(false);
  // [F07/F10-C6] Client message drafter
  const [msgDraftModal, setMsgDraftModal] = useState(null); // client object
  const [msgChannel, setMsgChannel] = useState('whatsapp');
  const [msgLang, setMsgLang] = useState('ml');
  const [msgResult, setMsgResult] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  // [F11] Deadline Engine
  const [deadlineCaseType, setDeadlineCaseType] = useState('os');
  const [deadlineBaseDate, setDeadlineBaseDate] = useState(new Date().toISOString().slice(0,10));
  const [deadlineResults, setDeadlineResults] = useState([]);
  // [F12] Ask the Vault
  const [vaultQuery, setVaultQuery] = useState('');
  const [vaultAnswer, setVaultAnswer] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);
  // [F13] Dictate-to-page
  const [dictateActive, setDictateActive] = useState(false);
  const dictateRecRef = useRef(null);
  // [F15] Insights
  const [insightsData, setInsightsData] = useState(null);
  // [F16] Fee Note
  const [feeNoteModal, setFeeNoteModal] = useState(null); // client object
  const [feeNoteAmount, setFeeNoteAmount] = useState('');
  const [feeNoteWork, setFeeNoteWork] = useState('');
  const [feeNoteHtml, setFeeNoteHtml] = useState('');
  const [feeNoteLoading, setFeeNoteLoading] = useState(false);
  // [F19] Contract review
  const [contractText, setContractText] = useState('');
  const [contractType, setContractType] = useState('contract');
  const [contractReview, setContractReview] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  // [F22] Case brief
  const [caseBriefModal, setCaseBriefModal] = useState(null); // client object
  const [caseBriefResult, setCaseBriefResult] = useState('');
  const [caseBriefLoading, setCaseBriefLoading] = useState(false);
  // [F09] Doc summarise
  const [docSummaryLoading, setDocSummaryLoading] = useState(false);
  const [docSummary, setDocSummary] = useState('');
  // [F08] Watchdog
  const [watchdogFlags, setWatchdogFlags] = useState([]);
  // [F02] Live suggestions refresh
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  // [F05] Clause checker
  const [clauseCheckInput, setClauseCheckInput] = useState('');
  const [clauseCheckResult, setClauseCheckResult] = useState('');
  const [clauseCheckLoading, setClauseCheckLoading] = useState(false);

  // ── Hybrid AI (Online/Offline) ────────────────────────────────────────────
  const {
    isOnline,
    localModelStatus,
    localModelProgress,
    localModelProgressText,
    enableLocalAI,
    disableLocalAI,
    ask: hybridAsk,
    isLocalReady,
  } = useHybridAI();
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    offlineDB.getPendingActions().then(a => setPendingSyncCount(a.length)).catch(() => {});
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && pendingSyncCount > 0) handleSync();
  }, [isOnline]);

  const handleSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      const pending = await offlineDB.getPendingActions();
      if (pending.length > 0) {
        await api.post('/api/sync', { actions: pending });
        await offlineDB.clearSyncQueue();
        setPendingSyncCount(0);
      }
    } catch (e) { console.warn('Sync failed:', e.message); }
    setIsSyncing(false);
  };



  const [clients, setClients] = useState(CLIENTS);
  const [addingClient, setAddingClient] = useState(false);
  const [newClient, setNewClient] = useState({});
  // ── Client Documents ──
  const [clientDocs, setClientDocs] = useState({}); // { slNo: [{id, name, size, type, dataUrl, uploadedAt}] }
  const [clientDocsModal, setClientDocsModal] = useState(null); // client object or null
  const [docsUploadMode, setDocsUploadMode] = useState('file'); // 'file' | 'camera'
  const [docsCamPhase, setDocsCamPhase] = useState('idle'); // idle | starting | live | capturing | done | error
  const [docsCamError, setDocsCamError] = useState('');
  const docsCamVideoRef = useRef(null);
  const docsCamCanvasRef = useRef(null);
  const docsCamStreamRef = useRef(null);
  const docsFileInputRef = useRef(null);
  const [docsDragOver, setDocsDragOver] = useState(false);
  const [docsDeleteTarget, setDocsDeleteTarget] = useState(null); // {clientSlNo, docId, docName}
  const [chatHistory, setChatHistory] = useState([]);
  // ── Voice History Records (in-session only — advocate saves to Google Drive manually) ──
  const [voiceRecords, setVoiceRecords] = useState(VOICE_RECORDS);
  const [activeCallRecord, setActiveCallRecord] = useState(null); // the call record pinned in Consult
  // ── Google Drive integration ──
  const [gdrive, setGdrive] = useState({ connected: false, folderId: null, advocateId: null, folderName: null, subfolders: null, loading: true, saving: false, files: [], filesLoading: false });
  const [gdriveSaveStatus, setGdriveSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [gdriveAutoSaveLog, setGdriveAutoSaveLog] = useState([]); // [{type, filename, ts}]
  const gdriveAutoSaveRef = useRef({ lastConsultLen: 0, lastVoiceCount: 0 });
  // ── Nexus Voice AI (dock) ──
  const [voiceAiOn, setVoiceAiOn] = useState(false);
  const [voiceAiListening, setVoiceAiListening] = useState(false);
  const [voiceAiThinking, setVoiceAiThinking] = useState(false);
  const [voiceAiSpeaking, setVoiceAiSpeaking] = useState(false);
  const [voiceAiTranscript, setVoiceAiTranscript] = useState('');
  const [voiceAiReply, setVoiceAiReply] = useState('');
  const [voiceAiLog, setVoiceAiLog] = useState([]);
  const [camOn, setCamOn] = useState(false);
  // ── Incoming Calls (real telephone integration) ──
  const [calls, setCalls] = useState([]);
  const [activeCall, setActiveCall] = useState(null); // currently ringing call
  const [callsLoading, setCallsLoading] = useState(false);
  const sseRef = useRef(null);
  const dockRecRef = useRef(null);
  const dockSynthRef = useRef(null);
  const voiceAiOnRef = useRef(false); // ref to track voiceAiOn inside callbacks
  const voiceAiTranscriptRef = useRef(''); // ref to avoid stale closure in onReply
  const systemIsBusy = useRef(false); // true when AI is thinking/speaking — blocks mic restart
  const isSpeakingRef = useRef(false); // for stopping sentence-by-sentence reading
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [supportMsgs, setSupportMsgs] = useState([{ id: 1, role: 'ai', text: 'Hello. I am the Nexus Support AI. Please describe any issues you are facing with the platform.' }]);
  const [supportInput, setSupportInput] = useState("");
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  // ── Delete consultation confirm modal ──
  const [showDeleteConsultModal, setShowDeleteConsultModal] = useState(false);
  const [deleteTargetMsg, setDeleteTargetMsg] = useState(null); // null = delete all, or a msg object

  const tabBarRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const checkScroll = useCallback(() => {
    const el = tabBarRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll); };
  }, [view, checkScroll]);
  const scrollTabs = (dir) => { tabBarRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' }); };

  const [kbDocs, setKbDocs] = useState([
    { id: 1, category: 'railway', name: 'Railways Act, 1989.pdf', size: '2.4 MB', date: '2026-01-12', pages: 184 },
    { id: 2, category: 'railway', name: 'Railway Claims Tribunal Rules.pdf', size: '840 KB', date: '2026-01-15', pages: 62 },
    { id: 3, category: 'cooperative', name: 'Kerala Co-operative Societies Act.pdf', size: '1.1 MB', date: '2025-11-20', pages: 96 },
    { id: 4, category: 'property', name: 'Transfer of Property Act, 1882.pdf', size: '960 KB', date: '2025-10-05', pages: 78 },
  ]);
  const [kbFilter, setKbFilter] = useState('all');
  const [kbSearch, setKbSearch] = useState('');
  const [kbUploading, setKbUploading] = useState(false);
  const [kbUploadCat, setKbUploadCat] = useState('railway');
  const [kbUploadName, setKbUploadName] = useState('');
  const [kbDragOver, setKbDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const handleKbUpload = (fileName) => {
    if (!fileName.trim()) return;
    const name = fileName.endsWith('.pdf') ? fileName : fileName + '.pdf';
    setKbDocs(d => [...d, { id: Date.now(), category: kbUploadCat, name, size: `${(Math.random() * 2 + 0.3).toFixed(1)} MB`, date: new Date().toISOString().slice(0, 10), pages: Math.floor(Math.random() * 200 + 20) }]);
    setKbUploadName(''); setKbUploading(false);
  };

  const [tempInstructions, setTempInstructions] = useState([
    { id: 1, text: 'If Raju calls, tell him to meet me tomorrow at 10 AM.', active: true, created: '2026-03-06 09:00' },
    { id: 2, text: 'If my clerk calls, tell him to bring A4 size paper.', active: true, created: '2026-03-06 10:30' },
  ]);
  const [newInstruction, setNewInstruction] = useState('');
  const [instrAiInput, setInstrAiInput] = useState('');
  const [instrAiMsgs, setInstrAiMsgs] = useState([
    { role: 'ai', text: "Hello! I have your temporary instructions loaded. I'll follow them automatically. You can also chat with me here — I'll apply your current active instructions when responding." }
  ]);
  const [instrAiLoading, setInstrAiLoading] = useState(false);
  const activeInstructions = tempInstructions.filter(i => i.active);

  const sendInstrAi = async () => {
    if (!instrAiInput.trim() || instrAiLoading) return;
    const text = instrAiInput.trim(); setInstrAiInput('');
    setInstrAiMsgs(m => [...m, { role: 'user', text }]);
    setInstrAiLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    const lower = text.toLowerCase();
    let reply = '';
    const rajuInstr = tempInstructions.find(i => i.active && i.text.toLowerCase().includes('raju'));
    const clerkInstr = tempInstructions.find(i => i.active && i.text.toLowerCase().includes('clerk'));
    if (lower.includes('raju')) {
      reply = rajuInstr ? `Per your temporary instruction: "${rajuInstr.text}" — I'll inform Raju accordingly. Is there anything else you'd like me to note?` : "No active instruction found for Raju. Would you like to add one?";
    } else if (lower.includes('clerk')) {
      reply = clerkInstr ? `Per your temporary instruction: "${clerkInstr.text}" — Message noted for your clerk. Shall I add any other details?` : "No active instruction found for your clerk.";
    } else {
      reply = `I have ${activeInstructions.length} active instruction${activeInstructions.length !== 1 ? 's' : ''} loaded. ${activeInstructions.length > 0 ? "I'll apply them when relevant. " : ''}For legal queries, please use the Consult module. How else can I help?`;
    }
    setInstrAiMsgs(m => [...m, { role: 'ai', text: reply }]);
    setInstrAiLoading(false);
  };

  // ── Writing Desk state ──
  const MAX_PAGES = 20;
  const CHARS_PER_PAGE = 1800;

  const PAGE1 = `IN THE COURT OF THE DISTRICT JUDGE, ERNAKULAM\n\nO.S. No. 145 of 2025\n\nBETWEEN:\n\nSreedharan K., S/o Krishnan Nair,\nHouse No. 42, near St. George Church, Aluva,\nErnakulam District — 683 101.\n                                                    ... PLAINTIFF\n\nAND\n\nRajan P., S/o Parameswaran Nair,\nHouse No. 43, near St. George Church, Aluva,\nErnakulam District — 683 101.\n                                                    ... DEFENDANT\n\nPLAINT UNDER ORDER VII RULE 1 OF THE CODE OF CIVIL PROCEDURE, 1908`;
  const PAGE2 = `FACTS OF THE CASE:\n\n1. The Plaintiff is the absolute owner in possession of the land bearing Survey Number 101/2 of Aluva Village, measuring 10 Cents, bounded on the North by Survey No. 101/1, on the South by the public road, on the East by Survey No. 102, and on the West by Survey No. 100.\n\n2. The Plaintiff has been in continuous, uninterrupted and peaceful possession of the said property for over 30 years by virtue of a registered Sale Deed dated 15.03.1994 executed by the previous owner.\n\n3. The Defendant, without any right or authority, has illegally encroached upon the Plaintiff's property by constructing a fence along the eastern boundary, thereby reducing the Plaintiff's land area by approximately 2 Cents.\n\n4. The Plaintiff submits that the Defendant's act constitutes illegal encroachment and trespass, causing irreparable loss and damage to the Plaintiff.`;
  const PAGE3 = `CAUSE OF ACTION:\n\n5. The cause of action for this suit arose on 01.01.2026 when the Defendant commenced construction of the illegal fence, and continues to subsist till date.\n\n6. This Hon'ble Court has jurisdiction to try and decide this suit as the suit property is situated within the territorial limits of this Court, and the cause of action arose within the jurisdiction of this Court.\n\nVALUATION:\n\n7. The suit is valued at ₹1,00,000/- for the purpose of court fees and jurisdiction under the Kerala Court Fees and Suits Valuation Act, 1959.\n\nPRAYER:\n\nThe Plaintiff humbly prays that this Hon'ble Court may be pleased to:\n\n(a) Pass a decree for permanent injunction restraining the Defendant;\n(b) Direct removal of the illegal fence erected by the Defendant;\n(c) Award costs of this suit to the Plaintiff;\n(d) Grant any other relief as deemed fit.\n\n                    Sd/-\n              Advocate for Plaintiff`;

  const [draftPages, setDraftPages] = useState([PAGE1, PAGE2, PAGE3]);
  const [currentPage, setCurrentPage] = useState(1);
  const [draftSuggestions, setDraftSuggestions] = useState([
    { id: 1, type: 'add', text: 'Add valuation clause: "The suit is valued at ₹1,00,000/- for the purpose of court fees and jurisdiction."', status: 'pending', line: 'Page 3 — Valuation' },
    { id: 2, type: 'delete', text: 'Remove vague phrase "approximately 2 Cents" — use exact survey measurement from the title deed instead.', status: 'pending', line: 'Page 2 — Para 3' },
    { id: 3, type: 'add', text: 'Add interim injunction prayer under Order XXXIX Rules 1 & 2 CPC as sub-clause (d).', status: 'pending', line: 'Page 3 — Prayer' },
    { id: 4, type: 'edit', text: 'Strengthen paragraph 4 — cite Section 6 of the Specific Relief Act, 1963 for recovery of possession.', status: 'pending', line: 'Page 2 — Para 4' },
  ]);
  const [deskChatHistory, setDeskChatHistory] = useState([
    { role: 'ai', text: "Welcome to the Writing Desk. I've loaded your 3-page draft plaint for OS 145/2025 (up to 20 pages supported — ask me to add more pages anytime).\n\nI've flagged 4 suggestions. You can also:\n• Ask me to read the draft aloud\n• Use voice input to give drafting instructions\n• Navigate pages using the page bar" }
  ]);
  const [deskInput, setDeskInput] = useState('');
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskView, setDeskView] = useState('split');
  const [draftEditMode, setDraftEditMode] = useState(false);
  const [modelDraftDragOver, setModelDraftDragOver] = useState(false);
  const [modelDraftName, setModelDraftName] = useState('');
  const [showModelUpload, setShowModelUpload] = useState(false);
  const [uploadedModels, setUploadedModels] = useState([
    { id: 1, name: 'Model Plaint — Property Encroachment.pdf', date: '2026-01-10' },
    { id: 2, name: 'Model Petition — Interim Injunction.pdf', date: '2026-02-03' },
  ]);
  const modelFileRef = useRef(null);
  const deskChatRef = useRef(null);
  const draftTextRef = useRef(null);

  // ── Live Voice AI — used in all voice areas ────────────────────────────────
  const liveVoice = useLiveVoice({
    onTranscript: (text) => {
      setVoiceAiTranscript(text);
      voiceAiTranscriptRef.current = text;
    },
    onThinking: () => {
      setVoiceAiThinking(true);
      setVoiceAiListening(false);
      systemIsBusy.current = true;
    },
    onReply: (text, source) => {
      setVoiceAiThinking(false);
      setVoiceAiReply(text);
      const userText = voiceAiTranscriptRef.current;
      setVoiceAiLog(l => [...l,
        { role: 'user', text: userText },
        { role: 'ai', text, source }
      ]);
      // Mirror to consult tab
      setChatHistory(h => [...h,
        { role: 'user', text: userText, id: Date.now() },
        { role: 'ai',   text, id: Date.now() + 1 }
      ]);
    },
    onSpeaking: (isSpeaking) => {
      setVoiceAiSpeaking(isSpeaking);
      systemIsBusy.current = isSpeaking;
    },
    onListening: (isListening) => {
      setVoiceAiListening(isListening);
    },
    onError: (msg) => {
      console.warn('LiveVoice error:', msg);
    },
    onDraftReady: (draftText) => {
      // Auto-populate Writing Desk with the AI-generated draft
      setDraftPages([draftText]);
      setCurrentPage(1);
      setView('writing-desk');
    },
    history: voiceAiLog,
    autoRestart: true,
  });

  // ── DRAFTING STATE VARIABLES & HELPERS ──
  const [draftFacts, setDraftFacts] = useState('');
  const [draftModel, setDraftModel] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftCitations, setDraftCitations] = useState([]);
  const [isSearchingCitations, setIsSearchingCitations] = useState(false);
  const [showCitationsDropdown, setShowCitationsDropdown] = useState(false);
  const [citationSearchError, setCitationSearchError] = useState('');
  const [highlightedCitationId, setHighlightedCitationId] = useState(null);
  const [isRewritingDraft, setIsRewritingDraft] = useState(false);
  const [draftEditorMode, setDraftEditorMode] = useState('interactive'); // 'interactive' or 'edit'
  const [activePanel, setActivePanel] = useState(0);
  const [enlargedElement, setEnlargedElement] = useState(null);
  const [showCustomPromptPage, setShowCustomPromptPage] = useState(false);
  const [customPromptText, setCustomPromptText] = useState('');
  const [isCustomPromptProcessing, setIsCustomPromptProcessing] = useState(false);
  const [showAddDirectiveForm, setShowAddDirectiveForm] = useState(false);
  const [newDirectiveName, setNewDirectiveName] = useState('');
  const [newDirectivePrompt, setNewDirectivePrompt] = useState('');
  const draftingContainerRef = useRef(null);

  const [systemDirectives, setSystemDirectives] = useState(() => {
    try {
      const stored = localStorage.getItem('nexus_system_directives');
      return stored ? JSON.parse(stored) : [
        { label: "Kerala High Court Pleading Format", text: "Format this as a formal Writ Petition before the Hon'ble High Court of Kerala. Emphasize appropriate constitutional articles, add boilerplate headers, verification seals, and advocate signing margins." },
        { label: "Civil Injunction Restraint Specifics", text: "Formulate a standard relief of temporary injunction. Anchor it on prime principles: prima facie case, balance of convenience, and irreparable injury." },
        { label: "Highlight Lack Of Mens Rea / Intent", text: "Structure a strong defense emphasizing absolute lack of intention or knowledge. Elaborate the chronology of sequences point-by-point to substantiate lack of culpability." },
        { label: "Formal Show-cause Representation", text: "Prepare a detailed reply to the show-cause notice. Respond in a highly professional, respectful, yet robust legal defense style quoting standard administrative precedents." }
      ];
    } catch (e) {
      return [
        { label: "Kerala High Court Pleading Format", text: "Format this as a formal Writ Petition before the Hon'ble High Court of Kerala. Emphasize appropriate constitutional articles, add boilerplate headers, verification seals, and advocate signing margins." },
        { label: "Civil Injunction Restraint Specifics", text: "Formulate a standard relief of temporary injunction. Anchor it on prime principles: prima facie case, balance of convenience, and irreparable injury." },
        { label: "Highlight Lack Of Mens Rea / Intent", text: "Structure a strong defense emphasizing absolute lack of intention or knowledge. Elaborate the chronology of sequences point-by-point to substantiate lack of culpability." },
        { label: "Formal Show-cause Representation", text: "Prepare a detailed reply to the show-cause notice. Respond in a highly professional, respectful, yet robust legal defense style quoting standard administrative precedents." }
      ];
    }
  });

  const [customDirectives, setCustomDirectives] = useState(() => {
    try {
      const stored = localStorage.getItem('nexus_custom_directives');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveSystemDirectives = (updated) => {
    setSystemDirectives(updated);
    try {
      localStorage.setItem('nexus_system_directives', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const saveCustomDirectives = (updated) => {
    setCustomDirectives(updated);
    try {
      localStorage.setItem('nexus_custom_directives', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToPanel = (panelIndex) => {
    setActivePanel(panelIndex);
    if (draftingContainerRef.current) {
      const el = draftingContainerRef.current;
      const panelWidth = el.clientWidth;
      el.scrollTo({
        left: panelIndex * panelWidth,
        behavior: 'smooth'
      });
    }
  };

  const handleDraftingScroll = (e) => {
    const el = e.currentTarget;
    const panelWidth = el.clientWidth;
    const scrollPos = el.scrollLeft;
    const index = Math.round(scrollPos / panelWidth);
    if (index !== activePanel) {
      setActivePanel(index);
    }
  };

  const parseCitations = (text) => {
    const citations = [];
    const lowercaseText = text.toLowerCase();
    
    if (
      lowercaseText.includes("no_cases_found") || 
      lowercaseText.includes("no case is found now") || 
      lowercaseText.includes("no case find") || 
      lowercaseText.includes("no case found") ||
      text.trim() === ""
    ) {
      return [];
    }

    // Split on [CASE] blocks if present
    if (text.includes("[CASE]")) {
      const caseBlocks = text.split("[CASE]");
      caseBlocks.forEach((block, idx) => {
        if (!block.trim()) return;
        const endIdx = block.indexOf("[END_CASE]");
        const activeBlock = endIdx !== -1 ? block.substring(0, endIdx) : block;
        
        let title = "";
        let court = 'Supreme Court';
        let paragraph = "";
        
        const lines = activeBlock.split("\n");
        lines.forEach(line => {
          const trimmedLine = line.trim().replace(/^\*\*|\*\*$/g, '').trim();
          if (trimmedLine.startsWith("Title:")) {
            title = trimmedLine.substring(6).trim().replace(/^\*\*|\*\*$/g, '').trim();
          } else if (trimmedLine.startsWith("Court:")) {
            const c = trimmedLine.substring(6).trim();
            court = c.toLowerCase().includes("high") ? "High Court" : "Supreme Court";
          } else if (trimmedLine.startsWith("Paragraph:")) {
            paragraph = trimmedLine.substring(10).trim();
          } else if (paragraph && !trimmedLine.startsWith("Title:") && !trimmedLine.startsWith("Court:")) {
            paragraph += "\n" + trimmedLine;
          }
        });
        
        if (title && paragraph) {
          citations.push({
            id: `citation-${idx}-${Date.now()}`,
            title,
            court,
            paragraph: paragraph.trim(),
            selected: false
          });
        }
      });
    }

    // If no block-based parsing succeeded, try markdown-style lists as fallback
    if (citations.length === 0) {
      const lines = text.split("\n");
      let currentTitle = "";
      let currentCourt = 'Supreme Court';
      let currentParagraph = "";

      lines.forEach((line) => {
        const trimmedLine = line.trim().replace(/^[-*#\d.]+\s+/, '').trim(); // Remove list bullet/number
        const cleanLine = trimmedLine.replace(/^\*\*|\*\*$/g, '').trim();
        
        if (cleanLine.toLowerCase().startsWith("title:")) {
          if (currentTitle && currentParagraph) {
            citations.push({
              id: `citation-fb-${citations.length}-${Date.now()}`,
              title: currentTitle,
              court: currentCourt,
              paragraph: currentParagraph,
              selected: false
            });
            currentParagraph = "";
          }
          currentTitle = cleanLine.substring(6).trim();
        } else if (cleanLine.toLowerCase().startsWith("court:")) {
          const val = cleanLine.substring(6).trim();
          currentCourt = val.toLowerCase().includes("high") ? "High Court" : "Supreme Court";
        } else if (cleanLine.toLowerCase().startsWith("paragraph:") || cleanLine.toLowerCase().startsWith("ratio:") || cleanLine.toLowerCase().startsWith("held:")) {
          const labelIndex = cleanLine.indexOf(":");
          currentParagraph = cleanLine.substring(labelIndex + 1).trim();
        } else if (cleanLine && currentTitle) {
          if (currentParagraph) {
            currentParagraph += " " + cleanLine;
          } else {
            currentParagraph = cleanLine;
          }
        }
      });

      if (currentTitle && currentParagraph) {
        citations.push({
          id: `citation-fb-last-${Date.now()}`,
          title: currentTitle,
          court: currentCourt,
          paragraph: currentParagraph,
          selected: false
        });
      }
    }

    return citations;
  };

  const handleAIDrafting = async () => {
    if (!draftFacts.trim() || isDrafting) return;
    setIsDrafting(true);
    setDraftCitations([]);
    setShowCitationsDropdown(false);
    setCitationSearchError('');
    try {
      // 1. Generate core draft text
      const draftRes = await api.post('/api/ai/generate-draft', { draftFacts, draftModel });
      if (!draftRes || !draftRes.data || !draftRes.data.text) {
        throw new Error("Unable to generate draft text.");
      }
      setDraftPages([draftRes.data.text]);

      // 2. Obtain improvement suggestions
      const suggRes = await api.post('/api/ai/draft-suggestions', { draftText: draftRes.data.text });
      if (suggRes && suggRes.data && suggRes.data.text) {
        setDraftSuggestions(suggRes.data.text);
      }

      // 3. Scan case citations (Indian Supreme Court / High Courts)
      setIsSearchingCitations(true);
      try {
        const citRes = await api.post('/api/ai/search-citations', { draftFacts });
        if (citRes && citRes.data && citRes.data.text) {
          const parsed = parseCitations(citRes.data.text);
          setDraftCitations(parsed);
          setShowCitationsDropdown(true); // Automatically reveal the dropdown
        }
      } catch (citErr) {
        console.error("Citations retrieve failed:", citErr);
        setCitationSearchError('Failed to search case citations.');
      } finally {
        setIsSearchingCitations(false);
      }

    } catch (err) {
      console.error("Drafting failed:", err);
      alert(err.message || "An error occurred while generating the legal draft.");
    } finally {
      setIsDrafting(false);
    }
  };

  const toggleCitationSelected = (id) => {
    setDraftCitations(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const handleRewriteWithCitations = async () => {
    const selectedCitations = draftCitations.filter(c => c.selected);
    if (selectedCitations.length === 0) return;
    setIsRewritingDraft(true);
    try {
      const selectedCitationsList = selectedCitations
        .map(c => `- ${c.title} (${c.court}): ${c.paragraph}`)
        .join("\n\n");

      const rewriteRes = await api.post('/api/ai/rewrite-with-citations', {
        draftFacts,
        initialDraft: draftPages[0],
        selectedCitationsList
      });

      if (!rewriteRes || !rewriteRes.data || !rewriteRes.data.text) {
        throw new Error("Failed to rewrite draft with precedents.");
      }

      setDraftPages([rewriteRes.data.text]);

      // Update suggestions for the rewritten draft
      const suggRes = await api.post('/api/ai/draft-suggestions', { draftText: rewriteRes.data.text });
      if (suggRes && suggRes.data && suggRes.data.text) {
        setDraftSuggestions(suggRes.data.text);
      }
    } catch (err) {
      console.error("Failed to rewrite draft with citations:", err);
      alert(err.message || "Failed to rewrite the draft with selected citations.");
    } finally {
      setIsRewritingDraft(false);
    }
  };

  const handleDownloadDraft = (text) => {
    const blob = new Blob([text], { type: 'text/plain' });
    saveAs(blob, `Nexus_Draft_${new Date().getTime()}.txt`);
  };

  const handleDownloadSuggestions = () => {
    if (!draftSuggestions) return;
    const blob = new Blob([draftSuggestions], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `Nexus_Suggestions_${new Date().getTime()}.txt`);
  };

  const handleCustomPromptDrafting = async (target) => {
    if (isCustomPromptProcessing) return;
    setIsCustomPromptProcessing(true);
    setCitationSearchError('');
    
    try {
      const factsText = draftFacts.trim() || "(No facts provided yet)";
      const promptRes = await api.post('/api/ai/custom-drafting', {
        target,
        draftFacts: factsText,
        draftModel,
        customPromptText,
        workbenchDocs: []
      });

      if (!promptRes || !promptRes.data || !promptRes.data.text) {
        throw new Error("Unable to process custom prompt request.");
      }
      
      if (target === 'draft') {
        setDraftPages([promptRes.data.text]);
        
        setIsSearchingCitations(true);
        try {
          const citRes = await api.post('/api/ai/search-citations', { draftFacts: factsText });
          if (citRes && citRes.data && citRes.data.text) {
            const parsed = parseCitations(citRes.data.text);
            setDraftCitations(parsed);
            setShowCitationsDropdown(true);
          }
        } catch (err) {
          console.error("Citations fail under custom prompt:", err);
        } finally {
          setIsSearchingCitations(false);
        }
      } else {
        setDraftSuggestions(promptRes.data.text);
      }
      
      setShowCustomPromptPage(false);
    } catch (err) {
      console.error("Custom prompt drafting failed:", err);
      alert(err.message || "An error occurred during custom drafting execution.");
    } finally {
      setIsCustomPromptProcessing(false);
    }
  };

  const handleJumpToCitation = (id) => {
    setShowCitationsDropdown(true);
    setHighlightedCitationId(id);
    
    setTimeout(() => {
      const el = document.getElementById(`citation-card-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    setTimeout(() => {
      setHighlightedCitationId(null);
    }, 2500);
  };

  const renderDraftWithQuickLinks = (text) => {
    if (!text) return null;
    const activeCitations = draftCitations.filter(c => c.selected);
    if (activeCitations.length === 0) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }

    const sortedCitations = [...activeCitations].sort((a, b) => b.title.length - a.title.length);

    let segments = [{ type: 'text', content: text }];

    sortedCitations.forEach(cit => {
      const nextSegments = [];
      segments.forEach(seg => {
        if (seg.type !== 'text') {
          nextSegments.push(seg);
          return;
        }

        const title = cit.title;
        const escapedTitle = title.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const regex = new RegExp(`(${escapedTitle})`, 'gi');
        
        const parts = seg.content.split(regex);
        parts.forEach((part, i) => {
          if (i % 2 === 1) {
            nextSegments.push({
              type: 'citation',
              content: part,
              citationId: cit.id,
              citationTitle: cit.title
            });
          } else if (part) {
            nextSegments.push({
              type: 'text',
              content: part
            });
          }
        });
      });
      segments = nextSegments;
    });

    return (
      <span className="whitespace-pre-wrap">
        {segments.map((seg, i) => {
          if (seg.type === 'citation') {
            return (
              <span 
                key={i}
                onClick={() => handleJumpToCitation(seg.citationId)}
                className="bg-amber-500/15 border-b border-amber-400 text-amber-400 px-1 font-extrabold cursor-pointer hover:bg-amber-500/25 transition-all rounded"
                title={`Click to jump to citation: ${seg.citationTitle}`}
              >
                {seg.content}
              </span>
            );
          }
          return seg.content;
        })}
      </span>
    );
  };

  const handleCopy = (text) => {
    const textToCopy = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
    navigator.clipboard.writeText(textToCopy);
  };

  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakPageNum, setSpeakPageNum] = useState(null);
  const speechSynthRef = useRef(null);

  // Voice input state
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => { deskChatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, [deskChatHistory]);

  // ── TTS: Read page aloud — uses liveVoice browser TTS (instant, free) ──
  const readPageAloud = (pageIdx) => {
    const text = draftPages[pageIdx] || '';
    if (!text.trim()) return;
    setIsSpeaking(true); setSpeakPageNum(pageIdx + 1);
    liveVoice.speak(text, () => {
      setIsSpeaking(false); setSpeakPageNum(null);
    });
  };
  const stopSpeaking = () => {
    isSpeakingRef.current = false;
    systemIsBusy.current = false;
    liveVoice.stopSpeaking();
    setIsSpeaking(false); setSpeakPageNum(null);
  };

  // ── Voice input (Gemini STT — Multilingual) ──
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Writing Desk mic — Web Speech STT, mobile-hardened
  const deskRecRef = useRef(null);
  const destroyDeskRec = () => {
    if (!deskRecRef.current) return;
    const rec = deskRecRef.current;
    deskRecRef.current = null;
    rec.onstart = null; rec.onresult = null; rec.onerror = null; rec.onend = null;
    try { rec.abort(); } catch {}
  };
  const startVoiceInput = () => {
    // HTTPS required for mic on mobile
    if (!isSecureContext()) { setDeskInput(d => d + ' [HTTPS required for microphone]'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setDeskInput(d => d + ' [Speech not supported on this browser]'); return; }
    // Stop dock voice AI mic first — Android can't share mic between two recognition instances
    if (voiceAiOn) liveVoice.stop();
    destroyDeskRec();
    const rec = new SR();
    rec.continuous = false;       // false required on Android
    rec.interimResults = false;
    rec.lang = detectedLang?.code ? `${detectedLang.code}-IN` : 'en-IN';
    rec.onstart = () => setVoiceListening(true);
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript?.trim();
      if (t) {
        setDeskInput(d => (d + ' ' + t).trim());
        const lang = detectLanguage(t);
        if (lang) setDetectedLang(lang);
      }
      destroyDeskRec();
      setVoiceListening(false);
    };
    rec.onerror = (e) => {
      destroyDeskRec();
      setVoiceListening(false);
    };
    rec.onend = () => {
      if (!deskRecRef.current) return; // already destroyed
      setVoiceListening(false);
    };
    deskRecRef.current = rec;
    try { rec.start(); } catch { destroyDeskRec(); setVoiceListening(false); }
  };
  const stopVoiceInput = () => {
    destroyDeskRec();
    setVoiceListening(false);
  };

  // ── Page management ──
  const addNewPage = () => {
    if (draftPages.length >= MAX_PAGES) return;
    setDraftPages(p => [...p, `PAGE ${p.length + 1}\n\n[Continue drafting here…]`]);
    setCurrentPage(draftPages.length + 1);
  };
  const updatePage = (idx, val) => setDraftPages(p => p.map((pg, i) => i === idx ? val : pg));
  const deletePage = (idx) => {
    if (draftPages.length <= 1) return;
    setDraftPages(p => p.filter((_, i) => i !== idx));
    setCurrentPage(c => Math.min(c, draftPages.length - 1));
  };

  const DESK_AI_REPLIES = [
    (q) => {
      const l = q.toLowerCase();
      if (l.includes('read') || l.includes('aloud') || l.includes('speak')) {
        const pgMatch = l.match(/page\s*(\d+)/);
        const pg = pgMatch ? parseInt(pgMatch[1]) - 1 : currentPage - 1;
        setTimeout(() => readPageAloud(pg), 300);
        return `Reading Page ${pg + 1} aloud now. Click the stop button or say "stop" to pause.`;
      }
      if (l.includes('stop') || l.includes('pause')) { stopSpeaking(); return "Reading stopped."; }
      if (l.includes('add page') || l.includes('new page')) {
        if (draftPages.length >= MAX_PAGES) return `You've reached the 20-page limit. To continue, please start a new draft session.`;
        setTimeout(addNewPage, 300);
        return `Added Page ${draftPages.length + 1}. You can now draft the next section there.`;
      }
      if (l.includes('valuation')) return "Add this to Page 3 after paragraph 7:\n\n\"The suit is valued at ₹1,00,000/- for court fees under the Kerala Court Fees and Suits Valuation Act, 1959. Court fee stamp of ₹[amount] has been affixed.\"\n\nShall I insert this directly?";
      if (l.includes('injunction')) return "For interim injunction (Order XXXIX Rules 1 & 2 CPC), establish:\n\n1. Prima facie case\n2. Balance of convenience favours plaintiff\n3. Irreparable injury if not granted\n\nI recommend a separate I.A. petition. Want me to draft Page 4 as the IA?";
      if (l.includes('prayer') || l.includes('relief')) return "Strengthen the prayer on Page 3 by adding:\n\n(d) Grant ad-interim ex-parte injunction pending disposal;\n(e) Award exemplary damages of ₹50,000/-;\n(f) Grant any other relief as deemed fit.\n\nAccept this update?";
      return `I've reviewed Page ${currentPage} of ${draftPages.length}. Key observations:\n\n• Cause of action is clearly stated\n• Consider adding verification clause on final page\n• Section 6, Specific Relief Act applies to para 4\n\nWhat section would you like me to strengthen?`;
    }
  ];

  const sendDeskChat = async (overrideText) => {
    const text = (overrideText || deskInput).trim();
    if (!text || deskLoading) return;
    setDeskInput('');
    setDeskChatHistory(h => [...h, { role: 'user', text }]);
    setDeskLoading(true);
    try {
      const prompt = `You are a helpful, expert Indian legal document co-drafting assistant.
We are currently working on a legal petition or plaint draft.
The current draft text:
"${draftPages[0] || ''}"

The user asks or instructs: "${text}"

Please provide a highly professional, practical, and helpful answer or recommendation in markdown format. 
If they ask to rewrite or alter words, show the proposed changes or write a complete section they can copy-paste.`;

      const res = await api.post('/api/ai/consult', {
        question: prompt,
        category: 'property',
        history: deskChatHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
      });
      
      const reply = res && res.data && res.data.answer ? res.data.answer : "I couldn't process that request at this moment. Please try again.";
      setDeskChatHistory(h => [...h, { role: 'ai', text: reply }]);
    } catch (err) {
      console.error("Desk chat failed:", err);
      setDeskChatHistory(h => [...h, { role: 'ai', text: "An error occurred while consulting the assistant of this desk." }]);
    } finally {
      setDeskLoading(false);
    }
  };

  const applySuggestion = (id) => setDraftSuggestions(s => s.map(x => x.id === id ? { ...x, status: 'accepted' } : x));
  const rejectSuggestion = (id) => setDraftSuggestions(s => s.map(x => x.id === id ? { ...x, status: 'rejected' } : x));

  const [scanPhase, setScanPhase] = useState('idle'); // idle | live | processing | done | error
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedText, setScannedText] = useState('');
  const [scanError, setScanError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimer = useRef(null);
  const chatRef = useRef(null);
  const supportRef = useRef(null);
  const instrAiRef = useRef(null);

  useEffect(() => { chatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, [chatHistory]);
  useEffect(() => { supportRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, [supportMsgs]);
  useEffect(() => { instrAiRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, [instrAiMsgs]);

  // ── SSE: listen for real-time incoming calls ──
  useEffect(() => {
    const token = localStorage.getItem('nj_token');
    if (!token) return;
    // Load existing call history
    api.get('/api/calls').then(r => setCalls(r.data.calls || [])).catch(() => {});
    // Open SSE stream
    const BASE = import.meta.env.VITE_API_URL || '';
    const es = new EventSource(`${BASE}/api/calls/stream?token=${token}`);
    sseRef.current = es;
    es.addEventListener('call', (e) => {
      const call = JSON.parse(e.data);
      setCalls(prev => {
        const idx = prev.findIndex(c => c._id === call._id);
        if (idx >= 0) { const n = [...prev]; n[idx] = call; return n; }
        return [call, ...prev];
      });
      if (call.status === 'incoming') {
        setActiveCall(call);
        // Flash notification
        setNotifications(n => [{ id: Date.now(), message: `📞 Incoming call from ${call.caller || call.phone}`, date: new Date().toISOString().slice(0,10), read: false, type: 'call' }, ...n]);
        // Voice announce if Voice AI is on
        if (voiceAiOn) voiceSpeak(`Incoming call from ${call.caller || 'unknown caller'}`);
      } else if (call.status === 'ended' || call.status === 'missed') {
        setActiveCall(null);
      }
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  // ── Doc Converter + Translator state ──
  const [convPhase, setConvPhase] = useState('idle'); // idle | starting | live | processing | done | error
  const [convProgress, setConvProgress] = useState(0);
  const [convPages, setConvPages] = useState([]); // array of { dataUrl, text }
  const [convError, setConvError] = useState('');
  const [convAiSummary, setConvAiSummary] = useState('');
  const [convAiLoading, setConvAiLoading] = useState(false);
  const [convExporting, setConvExporting] = useState(false);

  // ── Translator state ──
  const SARVAM_LANGS = [
    { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
    { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം' },
    { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
    { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
    { code: 'kn-IN', label: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'mr-IN', label: 'Marathi', native: 'मराठी' },
    { code: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'pa-IN', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'bn-IN', label: 'Bengali', native: 'বাংলা' },
    { code: 'od-IN', label: 'Odia', native: 'ଓଡ଼ିଆ' },
    { code: 'ur-IN', label: 'Urdu', native: 'اردو' },
  ];
  const [transSourceText, setTransSourceText] = useState('');
  const [transTargetLang, setTransTargetLang] = useState('ml-IN');
  const [transResult, setTransResult] = useState('');
  const [transLoading, setTransLoading] = useState(false);
  const [transError, setTransError] = useState('');
  const [transFallback, setTransFallback] = useState(false);
  const [transTtsLoading, setTransTtsLoading] = useState(false);

  const doTranslate = async () => {
    if (!transSourceText.trim()) return;
    setTransLoading(true); setTransResult(''); setTransError(''); setTransFallback(false);
    try {
      const res = await api.post('/api/ai/translate', { text: transSourceText.trim(), targetLang: transTargetLang });
      setTransResult(res.data.translated);
      setTransFallback(!!res.data.fallback);
    } catch (e) {
      setTransError('Translation failed. Please check your Gemini API key.');
    }
    setTransLoading(false);
  };

  const doTts = () => {
    if (!transResult) return;
    setTransTtsLoading(true);
    liveVoice.speak(transResult, () => setTransTtsLoading(false));
  };

  const useScannedTextForTranslation = () => {
    const text = convPages.map(p => p.text).join('\n\n').trim();
    if (text) { setTransSourceText(text.slice(0, 2000)); setTransResult(''); }
  };
  const convVideoRef = useRef(null);
  const convCanvasRef = useRef(null);
  const convStreamRef = useRef(null);

  const convStartCamera = async () => {
    setConvError(''); setConvPhase('starting');
    try {
      const stream = await startCamera(convVideoRef.current);
      convStreamRef.current = stream;
      setCamOn(true);
      setConvPhase('live');
    } catch (e) {
      setConvError(e.message);
      setConvPhase('error');
      setCamOn(false);
    }
  };

  const convCapturePage = async () => {
    if (!convVideoRef.current || !convCanvasRef.current) return;
    setConvPhase('processing'); setConvProgress(10);
    const video = convVideoRef.current;
    const canvas = convCanvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    // Stop stream right after capture — turns off camera indicator light
    stopCamera(convStreamRef, convVideoRef.current);
    setConvProgress(35);
    try {
      const imageBase64 = dataUrl.split(',')[1];
      setConvProgress(50);
      const res = await api.post('/api/ai/ocr', { imageBase64, mimeType: 'image/jpeg' });
      setConvProgress(90);
      if (res.data.ok && res.data.text) {
        setConvPages(p => [...p, { dataUrl, text: res.data.text, id: Date.now() }]);
        setConvProgress(100); setConvPhase('done'); setCamOn(false);
        return;
      }
      throw new Error(res.data.error || 'Gemini Vision returned no text');
    } catch {
      // Fallback to Tesseract.js
      try {
        if (!window.Tesseract) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        const result = await window.Tesseract.recognize(canvas, 'eng', {
          logger: m => { if (m.status === 'recognizing text') setConvProgress(30 + Math.round(m.progress * 60)); }
        });
        const text = result.data.text.trim();
        setConvPages(p => [...p, { dataUrl, text, id: Date.now() }]);
        setConvProgress(100); setConvPhase('done'); setCamOn(false);
      } catch (e2) {
        setConvError('OCR failed: ' + e2.message); setConvPhase('error'); setCamOn(false);
      }
    }
  };

  const convStopCamera = () => {
    stopCamera(convStreamRef, convVideoRef.current);
    setConvPhase(p => (p === 'done' ? 'done' : 'idle'));
    setCamOn(false);
  };

  const convReset = () => {
    stopCamera(convStreamRef, convVideoRef.current);
    setConvPhase('idle'); setConvPages([]); setConvError(''); setConvAiSummary(''); setConvProgress(0); setCamOn(false);
  };

  const convFinish = () => {
    stopCamera(convStreamRef, convVideoRef.current);
    setConvPhase('done'); setCamOn(false);
  };

  const convAiAnalyse = async () => {
    if (!convPages.length) return;
    setConvAiLoading(true); setConvAiSummary('');
    const fullText = convPages.map((p, i) => `--- Page ${i+1} ---\n${p.text}`).join('\n\n');
    try {
      const res = await api.post('/api/ai/consult', {
        message: `Analyse this scanned legal document and provide: 1) Document type, 2) Key parties involved, 3) Main legal issues, 4) Important dates/sections, 5) Recommended next steps.\n\nDocument text:\n${fullText.slice(0, 3000)}`,
        history: [],
        languageInstruction: LANGUAGE_SYSTEM_INSTRUCTION,
        detectedLanguage: 'auto',
      });
      setConvAiSummary(res.data.reply);
      // Auto-read the AI analysis aloud
      setTimeout(() => {
        liveVoice.speak("AI analysis complete. " + res.data.reply.slice(0, 600));
      }, 300);
    } catch {
      setConvAiSummary('AI analysis unavailable. Please check your API keys.');
    }
    setConvAiLoading(false);
  };

  const convExportTxt = () => {
    const text = convPages.map((p, i) => `=== PAGE ${i+1} ===\n${p.text}`).join('\n\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'converted-document.txt'; a.click();
  };

  // Auto-trigger AI analysis when pages are captured and phase is done
  useEffect(() => {
    if (convPhase === 'done' && convPages.length > 0 && !convAiSummary && !convAiLoading) {
      convAiAnalyse();
    }
  }, [convPhase, convPages.length]);

  // Stop converter camera when leaving view
  useEffect(() => {
    if (view !== 'doc-converter') {
      stopCamera(convStreamRef, convVideoRef.current);
      setConvPhase(p => (p === 'live' || p === 'starting' || p === 'processing') ? 'idle' : p);
      setCamOn(false);
    }
  }, [view]);

  // ── Real Camera + OCR ──
  const startScan = async () => {
    setScanError('');
    setScanPhase('starting');
    try {
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      setScanPhase('live');
      setScanProgress(0);
    } catch (err) {
      setScanError(err.message || 'Camera access denied. Please allow camera permission and try again.');
      setScanPhase('error');
    }
  };

  const captureScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanPhase('processing');
    setScanProgress(10);
    setScannedText('');
    // Draw current video frame onto canvas
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Stop the camera stream now — frame is captured (turns off camera light on mobile)
    stopCamera(streamRef, videoRef.current);
    setScanProgress(35);
    try {
      // Use Gemini Vision for document OCR
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const imageBase64 = dataUrl.split(',')[1];
      setScanProgress(50);
      const res = await api.post('/api/ai/ocr', { imageBase64, mimeType: 'image/jpeg' });
      setScanProgress(90);
      if (res.data.ok && res.data.text) {
        setScannedText(res.data.text);
        setScanProgress(100);
        setScanPhase('done');
        // Auto-speak: send to AI for analysis then read aloud
        setTimeout(() => {
          liveVoice.speak("Document scanned. Reading the extracted text now.", () => {
            liveVoice.speak(res.data.text.slice(0, 1200));
          });
        }, 400);
        return;
      }
      // Gemini Vision failed — fall back to Tesseract
      throw new Error(res.data.error || 'Gemini Vision returned no text');
    } catch (err) {
      // Fallback: Tesseract.js for English
      setScanProgress(40);
      try {
        if (!window.Tesseract) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        const result = await window.Tesseract.recognize(canvas, 'eng', {
          logger: m => { if (m.status === 'recognizing text') setScanProgress(40 + Math.round(m.progress * 55)); }
        });
        const text = result.data.text.trim();
        setScannedText(text || 'No text detected. Try holding the document closer and ensure good lighting.');
        setScanProgress(100);
        setScanPhase('done');
        // Auto-speak the extracted text
        if (text) {
          setTimeout(() => {
            liveVoice.speak("Document scanned. Reading the extracted text now.", () => {
              liveVoice.speak(text.slice(0, 1200));
            });
          }, 400);
        }
      } catch (err2) {
        setScanError('OCR failed: ' + err2.message);
        setScanPhase('error');
      }
    }
  };

  const stopScan = () => {
    stopCamera(streamRef, videoRef.current);
    setScanPhase('idle');
    setScanProgress(0);
    setScanError('');
    setScannedText('');
    setDocSummary('');
  };

  const rescan = () => {
    setScannedText('');
    setScanProgress(0);
    setScanError('');
    setDocSummary('');
    // Always start fresh — mobile cameras don't reliably reuse a stopped stream
    startScan();
  };

  // Stop camera when leaving reading-room view
  useEffect(() => {
    if (view !== 'reading-room') {
      stopCamera(streamRef, videoRef.current);
      setScanPhase('idle');
    }
  }, [view]);

  // ── Markdown Renderer ──
  const renderMarkdown = (text) => {
    if (!text) return '';
    const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const lines = clean.split('\n');
    let html = '';
    let inList = false;
    for (let line of lines) {
      line = line
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e2e8f0;font-weight:700">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="color:#94a3b8">$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(99,102,241,.2);padding:1px 5px;border-radius:3px;font-size:11px;color:#a5b4fc">$1</code>');
      if (/^#{3}\s/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<div style="font-size:12px;font-weight:800;color:#a5b4fc;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.05em">${line.replace(/^#{3}\s/, '')}</div>`;
      } else if (/^#{1,2}\s/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<div style="font-size:14px;font-weight:800;color:#c7d2fe;margin:12px 0 6px;border-bottom:1px solid rgba(99,102,241,.2);padding-bottom:4px">${line.replace(/^#{1,2}\s/, '')}</div>`;
      } else if (/^[\*\-]\s/.test(line)) {
        if (!inList) { html += '<ul style="margin:6px 0;padding-left:16px;list-style:none">'; inList = true; }
        html += `<li style="margin:3px 0;padding-left:4px;position:relative"><span style="color:#6366f1;margin-right:6px">•</span>${line.replace(/^[\*\-]\s/, '')}</li>`;
      } else if (/^\d+\.\s/.test(line)) {
        if (!inList) { html += '<ol style="margin:6px 0;padding-left:20px">'; inList = true; }
        html += `<li style="margin:3px 0">${line.replace(/^\d+\.\s/, '')}</li>`;
      } else if (line.trim() === '') {
        if (inList) { html += inList === 'ol' ? '</ol>' : '</ul>'; inList = false; }
        html += '<div style="height:6px"></div>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<div style="margin:2px 0">${line}</div>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  };

  // ── Language auto-detection ──
  const [detectedLang, setDetectedLang] = useState(null); // { code, label, flag }
  const LANG_PATTERNS = [
    { code: 'ml', label: 'Malayalam', flag: '🇮🇳', pattern: /[\u0D00-\u0D7F]/ },
    { code: 'hi', label: 'Hindi',     flag: '🇮🇳', pattern: /[\u0900-\u097F]/ },
    { code: 'ta', label: 'Tamil',     flag: '🇮🇳', pattern: /[\u0B80-\u0BFF]/ },
    { code: 'te', label: 'Telugu',    flag: '🇮🇳', pattern: /[\u0C00-\u0C7F]/ },
    { code: 'kn', label: 'Kannada',   flag: '🇮🇳', pattern: /[\u0C80-\u0CFF]/ },
    { code: 'bn', label: 'Bengali',   flag: '🇧🇩', pattern: /[\u0980-\u09FF]/ },
    { code: 'gu', label: 'Gujarati',  flag: '🇮🇳', pattern: /[\u0A80-\u0AFF]/ },
    { code: 'pa', label: 'Punjabi',   flag: '🇮🇳', pattern: /[\u0A00-\u0A7F]/ },
    { code: 'mr', label: 'Marathi',   flag: '🇮🇳', pattern: /[\u0900-\u097F]/ },
    { code: 'ar', label: 'Arabic',    flag: '🇦🇪', pattern: /[\u0600-\u06FF]/ },
    { code: 'zh', label: 'Chinese',   flag: '🇨🇳', pattern: /[\u4E00-\u9FFF]/ },
    { code: 'ja', label: 'Japanese',  flag: '🇯🇵', pattern: /[\u3040-\u30FF]/ },
    { code: 'ko', label: 'Korean',    flag: '🇰🇷', pattern: /[\uAC00-\uD7AF]/ },
    { code: 'ru', label: 'Russian',   flag: '🇷🇺', pattern: /[\u0400-\u04FF]/ },
    { code: 'fr', label: 'French',    flag: '🇫🇷', pattern: /\b(bonjour|merci|oui|non|je|vous|nous|est|que|pour|avec|dans|les|des|une|mon|ton|son)\b/i },
    { code: 'es', label: 'Spanish',   flag: '🇪🇸', pattern: /\b(hola|gracias|sí|no|como|para|con|que|por|los|las|una|mi|su|tu|también)\b/i },
    { code: 'de', label: 'German',    flag: '🇩🇪', pattern: /\b(ich|sie|ein|eine|und|ist|das|der|die|den|mit|auf|für|nicht|aber)\b/i },
  ];
  const detectLanguage = (text) => {
    if (!text || text.trim().length < 3) return null;
    for (const lang of LANG_PATTERNS) {
      if (lang.pattern.test(text)) return lang;
    }
    return { code: 'en', label: 'English', flag: '🌐' };
  };

  // Language instruction injected into every AI call
  const LANGUAGE_SYSTEM_INSTRUCTION = `CRITICAL LANGUAGE RULE — READ THIS FIRST BEFORE EVERY RESPONSE:
1. Carefully detect the language of the user's message.
2. Reply ENTIRELY in that same language — not in English unless the user wrote in English.
3. If the user writes in Malayalam, reply fully in Malayalam (including legal terms translated or explained in Malayalam).
4. If the user writes in Hindi, reply fully in Hindi. If Tamil, reply in Tamil. If Arabic, reply in Arabic. And so on for any language.
5. Legal section numbers (e.g. IPC 302, CPC Order XXXIX) may be kept as-is, but all explanations must be in the user's language.
6. Do NOT switch back to English mid-response. Stay in the detected language throughout.
7. If the message is mixed (e.g. English + Malayalam), default to the non-English language for your response.`;
  const cleanForSpeech = (text) => {
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6} /g, '')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // ── Sentence-by-sentence TTS — starts speaking immediately ──────────────
  const speakSentences = async (text, onDone) => {
    if (!text?.trim()) { onDone?.(); return; }
    const sentences = text
      .replace(/([.!?।॥\n])\ */g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 2);
    if (sentences.length === 0) { onDone?.(); return; }
    for (let i = 0; i < sentences.length; i++) {
      if (!voiceAiOnRef.current && i > 0) break;
      if (!systemIsBusy.current && i > 0) break;
      await new Promise(resolve => { voiceSpeak(sentences[i], resolve); });
      await new Promise(r => setTimeout(r, 150));
    }
    onDone?.();
  };

  // voiceSpeak — lightweight browser TTS wrapper (used for call announcements)
  const voiceSpeak = (text, onEnd) => {
    if (!text?.trim()) { onEnd?.(); return; }
    liveVoice.speak(text, onEnd);
  };

  // Parse voice command → action, returns { action, param } or null
  const parseVoiceCommand = (text) => {
    const t = text.toLowerCase().trim();
    // Navigation commands
    if (/\b(go to|open|show|navigate to|switch to)\b/.test(t)) {
      if (/consult|legal|advice|ask/.test(t)) return { action: 'navigate', param: 'consult' };
      if (/command|home|dashboard/.test(t)) return { action: 'navigate', param: 'command' };
      if (/client|case|registry/.test(t)) return { action: 'navigate', param: 'clients' };
      if (/knowledge|law base|documents/.test(t)) return { action: 'navigate', param: 'knowledge-base' };
      if (/instruct|temporary|memo/.test(t)) return { action: 'navigate', param: 'temp-instructions' };
      if (/notif|alert/.test(t)) return { action: 'navigate', param: 'notifications' };
      if (/support|help desk/.test(t)) return { action: 'navigate', param: 'support' };
      if (/read|reading room|scanner|scan|ocr/.test(t)) return { action: 'navigate', param: 'reading-room' };
      if (/convert|document convert/.test(t)) return { action: 'navigate', param: 'doc-converter' };
      if (/writ|draft|desk/.test(t)) return { action: 'navigate', param: 'writing-desk' };
      if (/feed|update|hearing/.test(t)) return { action: 'navigate', param: 'feed' };
    }
    // Direct navigation shortcuts (no verb needed)
    if (/^(consult|legal consult)$/.test(t)) return { action: 'navigate', param: 'consult' };
    if (/^(clients|my clients)$/.test(t)) return { action: 'navigate', param: 'clients' };
    if (/^(feed|news)$/.test(t)) return { action: 'navigate', param: 'feed' };
    if (/^(reading room|scanner)$/.test(t)) return { action: 'navigate', param: 'reading-room' };
    if (/^(writing desk|drafting)$/.test(t)) return { action: 'navigate', param: 'writing-desk' };
    // Start camera (reading room)
    if (/start (the )?camera|open camera|scan document/.test(t)) return { action: 'startCamera', param: null };
    // Start doc converter camera
    if (/convert document|document converter|start convert/.test(t)) return { action: 'startConverter', param: null };
    // Read aloud
    if (/read (it |this |the document |aloud|out loud)?/.test(t) && scannedText) return { action: 'readAloud', param: scannedText };
    // Stop reading
    if (/stop (reading|speaking|talking)|quiet|silence/.test(t)) return { action: 'stopSpeaking', param: null };
    // Add instruction
    const instrMatch = t.match(/add instruction[:\s]+(.+)/);
    if (instrMatch) return { action: 'addInstruction', param: instrMatch[1] };
    // Everything else → ask Consult AI
    return { action: 'askAI', param: text };
  };

  const executeVoiceCommand = async (transcript) => {
    systemIsBusy.current = true;
    setVoiceAiThinking(true);
    setVoiceAiTranscript(transcript);
    voiceAiTranscriptRef.current = transcript;
    const cmd = parseVoiceCommand(transcript);
    let replyText = '';

    if (cmd.action === 'navigate') {
      const labels = { command: 'Command Center', consult: 'Legal Consultant', clients: 'Client Registry', 'knowledge-base': 'Knowledge Base', 'temp-instructions': 'Instructions', notifications: 'Notifications', support: 'Help Desk', 'reading-room': 'Reading Room', 'doc-converter': 'Document Converter', 'writing-desk': 'Writing Desk', feed: 'Feed' };
      setView(cmd.param);
      replyText = `Opening ${labels[cmd.param] || cmd.param}.`;
    } else if (cmd.action === 'startCamera') {
      setView('reading-room');
      setTimeout(() => startScan(), 600);
      replyText = 'Opening Reading Room and starting camera.';
    } else if (cmd.action === 'startConverter') {
      setView('doc-converter');
      setTimeout(() => convStartCamera(), 600);
      replyText = 'Opening Document Converter and starting camera.';
    } else if (cmd.action === 'readAloud') {
      replyText = 'Reading scanned text aloud.';
      setVoiceAiThinking(false);
      setVoiceAiReply(replyText);
      setVoiceAiLog(l => [...l, { role: 'user', text: transcript }, { role: 'ai', text: replyText }]);
      voiceSpeak(cleanForSpeech(cmd.param));
      return;
    } else if (cmd.action === 'stopSpeaking') {
      if (dockSynthRef.current instanceof Audio) {
        dockSynthRef.current.pause();
        dockSynthRef.current.src = '';
      } else {
        window.speechSynthesis?.cancel();
      }
      setVoiceAiSpeaking(false);
      replyText = 'Stopped.';
    } else if (cmd.action === 'addInstruction') {
      setTempInstructions(t => [...t, { id: Date.now(), text: cmd.param, active: true, created: new Date().toLocaleString() }]);
      replyText = `Instruction added: "${cmd.param}"`;
    } else {
      // Ask real AI
      try {
        const history = voiceAiLog.slice(-6).map(m => ({ role: m.role, text: m.text }));
        const lang = detectLanguage(transcript);
        if (lang) setDetectedLang(lang);
        // Hybrid AI: uses local model when offline, cloud when online
        const aiResult = await hybridAsk(transcript, voiceAiLog.slice(-6), {});
        if (aiResult.subscriptionExpired) {
          replyText = '🔒 Subscription expired. Please contact your Agency to renew.';
        } else {
          replyText = aiResult.text;
        }
        // Also populate consult tab
        setChatHistory(h => [...h,
          { role: 'user', text: transcript, id: Date.now() },
          { role: 'ai', text: replyText, id: Date.now() + 1 }
        ]);
      } catch {
        replyText = 'AI service unavailable. Please check your API keys.';
      }
    }

    setVoiceAiThinking(false);
    setVoiceAiReply(replyText);
    setVoiceAiLog(l => [...l, { role: 'user', text: transcript }, { role: 'ai', text: replyText }]);
    systemIsBusy.current = false;
    // After TTS finishes, liveVoice auto-restarts because autoRestart=true in useLiveVoice.
    // Do NOT call startDockListening() here — it's not a user gesture on Android.
    speakSentences(cleanForSpeech(replyText), () => {
      if (voiceAiOnRef.current) {
        // liveVoice will auto-restart via its own internal loop.
        // Nothing needed here — the hook handles it.
      }
    });
  };

  // startDockListening — ONLY call from a direct button onClick (gesture required on Android)
  const startDockListening = () => {
    if (!voiceAiOnRef.current) return;
    // liveVoice.start() is safe here because this function is only called
    // from the dock mic button's onClick (direct user gesture).
    liveVoice.start();
  };

  const toggleVoiceAi = () => {
    if (voiceAiOn) {
      // Turn OFF
      liveVoice.stop();
      voiceAiOnRef.current = false;
      setVoiceAiOn(false);
      setVoiceAiListening(false);
      setVoiceAiSpeaking(false);
      setVoiceAiThinking(false);
      setVoiceAiTranscript('');
      setVoiceAiReply('');
      systemIsBusy.current = false;
    } else {
      // Turn ON — liveVoice.start() MUST be called synchronously here
      // because this is inside an onClick handler (direct user gesture).
      // Do NOT wrap in setTimeout — Android will block mic access.
      setVoiceAiOn(true);
      voiceAiOnRef.current = true;
      setVoiceAiLog([]);
      setVoiceAiReply('Nexus Voice AI ready. Speak your legal question.');
      setVoiceAiTranscript('');
      systemIsBusy.current = false;
      liveVoice.start(); // direct gesture call — no setTimeout
    }
  };

  const sendConsult = async () => {
    if (!consoleInput.trim() || consoleLoading) return;
    const text = consoleInput.trim(); setConsoleInput('');
    const lang = detectLanguage(text);
    if (lang) setDetectedLang(lang);
    const userMsg = { role: 'user', text, id: Date.now() };
    setChatHistory(h => [...h, userMsg]);
    setConsoleLoading(true);
    try {
      const history = chatHistory.map(m => ({ role: m.role, text: m.text }));
      // Use hybridAsk for text queries
      const aiResult = await hybridAsk(text, chatHistory.slice(-6), {});
      const reply = aiResult.subscriptionExpired
        ? '🔒 Subscription expired. Please contact your Agency to renew.'
        : aiResult.text;
      setChatHistory(h => [...h, { role: 'ai', text: reply, id: Date.now(), model: aiResult.model }]);
      // Also speak the reply via live voice
      liveVoice.speakReply(reply);
      setConsoleLoading(false);
      return;
    } catch {}
    // legacy fallback path below — kept for safety
    try {
      const res = await api.post('/api/ai/consult', {
        message: text,
        history,
        callContext: activeCallRecord || null,
        tempInstructions: tempInstructions,
        languageInstruction: LANGUAGE_SYSTEM_INSTRUCTION,
        detectedLanguage: lang?.label || 'auto',
      });
      setChatHistory(h => [...h, { role: 'ai', text: res.data.reply, id: Date.now() }]);
    } catch (e) {
      const errMsg = e.response?.data?.error || 'AI service unavailable. Please check your API keys in Railway environment variables.';
      setChatHistory(h => [...h, { role: 'ai', text: errMsg, id: Date.now() }]);
    }
    setConsoleLoading(false);
  };

  // ── Google Drive helpers ──
  const gdriveCheckStatus = async () => {
    try {
      const res = await api.get('/api/gdrive/status');
      // Backend returns: { connected, folderId, advocateId, folderName, subfolders: { consultations, voiceRecords, drafts, clients } }
      setGdrive(g => ({
        ...g,
        connected: res.data.connected,
        folderId: res.data.folderId,
        advocateId: res.data.advocateId || null,
        folderName: res.data.folderName || null,
        subfolders: res.data.subfolders || null,
        loading: false,
      }));
    } catch { setGdrive(g => ({ ...g, loading: false })); }
  };

  const gdriveConnect = () => {
    api.get('/api/gdrive/auth-url').then(res => {
      const popup = window.open(res.data.url, 'gdrive_auth', 'width=520,height=620,scrollbars=yes');
      const handler = (e) => {
        if (e.data?.type === 'gdrive_connected') {
          // Backend creates Nexus-ADV-{id}/ folder tree automatically on first connect
          setGdrive(g => ({
            ...g,
            connected: true,
            folderId: e.data.folderId,
            advocateId: e.data.advocateId || null,
            folderName: e.data.folderName || null,
            subfolders: e.data.subfolders || null,
          }));
          window.removeEventListener('message', handler);
          popup?.close();
        } else if (e.data?.type === 'gdrive_error') {
          window.removeEventListener('message', handler);
          popup?.close();
        }
      };
      window.addEventListener('message', handler);
    }).catch(() => {});
  };

  const gdriveDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Your existing Drive files will remain.')) return;
    await api.post('/api/gdrive/disconnect');
    setGdrive({ connected: false, folderId: null, loading: false, saving: false, files: [], filesLoading: false });
  };

  const gdriveSave = async (type, data, filename, { silent = false } = {}) => {
    if (!gdrive.connected) return false;
    if (!silent) setGdriveSaveStatus('saving');
    try {
      // Pass subfolderId so backend writes into the correct subfolder (Consultations/, Voice Records/, etc.)
      const subfolderId = gdrive.subfolders?.[type] || null;
      await api.post('/api/gdrive/save', { type, data, filename, subfolderId });
      if (!silent) {
        setGdriveSaveStatus('saved');
        setTimeout(() => setGdriveSaveStatus(null), 3000);
      }
      // Append to auto-save log
      setGdriveAutoSaveLog(l => [{ type, filename, ts: new Date().toLocaleTimeString() }, ...l].slice(0, 20));
      return true;
    } catch {
      if (!silent) {
        setGdriveSaveStatus('error');
        setTimeout(() => setGdriveSaveStatus(null), 3000);
      }
      return false;
    }
  };

  // ── Subfolder key map for display ──
  const SUBFOLDER_LABELS = {
    consultation: { label: 'Consultations', color: '#6366f1', icon: '💬' },
    call_record:  { label: 'Voice Records', color: '#f59e0b', icon: '🎙' },
    draft:        { label: 'Drafts',         color: '#10b981', icon: '📄' },
    client:       { label: 'Client Files',   color: '#8b5cf6', icon: '👤' },
    temp_instructions: { label: 'Instructions', color: '#94a3b8', icon: '📋' },
  };

  const gdriveLoadFiles = async () => {
    if (!gdrive.connected) return;
    setGdrive(g => ({ ...g, filesLoading: true }));
    try {
      const res = await api.get('/api/gdrive/files');
      setGdrive(g => ({ ...g, files: res.data.files || [], filesLoading: false }));
    } catch { setGdrive(g => ({ ...g, filesLoading: false })); }
  };

  const gdriveOpenFolder = async (subfolder) => {
    try {
      // If a specific subfolder key is passed, open that subfolder; else open the root Nexus folder
      const subId = subfolder ? gdrive.subfolders?.[subfolder] : null;
      if (subId) {
        window.open(`https://drive.google.com/drive/folders/${subId}`, '_blank');
        return;
      }
      if (gdrive.folderId) {
        window.open(`https://drive.google.com/drive/folders/${gdrive.folderId}`, '_blank');
        return;
      }
      const res = await api.get('/api/gdrive/folder-url');
      window.open(res.data.url, '_blank');
    } catch { window.open('https://drive.google.com', '_blank'); }
  };

  const gdriveDeleteFile = async (fileId) => {
    if (!window.confirm('Delete this file from your Google Drive?')) return;
    try {
      await api.delete(`/api/gdrive/files/${fileId}`);
      setGdrive(g => ({ ...g, files: g.files.filter(f => f.id !== fileId) }));
    } catch {}
  };

  // Auto-save consultation to Drive when chat has messages
  const gdriveSaveConsultation = (silent = false) => {
    if (!gdrive.connected || chatHistory.length === 0) return;
    const record = activeCallRecord ? `Client: ${activeCallRecord.client}\nDate: ${activeCallRecord.date}\nDuration: ${activeCallRecord.duration}\nSummary: ${activeCallRecord.summary}\n\n` : '';
    const transcript = chatHistory.map(m => `${m.role === 'user' ? 'Advocate' : 'Nexus AI'} [${new Date().toLocaleTimeString()}]:\n${m.text}`).join('\n\n---\n\n');
    const ts = new Date().toISOString().slice(0, 10);
    const clientName = activeCallRecord ? activeCallRecord.client.replace(/\s/g, '_') : 'General';
    gdriveSave('consultation', `${record}CONSULTATION TRANSCRIPT\nDate: ${ts}\n\n${transcript}`,
      `consultation_${clientName}_${ts}.txt`, { silent });
  };

  // ── Auto-save: consultation after every 5 new AI replies ──
  useEffect(() => {
    if (!gdrive.connected) return;
    const aiCount = chatHistory.filter(m => m.role === 'ai').length;
    const last = gdriveAutoSaveRef.current.lastConsultLen;
    if (aiCount > 0 && aiCount % 5 === 0 && aiCount !== last) {
      gdriveAutoSaveRef.current.lastConsultLen = aiCount;
      gdriveSaveConsultation(true); // silent auto-save
    }
  }, [chatHistory, gdrive.connected]);

  // ── Auto-save: new voice record immediately when added ──
  useEffect(() => {
    if (!gdrive.connected || voiceRecords.length === 0) return;
    const prev = gdriveAutoSaveRef.current.lastVoiceCount;
    if (voiceRecords.length > prev) {
      gdriveAutoSaveRef.current.lastVoiceCount = voiceRecords.length;
      const latest = voiceRecords[0];
      if (latest) {
        const content = `VOICE RECORD\nClient: ${latest.client}\nDate: ${latest.date}\nDuration: ${latest.duration}\n\nSummary:\n${latest.summary}`;
        gdriveSave('call_record', content,
          `voice_${latest.client.replace(/\s/g,'_')}_${latest.date.replace(/\//g,'-')}.txt`, { silent: true });
      }
    }
  }, [voiceRecords, gdrive.connected]);

  // ── Manual save draft to Drive ──
  const gdriveSaveDraft = () => {
    if (!gdrive.connected || draftPages.length === 0) return;
    const ts = new Date().toISOString().slice(0, 10);
    const content = draftPages.map((pg, i) => `=== PAGE ${i + 1} ===\n\n${pg}`).join('\n\n');
    gdriveSave('draft', content, `draft_${ts}_${draftPages.length}pages.txt`);
  };

  // ── Client Docs: camera helpers ──
  const docsCamStart = async () => {
    setDocsCamError(''); setDocsCamPhase('starting');
    try {
      const stream = await startCamera(docsCamVideoRef.current);
      docsCamStreamRef.current = stream;
      setDocsCamPhase('live');
    } catch (e) {
      setDocsCamError(e.message || 'Camera access denied. Please allow camera permission.');
      setDocsCamPhase('error');
    }
  };
  const docsCamCapture = async () => {
    if (!docsCamVideoRef.current || !docsCamCanvasRef.current) return;
    setDocsCamPhase('capturing');
    const video = docsCamVideoRef.current;
    const canvas = docsCamCanvasRef.current;
    canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 960;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera(docsCamStreamRef, docsCamVideoRef.current);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const ts = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    const doc = { id: Date.now(), name: `photo_${ts}.jpg`, size: Math.round(dataUrl.length * 0.75 / 1024) + ' KB', type: 'image/jpeg', dataUrl, uploadedAt: new Date().toLocaleString() };
    if (clientDocsModal) {
      setClientDocs(prev => ({ ...prev, [clientDocsModal.slNo]: [...(prev[clientDocsModal.slNo] || []), doc] }));
    }
    setDocsCamPhase('done');
  };
  const docsCamStop = () => {
    stopCamera(docsCamStreamRef, docsCamVideoRef.current);
    setDocsCamPhase('idle');
  };
  const docsHandleFiles = (files) => {
    if (!clientDocsModal || !files?.length) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const doc = { id: Date.now() + Math.random(), name: file.name, size: file.size > 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : Math.round(file.size / 1024) + ' KB', type: file.type, dataUrl: e.target.result, uploadedAt: new Date().toLocaleString() };
        setClientDocs(prev => ({ ...prev, [clientDocsModal.slNo]: [...(prev[clientDocsModal.slNo] || []), doc] }));
      };
      reader.readAsDataURL(file);
    });
  };
  const docsDeleteConfirmed = () => {
    if (!docsDeleteTarget) return;
    setClientDocs(prev => ({ ...prev, [docsDeleteTarget.clientSlNo]: (prev[docsDeleteTarget.clientSlNo] || []).filter(d => d.id !== docsDeleteTarget.docId) }));
    setDocsDeleteTarget(null);
  };
  // Stop camera when modal closes
  useEffect(() => {
    if (!clientDocsModal) { docsCamStop(); setDocsCamPhase('idle'); setDocsCamError(''); setDocsUploadMode('file'); }
  }, [clientDocsModal]);

  // Load Drive status on mount
  useEffect(() => { gdriveCheckStatus(); }, []);

  const sendSupport = async () => {
    if (!supportInput.trim() || supportLoading) return;
    const text = supportInput.trim(); setSupportInput('');
    setSupportMsgs(m => [...m, { id: Date.now(), role: 'user', text }]);
    setSupportLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setSupportMsgs(m => [...m, { id: Date.now() + 1, role: 'ai', text: "I've reviewed your report. This appears to be a session sync issue. Please try clearing your browser cache and refreshing. If it persists, I'll escalate to the admin team within 24 hours." }]);
    setSupportLoading(false);
  };

  const unread = notifications.filter(n => !n.read).length;

  const sideNav = [
    { id: 'command', label: 'Command', icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
    { id: 'feed', label: 'Feed', icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
    { id: 'consult', label: 'Consult', icon: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
    { id: 'clients', label: 'Clients', icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { id: 'knowledge-base', label: 'Knowledge', icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { id: 'temp-instructions', label: 'Instructions', icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
    { id: 'notifications', label: 'Notif.', icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
    { id: 'support', label: 'Support', icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" },
    { id: 'reading-room', label: 'Read', icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
    { id: 'doc-converter', label: 'Convert', icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { id: 'writing-desk', label: 'Writing', icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
    { id: 'deadlines', label: 'Deadlines', icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { id: 'insights', label: 'Insights', icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { id: 'contract-review', label: 'Contract', icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  ];

  // ── [F08] Watchdog — compute risk flags from client state ─────────────────
  useEffect(() => {
    const today = new Date();
    const flags = [];
    clients.forEach(c => {
      if (!c.nextPostingDate) return;
      const hearing = new Date(c.nextPostingDate);
      const daysLeft = Math.ceil((hearing - today) / (1000*60*60*24));
      if (daysLeft >= 0 && daysLeft <= 3) {
        flags.push({ level: 'red', client: c.name, caseNo: c.caseNumber, msg: `Hearing in ${daysLeft} day${daysLeft!==1?'s':''} — ${c.purposeOfPosting}`, slNo: c.slNo });
      } else if (daysLeft > 3 && daysLeft <= 7) {
        flags.push({ level: 'amber', client: c.name, caseNo: c.caseNumber, msg: `Hearing in ${daysLeft} days — ${c.purposeOfPosting}`, slNo: c.slNo });
      }
    });
    setWatchdogFlags(flags);
  }, [clients]);

  // ── [F10-C1] Today's Priority — AI-ranked ─────────────────────────────────
  useEffect(() => {
    const today = new Date();
    const priorities = clients
      .filter(c => c.nextPostingDate)
      .map(c => {
        const days = Math.ceil((new Date(c.nextPostingDate) - today) / (1000*60*60*24));
        return { ...c, daysLeft: days };
      })
      .filter(c => c.daysLeft >= 0 && c.daysLeft <= 14)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3)
      .map(c => ({
        label: c.name,
        caseNo: c.caseNumber,
        daysLeft: c.daysLeft,
        action: c.purposeOfPosting,
        slNo: c.slNo,
        urgency: c.daysLeft <= 3 ? 'red' : c.daysLeft <= 7 ? 'amber' : 'green',
      }));
    setTodayPriority(priorities);
  }, [clients]);

  // ── [F11] Deadline Engine ─────────────────────────────────────────────────
  const computeDeadlines = useCallback(() => {
    const results = calculateDeadlines(deadlineCaseType, deadlineBaseDate);
    setDeadlineResults(results);
  }, [deadlineCaseType, deadlineBaseDate]);
  useEffect(() => { computeDeadlines(); }, [computeDeadlines]);

  // ── [F12] Ask the Vault ────────────────────────────────────────────────────
  const askVault = async () => {
    if (!vaultQuery.trim() || vaultLoading) return;
    setVaultLoading(true); setVaultAnswer('');
    try {
      const res = await api.post('/api/ai/vault-search', { query: vaultQuery, kbDocs });
      setVaultAnswer(res.data.answer || '');
    } catch { setVaultAnswer('Vault search unavailable. Please check your API keys.'); }
    setVaultLoading(false);
  };

  // ── [F13] Dictate-to-page ─────────────────────────────────────────────────
  const startDictate = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (dictateRecRef.current) { try { dictateRecRef.current.abort(); } catch {} }
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-IN';
    rec.onstart = () => setDictateActive(true);
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript?.trim();
      if (t) updatePage(currentPage - 1, (draftPages[currentPage-1] || '') + '\n' + t);
      dictateRecRef.current = null; setDictateActive(false);
    };
    rec.onerror = () => { dictateRecRef.current = null; setDictateActive(false); };
    rec.onend = () => { if (dictateRecRef.current) { dictateRecRef.current = null; setDictateActive(false); } };
    dictateRecRef.current = rec;
    try { rec.start(); } catch { dictateRecRef.current = null; setDictateActive(false); }
  };
  const stopDictate = () => {
    if (dictateRecRef.current) { try { dictateRecRef.current.abort(); } catch {} dictateRecRef.current = null; }
    setDictateActive(false);
  };

  // ── [F02] Live AI Suggestions refresh ────────────────────────────────────
  const refreshSuggestions = async () => {
    if (suggestionsLoading) return;
    setSuggestionsLoading(true);
    try {
      const res = await api.post('/api/ai/suggestions', {
        pageText: draftPages[currentPage-1] || '',
        pageNum: currentPage,
        docType: 'legal document',
      });
      if (res.data.suggestions?.length) {
        const newSuggs = res.data.suggestions.map((s, i) => ({
          id: Date.now() + i,
          type: s.type || 'edit',
          text: s.text,
          status: 'pending',
          line: s.line || `Page ${currentPage}`,
          severity: s.severity || 'advisory',
        }));
        setDraftSuggestions(prev => [
          ...prev.filter(x => x.status !== 'pending'),
          ...newSuggs,
        ]);
      }
    } catch {}
    setSuggestionsLoading(false);
  };

  // ── [F03] Intake → Draft ──────────────────────────────────────────────────
  const INTAKE_FIELDS = {
    'Original Suit': [
      { key: 'plaintiffName', label: "Plaintiff's Full Name" },
      { key: 'defendantName', label: "Defendant's Full Name" },
      { key: 'courtName', label: 'Court Name' },
      { key: 'surveyNumber', label: 'Survey Number (if property)' },
      { key: 'boundaries', label: 'Boundaries (N/S/E/W)' },
      { key: 'encroachmentDate', label: 'Date of Encroachment/Cause' },
      { key: 'reliefSought', label: 'Relief Sought' },
    ],
    'Criminal': [
      { key: 'accusedName', label: "Accused's Full Name" },
      { key: 'firNumber', label: 'FIR Number' },
      { key: 'policeStation', label: 'Police Station' },
      { key: 'sectionCharged', label: 'Sections Charged' },
      { key: 'dateOfArrest', label: 'Date of Arrest' },
      { key: 'groundsForBail', label: 'Grounds for Bail' },
    ],
    'Writ Petition': [
      { key: 'petitionerName', label: "Petitioner's Full Name" },
      { key: 'respondentName', label: 'Respondent(s)' },
      { key: 'grievance', label: 'Grievance / Order Challenged' },
      { key: 'reliefSought', label: 'Relief Sought' },
      { key: 'fundamentalRightViolated', label: 'Fundamental Right Violated' },
    ],
  };

  const submitIntake = async () => {
    setIntakeDraftLoading(true);
    try {
      const res = await api.post('/api/ai/intake-draft', {
        caseType: intakeCaseType,
        fields: intakeFields,
        advocateName: 'Advocate',
        barCouncilNo: '',
      });
      const suggestedName = `${intakeCaseType.split(' ')[0]}-${new Date().getFullYear()}-${(intakeFields.plaintiffName || intakeFields.petitionerName || intakeFields.accusedName || 'Unknown').split(' ')[0]}`;
      setReviewCheckpoint({
        source: Object.entries(intakeFields).map(([k,v]) => `${k}: ${v}`).join('\n'),
        extracted: res.data.draft,
        label: 'AI Draft Preview',
        onConfirm: () => {
          setDraftPages([res.data.draft]);
          setCurrentPage(1);
          setSuggestedFileName(suggestedName);
          setView('writing-desk');
          setIntakeModal(false);
          setIntakeFields({});
          setIntakeStep(1);
          setReviewCheckpoint(null);
        },
        onEdit: (edited) => {
          setDraftPages([edited]);
          setCurrentPage(1);
          setView('writing-desk');
          setIntakeModal(false);
          setIntakeFields({});
          setIntakeStep(1);
          setReviewCheckpoint(null);
        },
      });
    } catch { alert('Draft generation failed. Check API keys.'); }
    setIntakeDraftLoading(false);
  };

  // ── [F06] Court Order Extractor ───────────────────────────────────────────
  const extractFromOrder = async () => {
    if (!scannedText || extractLoading) return;
    setExtractLoading(true);
    try {
      const res = await api.post('/api/ai/extract-order', { ocrText: scannedText });
      const data = res.data.data;
      setReviewCheckpoint({
        source: scannedText.slice(0, 600),
        extracted: `Hearing Date: ${data.hearingDate || 'Not found'}\nCourt: ${data.courtName || 'Not found'}\nCase No: ${data.caseNumber || 'Not found'}\nDirective: ${data.directive || ''}\nNext Steps: ${data.nextSteps || ''}`,
        label: 'Extracted from Court Order',
        onConfirm: () => {
          if (extractClientSlNo && data.hearingDate) {
            setClients(cl => cl.map(c => c.slNo === extractClientSlNo
              ? { ...c, nextPostingDate: data.hearingDate, purposeOfPosting: data.directive || c.purposeOfPosting }
              : c
            ));
          }
          setExtractModal(false);
          setReviewCheckpoint(null);
        },
        onEdit: () => { setExtractModal(false); setReviewCheckpoint(null); },
      });
    } catch { alert('Extraction failed.'); }
    setExtractLoading(false);
  };

  // ── [F07] Client Message ──────────────────────────────────────────────────
  const generateClientMessage = async (client, channel, lang) => {
    setMsgLoading(true); setMsgResult('');
    try {
      const res = await api.post('/api/ai/client-message', {
        clientName: client.name,
        caseNumber: client.caseNumber,
        courtName: client.courtName,
        nextDate: client.nextPostingDate,
        purpose: client.purposeOfPosting,
        channel, language: lang,
      });
      setMsgResult(res.data.message || '');
    } catch { setMsgResult('Message generation failed. Please try again.'); }
    setMsgLoading(false);
  };

  // ── [F09] Reading Room summarise ──────────────────────────────────────────
  const summariseDocument = async () => {
    if (!scannedText || docSummaryLoading) return;
    setDocSummaryLoading(true); setDocSummary('');
    try {
      const res = await api.post('/api/ai/summarise-doc', { text: scannedText });
      setDocSummary(res.data.summary || '');
      liveVoice.speak('Summary ready. ' + (res.data.summary || '').slice(0, 400));
    } catch { setDocSummary('Summarisation failed. Please try again.'); }
    setDocSummaryLoading(false);
  };

  // ── [F10] Load/save tasks ─────────────────────────────────────────────────
  const loadTasksForClient = async (slNo) => {
    try {
      const tasks = await offlineDB.getTasksForClient(slNo);
      setClientTasks(prev => ({ ...prev, [slNo]: tasks }));
    } catch {}
  };
  const toggleTask = async (slNo, taskId) => {
    const tasks = clientTasks[slNo] || [];
    const updated = tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
    setClientTasks(prev => ({ ...prev, [slNo]: updated }));
    const task = updated.find(t => t.id === taskId);
    if (task) await offlineDB.saveTask(task);
  };
  const addTask = async (slNo, text) => {
    const task = { clientSlNo: slNo, text, done: false, dueDate: null };
    const id = await offlineDB.addTask(task);
    const newTask = { ...task, id };
    setClientTasks(prev => ({ ...prev, [slNo]: [...(prev[slNo] || []), newTask] }));
  };
  const deleteTask = async (slNo, taskId) => {
    setClientTasks(prev => ({ ...prev, [slNo]: (prev[slNo] || []).filter(t => t.id !== taskId) }));
    await offlineDB.deleteTask(taskId);
  };
  const suggestTasks = async (client) => {
    setTaskLoadingFor(client.slNo);
    try {
      const res = await api.post('/api/ai/suggest-tasks', {
        caseType: client.purposeOfPosting || 'General',
        caseNumber: client.caseNumber,
        nextDate: client.nextPostingDate,
        purpose: client.purposeOfPosting,
      });
      if (res.data.tasks?.length) {
        for (const t of res.data.tasks) await addTask(client.slNo, t.text);
        await loadTasksForClient(client.slNo);
      }
    } catch {}
    setTaskLoadingFor(null);
  };

  // ── [F10-C7] Fee Register ─────────────────────────────────────────────────
  const addFeeEntry = async (slNo, entry) => {
    const id = await offlineDB.addFeeEntry({ ...entry, clientSlNo: slNo });
    const newEntry = { ...entry, id, clientSlNo: slNo };
    setFeeRegister(prev => ({ ...prev, [slNo]: [...(prev[slNo] || []), newEntry] }));
  };
  const loadFeeRegister = async (slNo) => {
    try {
      const entries = await offlineDB.getFeeEntriesForClient(slNo);
      setFeeRegister(prev => ({ ...prev, [slNo]: entries }));
    } catch {}
  };

  // ── [F16] Fee Note ────────────────────────────────────────────────────────
  const generateFeeNote = async (client) => {
    if (!feeNoteAmount) return;
    setFeeNoteLoading(true);
    try {
      const res = await api.post('/api/ai/fee-note', {
        advocateName: 'Advocate',
        barCouncilNo: '',
        clientName: client.name,
        caseNumber: client.caseNumber,
        courtName: client.courtName,
        workDone: feeNoteWork || client.purposeOfPosting,
        amount: feeNoteAmount,
      });
      setFeeNoteHtml(res.data.html || '');
    } catch {}
    setFeeNoteLoading(false);
  };

  // ── [F22] Case Brief ──────────────────────────────────────────────────────
  const generateCaseBrief = async (client) => {
    setCaseBriefLoading(true); setCaseBriefResult('');
    try {
      const chatSummary = chatHistory.filter(m => m.role === 'ai').slice(-3).map(m => m.text).join(' ');
      const res = await api.post('/api/ai/case-brief', {
        clientName: client.name,
        caseNumber: client.caseNumber,
        courtName: client.courtName,
        purpose: client.purposeOfPosting,
        notes: '',
        chatSummary,
      });
      setCaseBriefResult(res.data.brief || '');
    } catch { setCaseBriefResult('Brief generation failed.'); }
    setCaseBriefLoading(false);
  };

  // ── [F10-C3] Auto file name on new client ─────────────────────────────────
  const generateFileName = (client) => {
    const type = (client.caseNumber || '').split('/')[0] || 'CASE';
    const year = (client.nextPostingDate || new Date().getFullYear().toString()).slice(0,4);
    const surname = (client.name || 'Unknown').split(' ').pop();
    const court = (client.courtName || '').split(',')[0].replace(/\s+/g,'').slice(0,10);
    return `${type}-${year}-${surname}-${court}`;
  };

  // ── [F15] Load insights ───────────────────────────────────────────────────
  const loadInsights = async () => {
    try {
      const res = await api.get('/api/advocate/insights');
      setInsightsData(res.data.advocate || {});
    } catch { setInsightsData({}); }
  };
  useEffect(() => { if (view === 'insights') loadInsights(); }, [view]);

  // ── [F19] Contract Review ─────────────────────────────────────────────────
  const runContractReview = async () => {
    if (!contractText.trim() || contractLoading) return;
    setContractLoading(true); setContractReview(null);
    try {
      const res = await api.post('/api/ai/contract-review', { contractText, documentType: contractType });
      setContractReview(parseReviewResponse(res.data.review || ''));
    } catch { setContractReview({ overall: 'ERROR', clauses: [], fullText: 'Review failed. Check API keys.' }); }
    setContractLoading(false);
  };

  const S = {
    page: { display: 'flex', height: 'calc(var(--vh, 1vh) * 100)', background: '#020617', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden', fontSize: 14 },
    sidebar: { width: 72, background: '#070b14', borderRight: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 8, flexShrink: 0, overflowY: 'auto' },
    sideBtn: (active) => ({ width: 44, height: 44, borderRadius: 12, background: active ? 'rgba(245,158,11,.1)' : 'transparent', border: active ? '1px solid rgba(245,158,11,.25)' : '1px solid transparent', color: active ? '#f59e0b' : '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'all .2s', flexShrink: 0 }),
    header: { height: 56, background: '#0a0f1d', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 },
    card: { background: '#0a0f1d', borderRadius: 24, padding: 28, border: '1px solid rgba(255,255,255,.05)' },
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse2{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes scanLine{0%,100%{top:0%}50%{top:95%}}
        @keyframes waveBar{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}
        .fade-up{animation:fadeUp .35s ease forwards}
        .spin{animation:spin 1s linear infinite}
        .pulse-a{animation:pulse2 2s ease-in-out infinite}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,.4);border-radius:4px}
        input,textarea,select{color:#e2e8f0;outline:none}
        input::placeholder,textarea::placeholder{color:#475569}
        .tab-scroll::-webkit-scrollbar{display:none}
        button:focus{outline:none}
        .kb-drop{border:2px dashed rgba(99,102,241,.3);border-radius:20px;transition:all .2s}
        .kb-drop.over{border-color:#6366f1;background:rgba(99,102,241,.05)}
        .instr-card{transition:all .2s}
        .instr-card:hover{border-color:rgba(245,158,11,.2)!important}
        .tab-arrow-btn{width:28px;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(7,11,20,0.95);border:none;cursor:pointer;flex-shrink:0;transition:all .15s}
        .tab-arrow-btn:hover{background:#0a0f1d}
        .tab-arrow-btn:disabled{opacity:0.2;cursor:default}
        .suggestion-card{transition:all .25s;cursor:default}
        .suggestion-card:hover{transform:translateY(-1px)}
        .draft-textarea{font-family:'Courier New',monospace;line-height:1.9;resize:none;width:100%;height:100%;background:transparent;border:none;color:#cbd5e1;font-size:12.5px;padding:0;box-sizing:border-box}
        .draft-textarea:focus{outline:none}
        .model-drop{border:2px dashed rgba(245,158,11,.25);border-radius:16px;transition:all .2s;cursor:pointer}
        .model-drop:hover,.model-drop.over{border-color:#f59e0b;background:rgba(245,158,11,.04)}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        /* ── Mobile scroll fix — iOS momentum scrolling ── */
        [style*="overflow"]{-webkit-overflow-scrolling:touch}
        /* ── Prevent iOS tap highlight on buttons ── */
        button,a{-webkit-tap-highlight-color:transparent}
        /* ── Prevent text resize on orientation change (iOS) ── */
        html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
        /* ── Safe area padding for notch/home indicator ── */
        .dock-safe{padding-bottom:env(safe-area-inset-bottom,0px)}
      `}</style>
      {!isSecureContext() && (
        <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:10000, background:"#dc2626", color:"#fff", padding:"8px 20px", fontSize:11, fontWeight:700, textAlign:"center" }}>
          ⚠ Camera &amp; Microphone require HTTPS — access via https://
        </div>
      )}

      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={{ width: 44, height: 44, background: '#f59e0b', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 12, boxShadow: '0 4px 20px rgba(245,158,11,.3)', flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#000', fontStyle: 'italic' }}>T</span>
        </div>
        {sideNav.map(item => (
          <button key={item.id} onClick={() => setView(item.id)} title={item.label} style={S.sideBtn(view === item.id)}>
            <Icon path={item.icon} size={18} />
            {view === item.id && <div style={{ position: 'absolute', left: 0, width: 3, height: 22, background: '#f59e0b', borderRadius: '0 3px 3px 0' }} />}
            {item.id === 'notifications' && unread > 0 && <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />}
            {item.id === 'temp-instructions' && activeInstructions.length > 0 && (
              <div style={{ position: 'absolute', top: 4, right: 4, background: '#f59e0b', color: '#000', borderRadius: 10, fontSize: 8, fontWeight: 900, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {activeInstructions.length}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeInstructions.length > 0 && (
              <button onClick={() => setView('temp-instructions')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 20, cursor: 'pointer' }}>
                <Icon path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={12} strokeWidth={2} />
                <span style={{ fontSize: 9, fontWeight: 900, color: '#f59e0b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{activeInstructions.length} Active Instr.</span>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>Nexus Justice <span style={{ color: '#6366f1' }}>v3.1</span></span>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)' }} />
            <div style={{ padding: '4px 12px', background: 'rgba(255,255,255,.05)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pulse-a" style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
              <span style={{ fontSize: 9, fontWeight: 900, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Ready</span>
            </div>
          </div>
        </header>

        {/* Tab bar */}
        <div style={{ background: '#070b14', borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <button className="tab-arrow-btn" disabled={!canScrollLeft} onClick={() => scrollTabs(-1)} style={{ color: canScrollLeft ? '#94a3b8' : '#1e293b', borderRight: '1px solid rgba(255,255,255,.05)', zIndex: 2 }}>
            <Icon path="M15 19l-7-7 7-7" size={14} strokeWidth={2.5} />
          </button>
          <div ref={tabBarRef} className="tab-scroll" style={{ flex: 1, display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 4px' }}>
            {sideNav.map(item => (
              <button key={item.id} onClick={() => setView(item.id)}
                style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: view === item.id ? '2px solid #6366f1' : '2px solid transparent', color: view === item.id ? '#6366f1' : '#475569', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .2s', flexShrink: 0, position: 'relative' }}>
                {item.label}
                {item.id === 'notifications' && unread > 0 && <span style={{ position: 'absolute', top: 8, right: 6, width: 5, height: 5, borderRadius: '50%', background: '#ef4444' }} />}
                {item.id === 'temp-instructions' && activeInstructions.length > 0 && <span style={{ position: 'absolute', top: 6, right: 4, background: '#f59e0b', color: '#000', borderRadius: 8, fontSize: 8, fontWeight: 900, padding: '1px 4px' }}>{activeInstructions.length}</span>}
              </button>
            ))}
          </div>
          <button className="tab-arrow-btn" disabled={!canScrollRight} onClick={() => scrollTabs(1)} style={{ color: canScrollRight ? '#94a3b8' : '#1e293b', borderLeft: '1px solid rgba(255,255,255,.05)', zIndex: 2 }}>
            <Icon path="M9 5l7 7-7 7" size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#020617' }}>

          {/* COMMAND */}
          {view === 'command' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Legal Command Centre</div>
                <h2 style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em', margin: 0 }}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, <span style={{ color: '#f59e0b' }}>{user?.name?.split(' ')[0] || 'Advocate'}</span></h2>
              </div>

              {/* [F10-C1] Today's Priority */}
              {todayPriority.length > 0 && (
                <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,.3)' }}>
                  <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12, display:'flex', alignItems:'center', gap:6 }}>
                    <span>⚡</span> Today's Priority — AI Ranked
                  </div>
                  {todayPriority.map((p, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:`rgba(${p.urgency==='red'?'239,68,68':p.urgency==='amber'?'245,158,11':'16,185,129'},.05)`, border:`1px solid rgba(${p.urgency==='red'?'239,68,68':p.urgency==='amber'?'245,158,11':'16,185,129'},.15)`, borderRadius:12, marginBottom:8 }}>
                      <div style={{ width:32, height:32, borderRadius:9, background:`rgba(${p.urgency==='red'?'239,68,68':p.urgency==='amber'?'245,158,11':'16,185,129'},.1)`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:p.urgency==='red'?'#ef4444':p.urgency==='amber'?'#f59e0b':'#10b981', flexShrink:0 }}>{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:12 }}>{p.label} <span style={{ color:'#475569', fontWeight:400 }}>· {p.caseNo}</span></div>
                        <div style={{ fontSize:10, color:'#475569', marginTop:2 }}>{p.action} · {p.daysLeft === 0 ? 'TODAY' : `${p.daysLeft} day${p.daysLeft!==1?'s':''} away`}</div>
                      </div>
                      <button onClick={() => setView('clients')} style={{ padding:'5px 12px', background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.2)', borderRadius:8, color:'#818cf8', fontSize:9, fontWeight:900, cursor:'pointer' }}>Go →</button>
                    </div>
                  ))}
                </div>
              )}

              {/* [F08] Watchdog */}
              {watchdogFlags.length > 0 && (
                <div style={{ ...S.card, marginBottom: 16, borderColor:'rgba(239,68,68,.2)' }}>
                  <div style={{ fontSize:9, color:'#ef4444', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                    <span>🛡</span> Nexus Watchdog — Risk Flags
                  </div>
                  {watchdogFlags.map((f, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 13px', background:`rgba(${f.level==='red'?'239,68,68':'245,158,11'},.05)`, border:`1px solid rgba(${f.level==='red'?'239,68,68':'245,158,11'},.15)`, borderRadius:11, marginBottom:6 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:f.level==='red'?'#ef4444':'#f59e0b', flexShrink:0 }} />
                      <div style={{ flex:1, fontSize:11, color:'#e2e8f0' }}><strong>{f.client}</strong> · {f.caseNo}</div>
                      <div style={{ fontSize:10, color:f.level==='red'?'#f87171':'#f59e0b' }}>{f.msg}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
                {[
                  ['Active Cases', clients.length, '#6366f1'],
                  ['This Week', clients.filter(c => { const d = Math.ceil((new Date(c.nextPostingDate)-new Date())/(86400000)); return d>=0&&d<=7; }).length, '#f59e0b'],
                  ['AI Chats', chatHistory.filter(m=>m.role==='ai').length, '#10b981'],
                  ['Drafts', draftPages.filter(p=>p?.trim().length>50).length, '#8b5cf6'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ ...S.card, textAlign:'center' }}>
                    <div style={{ fontSize:32, fontWeight:900, color, marginBottom:4 }}>{val}</div>
                    <div style={{ fontSize:10, color:'#475569', fontWeight:700 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{ ...S.card, marginBottom:16 }}>
                <div style={{ fontSize:9, color:'#f59e0b', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:12 }}>Quick Actions</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <button onClick={() => setIntakeModal(true)} style={{ padding:'8px 16px', background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.2)', borderRadius:10, color:'#818cf8', fontSize:10, fontWeight:900, cursor:'pointer' }}>📋 New Case Intake</button>
                  <button onClick={() => setView('deadlines')} style={{ padding:'8px 16px', background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.2)', borderRadius:10, color:'#f59e0b', fontSize:10, fontWeight:900, cursor:'pointer' }}>📅 Deadline Calculator</button>
                  <button onClick={() => setView('contract-review')} style={{ padding:'8px 16px', background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:10, color:'#10b981', fontSize:10, fontWeight:900, cursor:'pointer' }}>📄 Contract Review</button>
                  <button onClick={() => setView('insights')} style={{ padding:'8px 16px', background:'rgba(139,92,246,.1)', border:'1px solid rgba(139,92,246,.2)', borderRadius:10, color:'#a78bfa', fontSize:10, fontWeight:900, cursor:'pointer' }}>📊 Insights</button>
                </div>
              </div>

              {/* Upcoming Hearings */}
              <div style={{ ...S.card }}>
                <div style={{ fontSize:9, color:'#f59e0b', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:12 }}>Upcoming Hearings</div>
                {clients
                  .filter(c => c.nextPostingDate)
                  .sort((a,b) => new Date(a.nextPostingDate) - new Date(b.nextPostingDate))
                  .slice(0, 6)
                  .map((c, i) => {
                    const days = Math.ceil((new Date(c.nextPostingDate)-new Date())/(86400000));
                    const col = days < 0 ? '#475569' : days <= 3 ? '#ef4444' : days <= 7 ? '#f59e0b' : '#10b981';
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < 5 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:`rgba(${days<=3?'239,68,68':days<=7?'245,158,11':'16,185,129'},.08)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ fontSize:10, fontWeight:900, color:col }}>{days < 0 ? 'PAST' : days === 0 ? 'TODAY' : `${days}d`}</span>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:12 }}>{c.name}</div>
                          <div style={{ fontSize:10, color:'#475569' }}>{c.caseNumber} · {c.purposeOfPosting}</div>
                        </div>
                        <div style={{ fontSize:11, color:col, fontWeight:700 }}>{c.nextPostingDate}</div>
                      </div>
                    );
                  })}
                {clients.length === 0 && <div style={{ fontSize:12, color:'#334155', textAlign:'center', padding:'20px 0' }}>No clients yet. Add your first case in the Clients tab.</div>}
              </div>
            </div>
          )}

          {/* FEED */}
          {view === 'feed' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: 24, display: 'flex', gap: 20 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={S.card}>
                  <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 16 }}>Upcoming Hearings</div>
                  {clients.slice(0, 3).map(c => (
                    <div key={c.slNo} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{c.name[0]}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{c.caseNumber} · {c.courtName}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>{c.nextPostingDate}</div>
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{c.purposeOfPosting}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={S.card}>
                  <div style={{ fontSize: 9, color: '#10b981', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 16 }}>Recent Consultations</div>
                  {VOICE_RECORDS.map(r => (
                    <div key={r.id} style={{ padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{r.client}</span>
                        <span style={{ fontSize: 10, color: '#475569' }}>{r.date} · {r.duration}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: 0 }}>{r.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={S.card}>
                  <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 12 }}>Quick Stats</div>
                  {[['Active Cases', clients.length, '#6366f1'], ['Upcoming (7d)', 2, '#f59e0b'], ['AI Consultations', 12, '#10b981'], ['KB Documents', kbDocs.length, '#8b5cf6']].map(([label, val, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CONSULT */}
          {view === 'consult' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 24, gap: 12, overflow: 'hidden' }}>

              {/* Top status bars */}
              {activeInstructions.length > 0 && (
                <div style={{ background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <Icon path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={14} strokeWidth={2} />
                  <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>{activeInstructions.length} temporary instruction{activeInstructions.length > 1 ? 's' : ''} active — AI will follow them automatically.</span>
                </div>
              )}
              {(camOn || voiceAiOn) && (
                <div className="fade-up" style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {camOn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', animation: 'pulse2 1s infinite' }} />
                      <span style={{ fontSize: 10, color: '#818cf8', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Camera Active</span>
                      <button onClick={() => { setCamOn(false); convStopCamera(); }} style={{ marginLeft: 4, fontSize: 9, color: '#ef4444', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontWeight: 700 }}>Stop</button>
                    </div>
                  )}
                  {camOn && voiceAiOn && <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.1)' }} />}
                  {voiceAiOn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: voiceAiListening ? '#ef4444' : '#10b981', animation: 'pulse2 .8s infinite' }} />
                      <span style={{ fontSize: 10, color: voiceAiListening ? '#f87171' : '#10b981', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        {voiceAiListening ? 'Mic Listening…' : voiceAiThinking ? 'AI Thinking…' : voiceAiSpeaking ? 'AI Speaking…' : 'Mic Ready'}
                      </span>
                    </div>
                  )}
                  <div style={{ marginLeft: 'auto', fontSize: 10, color: '#334155', fontWeight: 700 }}>
                    {camOn && voiceAiOn ? 'Camera & mic active — consultation in progress' : camOn ? 'Camera active' : 'Voice AI active — speak to ask legal questions'}
                  </div>
                </div>
              )}

              {/* Main split layout */}
              <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>

                {/* LEFT PANEL — Call Record / Voice History */}
                <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

                  {/* Active pinned call record */}
                  {activeCallRecord ? (
                    <div className="fade-up" style={{ background: '#0a0f1d', borderRadius: 20, border: '1px solid rgba(99,102,241,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 0 30px rgba(99,102,241,.08)' }}>
                      {/* Record header */}
                      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ fontSize: 8, color: '#6366f1', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Active Call Record</div>
                          <button
                            onClick={() => setActiveCallRecord(null)}
                            title="Close this record"
                            style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>{activeCallRecord.client}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: '#475569' }}>{activeCallRecord.date}</span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#334155', display: 'inline-block' }} />
                          <span style={{ fontSize: 10, color: '#475569' }}>{activeCallRecord.duration}</span>
                        </div>
                      </div>
                      {/* Transcript / summary */}
                      <div style={{ padding: '14px 18px', flex: 1 }}>
                        <div style={{ fontSize: 8, color: '#475569', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Call Summary</div>
                        <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.75, margin: 0 }}>{activeCallRecord.summary}</p>
                      </div>
                      {/* Action buttons */}
                      <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,.05)', display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => {
                            const prompt = `I have a call record for client ${activeCallRecord.client} (${activeCallRecord.date}, ${activeCallRecord.duration}).\n\nCall Summary: ${activeCallRecord.summary}\n\nPlease analyse this case and advise on legal strategy, applicable sections of law, and recommended next steps.`;
                            setConsoleInput(prompt);
                            setTimeout(() => document.querySelector('[data-consult-input]')?.focus(), 100);
                          }}
                          style={{ flex: 1, padding: '9px 0', background: '#6366f1', border: 'none', borderRadius: 10, color: '#fff', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ⚡ Ask AI about this
                        </button>
                        <button
                          onClick={() => {
                            if (activeCallRecord.id) {
                              setVoiceRecords(v => v.filter(x => x.id !== activeCallRecord.id));
                            } else {
                              setCalls(p => p.filter(x => x._id !== activeCallRecord._id));
                            }
                            setActiveCallRecord(null);
                          }}
                          title="Delete this record permanently"
                          style={{ padding: '9px 14px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 10, color: '#f87171', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          🗑 Delete
                        </button>
                      </div>
                      {/* Google Drive note */}
                      <div style={{ padding: '8px 18px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: '#334155' }}>💾</span>
                        <span style={{ fontSize: 9, color: '#334155', fontWeight: 600, lineHeight: 1.4 }}>Data is not saved by the app. Save to your Google Drive to retain this record.</span>
                      </div>
                    </div>
                  ) : (
                    /* No record selected — show voice history list */
                    <div style={{ background: '#0a0f1d', borderRadius: 20, border: '1px solid rgba(255,255,255,.06)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
                        <div style={{ fontSize: 8, color: '#475569', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 2 }}>Voice History</div>
                        <div style={{ fontSize: 11, color: '#334155' }}>Tap a record to load it here</div>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {voiceRecords.length === 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, opacity: .35 }}>
                            <Icon path="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" size={32} strokeWidth={1.5} />
                            <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', fontWeight: 700 }}>No call records yet</p>
                          </div>
                        )}
                        {voiceRecords.map(r => (
                          <div key={r.id} className="fade-up"
                            onClick={() => setActiveCallRecord(r)}
                            style={{ background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: '11px 13px', border: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', transition: 'all .2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,.25)'; e.currentTarget.style.background = 'rgba(99,102,241,.06)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{r.client}</span>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontSize: 9, color: '#475569' }}>{r.duration}</span>
                                <button onClick={e => { e.stopPropagation(); setVoiceRecords(v => v.filter(x => x.id !== r.id)); }}
                                  style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.15)', color: '#f87171', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.summary}</div>
                            <div style={{ fontSize: 9, color: '#334155', marginTop: 4, fontWeight: 700 }}>{r.date}</div>
                          </div>
                        ))}
                        {calls.filter(c => c.status === 'ended').map(c => (
                          <div key={c._id} className="fade-up"
                            onClick={() => setActiveCallRecord({ ...c, client: c.caller || c.phone, id: null })}
                            style={{ background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: '11px 13px', border: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', transition: 'all .2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,.25)'; e.currentTarget.style.background = 'rgba(99,102,241,.06)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{c.caller || 'Unknown'}</span>
                              <span style={{ fontSize: 9, color: '#475569' }}>{c.duration || '—'}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{c.summary || c.phone}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Google Drive Panel */}
                  <div style={{ background: gdrive.connected ? 'rgba(16,185,129,.04)' : 'rgba(255,255,255,.02)', border: `1px solid ${gdrive.connected ? 'rgba(16,185,129,.2)' : 'rgba(255,255,255,.07)'}`, borderRadius: 16, padding: '14px 16px', flexShrink: 0, transition: 'all .3s' }}>

                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: gdrive.connected ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        {gdrive.loading ? <div className="spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.1)', borderTopColor: '#10b981' }} /> : '📁'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 900, color: gdrive.connected ? '#10b981' : '#475569', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                          {gdrive.connected ? '● Google Drive Connected' : 'Google Drive'}
                        </div>
                        {gdrive.connected && (
                          <div style={{ fontSize: 9, color: '#475569', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {gdrive.folderName
                              ? <span style={{ color: '#10b981', fontWeight: 700 }}>{gdrive.folderName}</span>
                              : gdrive.advocateId
                                ? <span style={{ color: '#10b981', fontWeight: 700 }}>Nexus-{gdrive.advocateId}</span>
                                : gdrive.folderId
                                  ? <span style={{ color: '#10b981', fontWeight: 700 }}>Nexus-ADV-{gdrive.folderId.slice(-8).toUpperCase()}</span>
                                  : null}
                          </div>
                        )}
                      </div>
                      {gdrive.connected && (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={gdriveLoadFiles} title="Refresh files" style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#475569', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↺</button>
                          <button onClick={() => gdriveOpenFolder()} title="Open Nexus folder in Drive" style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', color: '#10b981', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↗</button>
                        </div>
                      )}
                    </div>

                    {!gdrive.connected && !gdrive.loading && (
                      <>
                        <p style={{ fontSize: 10, color: '#475569', lineHeight: 1.6, margin: '0 0 10px' }}>
                          Connect your Google Drive. Nexus will create a <strong style={{ color: '#94a3b8' }}>Nexus-ADV-{'{id}'}</strong> folder and auto-save all records there. <strong style={{ color: '#94a3b8' }}>We store nothing</strong> — data lives in your Drive only.
                        </p>
                        <button onClick={gdriveConnect}
                          style={{ width: '100%', padding: '9px 0', background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 10, color: '#818cf8', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          🔗 Connect Google Drive
                        </button>
                      </>
                    )}

                    {gdrive.connected && (
                      <>
                        {/* Save status indicator */}
                        {gdriveSaveStatus && (
                          <div className="fade-up" style={{ padding: '6px 10px', borderRadius: 8, background: gdriveSaveStatus === 'saved' ? 'rgba(16,185,129,.1)' : gdriveSaveStatus === 'error' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', border: `1px solid ${gdriveSaveStatus === 'saved' ? 'rgba(16,185,129,.2)' : gdriveSaveStatus === 'error' ? 'rgba(239,68,68,.2)' : 'rgba(245,158,11,.2)'}`, marginBottom: 8, fontSize: 10, color: gdriveSaveStatus === 'saved' ? '#10b981' : gdriveSaveStatus === 'error' ? '#f87171' : '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {gdriveSaveStatus === 'saving' && <div className="spin" style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,.2)', borderTopColor: '#f59e0b' }} />}
                            {gdriveSaveStatus === 'saved' ? '✓ Saved to Drive' : gdriveSaveStatus === 'error' ? '✕ Save failed' : 'Saving…'}
                          </div>
                        )}

                        {/* Subfolder quick-jump row */}
                        {gdrive.subfolders && (
                          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                            {Object.entries(SUBFOLDER_LABELS).filter(([k]) => k !== 'temp_instructions').map(([key, meta]) => (
                              <button key={key} onClick={() => gdriveOpenFolder(key)}
                                title={`Open ${meta.label} folder in Drive`}
                                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 20, color: '#475569', fontSize: 8, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color + '66'; e.currentTarget.style.color = meta.color; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = '#475569'; }}>
                                {meta.icon} {meta.label} ↗
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                          {activeCallRecord && (
                            <button
                              onClick={() => gdriveSave('call_record',
                                `VOICE RECORD\nClient: ${activeCallRecord.client}\nDate: ${activeCallRecord.date}\nDuration: ${activeCallRecord.duration}\n\nSummary:\n${activeCallRecord.summary}`,
                                `call_${(activeCallRecord.client||'unknown').replace(/\s/g,'_')}_${(activeCallRecord.date||'now').replace(/\//g,'-')}.txt`)}
                              style={{ flex: 1, padding: '7px 8px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 9, color: '#f59e0b', fontSize: 9, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              💾 Save Call Record
                            </button>
                          )}
                          {chatHistory.length > 0 && (
                            <button onClick={() => gdriveSaveConsultation(false)}
                              style={{ flex: 1, padding: '7px 8px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 9, color: '#818cf8', fontSize: 9, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              💾 Save Consultation
                            </button>
                          )}
                          <button
                            onClick={() => gdriveSave('temp_instructions',
                              JSON.stringify(tempInstructions.filter(i => i.active), null, 2),
                              `instructions_${new Date().toISOString().slice(0,10)}.json`)}
                            style={{ flex: 1, padding: '7px 8px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 9, color: '#10b981', fontSize: 9, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            💾 Save Instructions
                          </button>
                        </div>

                        {/* Auto-save log */}
                        {gdriveAutoSaveLog.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 8, color: '#334155', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Auto-save Log</div>
                            <div style={{ maxHeight: 64, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {gdriveAutoSaveLog.slice(0, 5).map((entry, i) => {
                                const meta = SUBFOLDER_LABELS[entry.type] || { icon: '📁', color: '#475569' };
                                return (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 8.5, color: '#334155' }}>
                                    <span>{meta.icon}</span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569' }}>{entry.filename}</span>
                                    <span style={{ flexShrink: 0, color: '#1e293b' }}>{entry.ts}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* File list */}
                        {gdrive.filesLoading ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                            <div className="spin" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.1)', borderTopColor: '#10b981' }} />
                          </div>
                        ) : gdrive.files.length > 0 ? (
                          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                            <div style={{ fontSize: 8, color: '#334155', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 5 }}>Drive Files ({gdrive.files.length})</div>
                            {gdrive.files.map(f => (
                              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                                <span style={{ fontSize: 9, color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</span>
                                <button onClick={() => gdriveDeleteFile(f.id)} style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(239,68,68,.1)', border: 'none', color: '#f87171', fontSize: 8, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: '#334155', textAlign: 'center', padding: '4px 0' }}>No files yet — save records above</div>
                        )}

                        <button onClick={gdriveDisconnect} style={{ width: '100%', marginTop: 8, padding: '5px 0', background: 'transparent', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, color: '#334155', fontSize: 9, cursor: 'pointer', fontWeight: 700 }}>Disconnect Drive</button>
                      </>
                    )}
                  </div>
                </div>

                {/* RIGHT PANEL — AI Legal Consultation Chat */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexShrink: 0 }}>
                      <div>
                        <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Nexus AI Legal Engine</div>
                        <h3 style={{ fontSize: 22, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', margin: 0 }}>
                          Legal<span style={{ color: '#475569', fontStyle: 'normal' }}> Consultant</span>
                          {activeCallRecord && <span style={{ fontSize: 13, color: '#6366f1', fontStyle: 'normal', fontWeight: 700, marginLeft: 10 }}>— {activeCallRecord.client}</span>}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ padding: '5px 11px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 20, fontSize: 9, color: '#818cf8', fontWeight: 700 }}>IPC · CPC · Evidence Act</div>
                        {gdrive.connected && (
                          <div style={{ padding: '5px 10px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 20, fontSize: 9, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                            Drive RAG Active
                          </div>
                        )}
                        <div style={{ padding: '5px 10px', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 20, fontSize: 9, color: detectedLang ? '#a5b4fc' : '#334155', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, transition: 'all .3s' }}>
                          {detectedLang ? <span>{detectedLang.flag}</span> : <span>🌐</span>}
                          <span>{detectedLang ? detectedLang.label : 'Auto Language'}</span>
                        </div>
                        {chatHistory.length > 0 && (
                          <button onClick={() => { setDeleteTargetMsg(null); setShowDeleteConsultModal(true); }}
                            title="Clear chat"
                            style={{ padding: '5px 11px', background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 20, color: '#f87171', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
                            🗑 Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Delete Consultation Confirm Modal ── */}
                    {showDeleteConsultModal && (
                      <div className="fade-up" style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,.85)', backdropFilter: 'blur(6px)', borderRadius: 24 }}>
                        <div style={{ background: '#0d1220', border: '1px solid rgba(239,68,68,.3)', borderRadius: 20, padding: '28px 28px 24px', maxWidth: 360, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(239,68,68,.1)', textAlign: 'center' }}>
                          {/* Warning icon */}
                          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          </div>
                          {/* Title */}
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', marginBottom: 8, letterSpacing: '-0.02em' }}>
                            {deleteTargetMsg ? 'Delete this message?' : 'Delete Consultation?'}
                          </div>
                          {/* Warning text */}
                          {deleteTargetMsg ? (
                            <>
                              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, margin: '0 0 10px', padding: '10px 14px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, textAlign: 'left', fontStyle: 'italic', maxHeight: 72, overflowY: 'auto' }}>
                                "{deleteTargetMsg.text.slice(0, 120)}{deleteTargetMsg.text.length > 120 ? '…' : ''}"
                              </div>
                              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, margin: '0 0 6px' }}>
                                This will <strong style={{ color: '#f87171' }}>permanently delete</strong> this {deleteTargetMsg.role === 'user' ? 'message' : 'AI response'}.
                              </p>
                            </>
                          ) : (
                            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, margin: '0 0 6px' }}>
                              This will <strong style={{ color: '#f87171' }}>permanently delete</strong> all {chatHistory.length} message{chatHistory.length !== 1 ? 's' : ''} in this consultation.
                            </p>
                          )}
                          <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, margin: '0 0 22px', padding: '8px 12px', background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.1)', borderRadius: 10 }}>
                            ⚠ This action cannot be undone. If you haven't saved to Google Drive, this data will be lost forever.
                          </p>
                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              onClick={() => { setShowDeleteConsultModal(false); setDeleteTargetMsg(null); }}
                              style={{ flex: 1, padding: '11px 0', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = '#94a3b8'; }}>
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (deleteTargetMsg) {
                                  setChatHistory(h => h.filter(m => m.id !== deleteTargetMsg.id));
                                } else {
                                  setChatHistory([]);
                                }
                                setShowDeleteConsultModal(false);
                                setDeleteTargetMsg(null);
                              }}
                              style={{ flex: 1, padding: '11px 0', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', borderRadius: 12, color: '#f87171', fontSize: 12, fontWeight: 900, cursor: 'pointer', transition: 'all .15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.25)'; e.currentTarget.style.color = '#fca5a5'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,.15)'; e.currentTarget.style.color = '#f87171'; }}>
                              🗑 Delete Permanently
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Context pill — shows when a call record is active */}
                    {activeCallRecord && (
                      <div className="fade-up" style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 10, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                        <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>
                          Context loaded: <strong>{activeCallRecord.client}</strong> · {activeCallRecord.date} · {activeCallRecord.duration}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#334155' }}>AI is aware of this call record</span>
                      </div>
                    )}

                    <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                      {chatHistory.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20, textAlign: 'center' }}>
                          <div style={{ width: 72, height: 72, borderRadius: 22, background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                            <Icon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" size={32} strokeWidth={1.5} />
                          </div>
                          <div>
                            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                              {activeCallRecord ? `Ask AI about ${activeCallRecord.client}'s case` : 'Ask anything legal'}
                            </p>
                            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                              {activeCallRecord ? 'AI has the call context. Ask about strategy, sections, or next steps.' : 'Select a call record on the left, or ask any legal question.'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {(activeCallRecord
                              ? [`What law applies to ${activeCallRecord.client}'s case?`, 'Suggest next legal steps', 'Draft a relevant petition']
                              : ['Draft interim injunction', 'Find relevant IPC sections', 'Explain CPC Order XXXIX']
                            ).map(s => (
                              <button key={s} onClick={() => setConsoleInput(s)} style={{ padding: '7px 14px', background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 20, color: '#818cf8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{s}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {chatHistory.map(msg => (
                        <div key={msg.id} className="fade-up"
                          style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 6, position: 'relative' }}
                          onMouseEnter={e => { const btn = e.currentTarget.querySelector('.msg-del-btn'); if (btn) btn.style.opacity = '1'; }}
                          onMouseLeave={e => { const btn = e.currentTarget.querySelector('.msg-del-btn'); if (btn) btn.style.opacity = '0'; }}>
                          {/* Delete button — left of AI bubble, right of user bubble */}
                          {msg.role === 'ai' && (
                            <button className="msg-del-btn"
                              onClick={() => { setDeleteTargetMsg(msg); setShowDeleteConsultModal(true); }}
                              title="Delete this message"
                              style={{ opacity: 0, transition: 'opacity .15s', flexShrink: 0, marginTop: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', order: -1 }}>
                              ✕
                            </button>
                          )}
                          <div style={{ maxWidth: '82%', padding: '13px 17px', borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', background: msg.role === 'user' ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.07)'}`, fontSize: 13, lineHeight: 1.7, color: msg.role === 'user' ? '#c7d2fe' : '#cbd5e1' }}
                            dangerouslySetInnerHTML={msg.role === 'ai' ? { __html: renderMarkdown(msg.text) } : undefined}
                          >{msg.role === 'user' ? msg.text : undefined}</div>
                          {msg.role === 'user' && (
                            <button className="msg-del-btn"
                              onClick={() => { setDeleteTargetMsg(msg); setShowDeleteConsultModal(true); }}
                              title="Delete this message"
                              style={{ opacity: 0, transition: 'opacity .15s', flexShrink: 0, marginTop: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      {consoleLoading && <div style={{ display: 'flex', gap: 6, padding: '13px 17px', width: 'fit-content', background: 'rgba(255,255,255,.04)', borderRadius: '20px 20px 20px 4px' }}>
                        {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#475569', animationName: 'pulse2', animationDuration: '1.2s', animationIterationCount: 'infinite', animationDelay: `${i * 0.2}s` }} />)}
                      </div>}
                    </div>
                    {/* Language indicator + input row */}
                    <div style={{ flexShrink: 0 }}>
                      {/* Live language detection bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 20 }}>
                        {detectedLang ? (
                          <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 20 }}>
                            <span style={{ fontSize: 12 }}>{detectedLang.flag}</span>
                            <span style={{ fontSize: 9, fontWeight: 900, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{detectedLang.label} detected</span>
                            <span style={{ fontSize: 9, color: '#334155' }}>· AI will reply in {detectedLang.label}</span>
                            <button onClick={() => setDetectedLang(null)} style={{ background: 'none', border: 'none', color: '#334155', fontSize: 10, cursor: 'pointer', padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: '#1e293b', fontWeight: 700, letterSpacing: '0.08em' }}>
                            🌐 Type in any language — AI will auto-detect and reply in the same language
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          data-consult-input
                          value={consoleInput}
                          onChange={e => {
                            setConsoleInput(e.target.value);
                            // Live detect as user types
                            const lang = detectLanguage(e.target.value);
                            if (lang && e.target.value.trim().length >= 4) setDetectedLang(lang);
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') sendConsult(); }}
                          placeholder={activeCallRecord ? `Ask about ${activeCallRecord.client}'s case — in any language…` : 'Ask in any language — Malayalam, Hindi, Tamil, English…'}
                          style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '13px 18px', fontSize: 13 }}
                        />
                        <button onClick={sendConsult} style={{ padding: '13px 22px', background: '#6366f1', border: 'none', borderRadius: 14, color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Send</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CLIENTS */}
          {view === 'clients' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Case Management</div>
                  <h2 style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em', margin: 0 }}>Client<span style={{ color: '#475569', fontStyle: 'normal' }}> Registry</span></h2>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setIntakeModal(true)} style={{ padding: '11px 18px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)', borderRadius: 14, color: '#818cf8', fontSize: 11, fontWeight: 900, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>📋 Intake → Draft</button>
                  <button onClick={() => setAddingClient(true)} style={{ padding: '11px 22px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 14, color: '#f59e0b', fontSize: 11, fontWeight: 900, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>+ Add Client</button>
                </div>
              </div>
              {addingClient && (
                <div style={{ ...S.card, marginBottom: 18 }} className="fade-up">
                  <div style={{ fontSize: 9, color: '#10b981', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 14 }}>New Client</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[['name', 'Client Name'], ['phone', 'Phone'], ['caseNumber', 'Case No.'], ['courtName', 'Court'], ['oppAdvocateName', 'Opp. Advocate'], ['nextPostingDate', 'Next Date'], ['purposeOfPosting', 'Purpose']].map(([field, label]) => (
                      <input key={field} placeholder={label} value={newClient[field] || ''} onChange={e => setNewClient(p => ({ ...p, [field]: e.target.value }))}
                        style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '9px 13px', fontSize: 12, gridColumn: ['purposeOfPosting', 'courtName'].includes(field) ? 'span 2' : 'auto' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { if (newClient.name) { setClients(c => [...c, { ...newClient, slNo: c.length + 1 }]); setNewClient({}); setAddingClient(false); } }} style={{ padding: '9px 22px', background: '#10b981', border: 'none', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => { setAddingClient(false); setNewClient({}); }} style={{ padding: '9px 22px', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#94a3b8', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ ...S.card, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      {['#', 'Client', 'Phone', 'Court', 'Case No.', 'Next Date', 'Purpose', 'Documents', 'Action'].map(h => (
                        <th key={h} style={{ paddingBottom: 11, paddingLeft: 13, textAlign: 'left', fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(c => {
                      const docs = clientDocs[c.slNo] || [];
                      return (
                        <tr key={c.slNo} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <td style={{ padding: '13px', color: '#334155', fontSize: 12, fontWeight: 700 }}>{c.slNo}</td>
                          <td style={{ padding: '13px' }}><div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div></td>
                          <td style={{ padding: '13px', color: '#64748b', fontSize: 12 }}>{c.phone}</td>
                          <td style={{ padding: '13px', color: '#64748b', fontSize: 12 }}>{c.courtName}</td>
                          <td style={{ padding: '13px' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,.1)', padding: '3px 10px', borderRadius: 6 }}>{c.caseNumber}</span></td>
                          <td style={{ padding: '13px', color: '#10b981', fontSize: 12, fontWeight: 700 }}>{c.nextPostingDate}</td>
                          <td style={{ padding: '13px', color: '#64748b', fontSize: 12 }}>{c.purposeOfPosting}</td>
                          <td style={{ padding: '13px' }}>
                            <button onClick={() => setClientDocsModal(c)}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: docs.length > 0 ? 'rgba(245,158,11,.1)' : 'rgba(255,255,255,.04)', border: `1px solid ${docs.length > 0 ? 'rgba(245,158,11,.3)' : 'rgba(255,255,255,.08)'}`, borderRadius: 8, color: docs.length > 0 ? '#f59e0b' : '#475569', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .2s' }}>
                              <Icon path="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" size={12} strokeWidth={2} />
                              {docs.length > 0 ? `${docs.length} file${docs.length > 1 ? 's' : ''}` : 'Upload'}
                            </button>
                          </td>
                          <td style={{ padding: '13px' }}><button onClick={() => setClients(cl => cl.filter(x => x.slNo !== c.slNo))} style={{ padding: '4px 12px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, color: '#f87171', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Delete</button></td>
                          <td style={{ padding:'13px' }}>
                            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                              <button onClick={() => { setMsgDraftModal(c); setMsgResult(''); }} title="Draft WhatsApp/Letter/SMS"
                                style={{ padding:'4px 9px', background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.15)', borderRadius:7, color:'#818cf8', fontSize:9, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>💬 Message</button>
                              <button onClick={() => { setCaseBriefModal(c); setCaseBriefResult(''); }} title="AI Case Brief"
                                style={{ padding:'4px 9px', background:'rgba(139,92,246,.08)', border:'1px solid rgba(139,92,246,.15)', borderRadius:7, color:'#a78bfa', fontSize:9, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>📋 Brief</button>
                              <button onClick={() => { setFeeNoteModal(c); setFeeNoteHtml(''); }} title="Generate Fee Note"
                                style={{ padding:'4px 9px', background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.15)', borderRadius:7, color:'#f59e0b', fontSize:9, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>₹ Fee Note</button>
                              <button onClick={async () => { await loadTasksForClient(c.slNo); }} title="View/Add Tasks"
                                style={{ padding:'4px 9px', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.15)', borderRadius:7, color:'#10b981', fontSize:9, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>✓ Tasks ({(clientTasks[c.slNo]||[]).length})</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── CLIENT DOCUMENTS MODAL ── */}
          {clientDocsModal && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: '#020617', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="fade-up">

              {/* Header */}
              <div style={{ background: '#070b14', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                <button onClick={() => setClientDocsModal(null)}
                  style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#94a3b8', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Client Documents</div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', marginTop: 2 }}>
                    {clientDocsModal.name}
                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginLeft: 10 }}>{clientDocsModal.caseNumber}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>
                  {(clientDocs[clientDocsModal.slNo] || []).length} file{(clientDocs[clientDocsModal.slNo] || []).length !== 1 ? 's' : ''} stored
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>

                {/* LEFT — Upload Panel */}
                <div style={{ width: 360, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* Mode tabs */}
                  <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0 }}>
                    {[['file', '📂 Upload File'], ['camera', '📷 Camera']].map(([mode, label]) => (
                      <button key={mode} onClick={() => { setDocsUploadMode(mode); if (mode !== 'camera') docsCamStop(); }}
                        style={{ flex: 1, padding: '13px 0', background: 'none', border: 'none', borderBottom: docsUploadMode === mode ? '2px solid #f59e0b' : '2px solid transparent', color: docsUploadMode === mode ? '#f59e0b' : '#475569', fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', cursor: 'pointer', transition: 'all .2s' }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>

                    {/* FILE UPLOAD MODE */}
                    {docsUploadMode === 'file' && (
                      <div>
                        <div
                          className={`kb-drop${docsDragOver ? ' over' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDocsDragOver(true); }}
                          onDragLeave={() => setDocsDragOver(false)}
                          onDrop={e => { e.preventDefault(); setDocsDragOver(false); docsHandleFiles(e.dataTransfer.files); }}
                          onClick={() => docsFileInputRef.current?.click()}
                          style={{ padding: '36px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16 }}>
                          <input ref={docsFileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.heic" style={{ display: 'none' }} onChange={e => docsHandleFiles(e.target.files)} />
                          <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Drag & drop files here</div>
                          <div style={{ fontSize: 11, color: '#475569', marginBottom: 12 }}>or click to browse your device</div>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {['PDF', 'DOC', 'DOCX', 'JPG', 'PNG', 'TXT'].map(ext => (
                              <span key={ext} style={{ fontSize: 9, fontWeight: 900, color: '#334155', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '2px 7px' }}>{ext}</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => docsFileInputRef.current?.click()}
                          style={{ width: '100%', padding: '11px 0', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, color: '#f59e0b', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>
                          + Browse & Upload
                        </button>
                      </div>
                    )}

                    {/* CAMERA MODE */}
                    {docsUploadMode === 'camera' && (
                      <div>
                        <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4/3', marginBottom: 14, position: 'relative', border: '1px solid rgba(255,255,255,.08)' }}>
                          <video ref={docsCamVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: docsCamPhase === 'live' ? 'block' : 'none' }} />
                          <canvas ref={docsCamCanvasRef} style={{ display: 'none' }} />
                          {docsCamPhase === 'idle' && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                              <div style={{ fontSize: 40 }}>📷</div>
                              <div style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>Camera is off</div>
                            </div>
                          )}
                          {docsCamPhase === 'starting' && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div className="spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,.1)', borderTopColor: '#f59e0b' }} />
                            </div>
                          )}
                          {docsCamPhase === 'capturing' && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ fontSize: 11, color: '#fff', fontWeight: 900 }}>Capturing…</div>
                            </div>
                          )}
                          {docsCamPhase === 'done' && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(16,185,129,.08)' }}>
                              <div style={{ fontSize: 32 }}>✅</div>
                              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 900 }}>Photo saved!</div>
                            </div>
                          )}
                          {docsCamPhase === 'error' && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
                              <div style={{ fontSize: 26 }}>⚠️</div>
                              <div style={{ fontSize: 11, color: '#f87171', textAlign: 'center' }}>{docsCamError}</div>
                            </div>
                          )}
                          {/* Live viewfinder overlay */}
                          {docsCamPhase === 'live' && (
                            <div style={{ position: 'absolute', inset: 10, border: '1px solid rgba(245,158,11,.4)', borderRadius: 8, pointerEvents: 'none' }}>
                              <div style={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20, borderTop: '2px solid #f59e0b', borderLeft: '2px solid #f59e0b', borderRadius: '4px 0 0 0' }} />
                              <div style={{ position: 'absolute', top: -1, right: -1, width: 20, height: 20, borderTop: '2px solid #f59e0b', borderRight: '2px solid #f59e0b', borderRadius: '0 4px 0 0' }} />
                              <div style={{ position: 'absolute', bottom: -1, left: -1, width: 20, height: 20, borderBottom: '2px solid #f59e0b', borderLeft: '2px solid #f59e0b', borderRadius: '0 0 0 4px' }} />
                              <div style={{ position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderBottom: '2px solid #f59e0b', borderRight: '2px solid #f59e0b', borderRadius: '0 0 4px 0' }} />
                            </div>
                          )}
                        </div>

                        {/* Camera controls */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          {docsCamPhase === 'idle' || docsCamPhase === 'error' ? (
                            <button onClick={docsCamStart} style={{ flex: 1, padding: '11px 0', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 12, color: '#f59e0b', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>📷 Start Camera</button>
                          ) : docsCamPhase === 'live' ? (
                            <>
                              <button onClick={docsCamCapture} style={{ flex: 2, padding: '11px 0', background: '#f59e0b', border: 'none', borderRadius: 12, color: '#000', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>⚡ Capture Photo</button>
                              <button onClick={docsCamStop} style={{ flex: 1, padding: '11px 0', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, color: '#f87171', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Stop</button>
                            </>
                          ) : docsCamPhase === 'done' ? (
                            <button onClick={() => { setDocsCamPhase('idle'); docsCamStart(); }} style={{ flex: 1, padding: '11px 0', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 12, color: '#f59e0b', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>📷 Take Another</button>
                          ) : null}
                        </div>
                        <div style={{ marginTop: 10, fontSize: 10, color: '#334155', textAlign: 'center' }}>Point camera at the document and tap Capture</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT — Uploaded Files List */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: '#f59e0b', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Uploaded Documents</div>
                    <div style={{ fontSize: 10, color: '#334155', fontWeight: 700 }}>{(clientDocs[clientDocsModal.slNo] || []).length} file{(clientDocs[clientDocsModal.slNo] || []).length !== 1 ? 's' : ''}</div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                    {(clientDocs[clientDocsModal.slNo] || []).length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, opacity: .4 }}>
                        <div style={{ fontSize: 48 }}>📂</div>
                        <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, textAlign: 'center' }}>No documents yet<br/><span style={{ fontSize: 11, fontWeight: 400 }}>Upload files or take photos using the panel on the left</span></div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                        {(clientDocs[clientDocsModal.slNo] || []).map(doc => {
                          const isImage = doc.type?.startsWith('image/');
                          const isPdf = doc.name?.toLowerCase().endsWith('.pdf');
                          const icon = isPdf ? '📄' : isImage ? '🖼' : doc.name?.endsWith('.doc') || doc.name?.endsWith('.docx') ? '📝' : '📎';
                          return (
                            <div key={doc.id} style={{ background: '#0a0f1d', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all .2s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,.25)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; e.currentTarget.style.transform = 'none'; }}>

                              {/* Preview area */}
                              <div style={{ height: 120, background: '#070b14', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                {isImage && doc.dataUrl ? (
                                  <img src={doc.dataUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 36 }}>{icon}</span>
                                    <span style={{ fontSize: 9, color: '#334155', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{doc.name?.split('.').pop()}</span>
                                  </div>
                                )}
                              </div>

                              {/* File info */}
                              <div style={{ padding: '10px 12px', flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }} title={doc.name}>{doc.name}</div>
                                <div style={{ fontSize: 9, color: '#334155', fontWeight: 700 }}>{doc.size} · {doc.uploadedAt}</div>
                              </div>

                              {/* Actions */}
                              <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 6 }}>
                                {doc.dataUrl && (
                                  <a href={doc.dataUrl} download={doc.name}
                                    style={{ flex: 1, padding: '5px 0', background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 7, color: '#818cf8', fontSize: 9, fontWeight: 900, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                                    ⬇ Download
                                  </a>
                                )}
                                <button onClick={() => setDocsDeleteTarget({ clientSlNo: clientDocsModal.slNo, docId: doc.id, docName: doc.name })}
                                  style={{ flex: 1, padding: '5px 0', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 7, color: '#f87171', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
                                  🗑 Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Doc Delete Confirm ── */}
              {docsDeleteTarget && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,.88)', backdropFilter: 'blur(8px)' }}>
                  <div className="fade-up" style={{ background: '#0d1220', border: '1px solid rgba(239,68,68,.3)', borderRadius: 20, padding: '28px 28px 24px', maxWidth: 340, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.8)' }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22 }}>🗑</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', marginBottom: 8 }}>Delete Document?</div>
                    <div style={{ fontSize: 12, color: '#64748b', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docsDeleteTarget.docName}</div>
                    <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, margin: '0 0 20px', padding: '8px 12px', background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.1)', borderRadius: 10 }}>
                      ⚠ This will <strong style={{ color: '#f87171' }}>permanently delete</strong> this file. This cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setDocsDeleteTarget(null)}
                        style={{ flex: 1, padding: '11px 0', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={docsDeleteConfirmed}
                        style={{ flex: 1, padding: '11px 0', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', borderRadius: 12, color: '#f87171', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {view === 'knowledge-base' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Local Knowledge Engine</div>
                  <h2 style={{ fontSize: 36, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em', margin: 0 }}>Law <span style={{ color: '#475569', fontStyle: 'normal' }}>Knowledge Base</span></h2>
                  <p style={{ fontSize: 12, color: '#475569', marginTop: 6, marginBottom: 0 }}>Upload your specialist law documents — AI will reference them during consultations.</p>
                </div>
                <button onClick={() => setKbUploading(true)} style={{ padding: '12px 22px', background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.3)', borderRadius: 14, color: '#a78bfa', fontSize: 11, fontWeight: 900, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon path="M12 4v16m8-8H4" size={14} strokeWidth={2.5} /> Upload Law
                </button>
              </div>
              {/* [F12] Ask the Vault */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>⚡ Ask the Vault [F12]</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={vaultQuery} onChange={e => setVaultQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && askVault()}
                    placeholder="e.g. Which document mentions compensation for goods damage under Railway Act?"
                    style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 12, padding: '10px 14px', color: '#e2e8f0', fontSize: 12, outline: 'none' }} />
                  <button onClick={askVault} disabled={vaultLoading || !vaultQuery.trim()}
                    style={{ padding: '10px 20px', background: vaultQuery.trim() && !vaultLoading ? '#f59e0b' : 'rgba(245,158,11,.2)', border: 'none', borderRadius: 12, color: vaultQuery.trim() && !vaultLoading ? '#000' : '#475569', fontSize: 11, fontWeight: 900, cursor: vaultQuery.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                    {vaultLoading ? '…' : '🔍 Ask'}
                  </button>
                </div>
                {vaultAnswer && (
                  <div style={{ marginTop: 10, padding: '12px 16px', background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.15)', borderRadius: 12, fontSize: 12, color: '#e2e8f0', lineHeight: 1.8 }}>
                    <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>Vault Answer</div>
                    {vaultAnswer}
                    <button onClick={() => liveVoice.speak(vaultAnswer)} style={{ marginTop: 8, padding: '5px 12px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 8, color: '#10b981', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>▶ Read Aloud</button>
                  </div>
                )}
              </div>
              {kbUploading && (
                <div style={{ ...S.card, marginBottom: 20, border: '1px solid rgba(139,92,246,.25)' }} className="fade-up">
                  <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 14 }}>Add Law Document</div>
                  <div className={`kb-drop${kbDragOver ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setKbDragOver(true); }} onDragLeave={() => setKbDragOver(false)} onDrop={e => { e.preventDefault(); setKbDragOver(false); const f = e.dataTransfer.files[0]; if (f) setKbUploadName(f.name.replace(/\.pdf$/i, '')); }} style={{ padding: '28px 20px', textAlign: 'center', marginBottom: 16, cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) setKbUploadName(f.name.replace(/\.pdf$/i, '')); }} />
                    <Icon path="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" size={32} strokeWidth={1.5} />
                    <p style={{ color: '#6366f1', fontSize: 13, fontWeight: 700, margin: '8px 0 4px' }}>Drag & drop PDF here</p>
                    <p style={{ color: '#334155', fontSize: 11, margin: 0 }}>or click to browse</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <input placeholder="Document name" value={kbUploadName} onChange={e => setKbUploadName(e.target.value)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 14px', fontSize: 12, gridColumn: 'span 2' }} />
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: 9, color: '#475569', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Law Category</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {LAW_CATEGORIES.map(cat => (
                          <button key={cat.id} onClick={() => setKbUploadCat(cat.id)} style={{ padding: '6px 14px', borderRadius: 20, background: kbUploadCat === cat.id ? `rgba(${getCatRgb(cat.color)},.15)` : 'rgba(255,255,255,.04)', border: `1px solid ${kbUploadCat === cat.id ? cat.color + '40' : 'rgba(255,255,255,.08)'}`, color: kbUploadCat === cat.id ? cat.color : '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{cat.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleKbUpload(kbUploadName)} disabled={!kbUploadName.trim()} style={{ padding: '10px 24px', background: kbUploadName.trim() ? '#8b5cf6' : 'rgba(139,92,246,.3)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 900, cursor: kbUploadName.trim() ? 'pointer' : 'default' }}>Add to Knowledge Base</button>
                    <button onClick={() => { setKbUploading(false); setKbUploadName(''); }} style={{ padding: '10px 22px', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#94a3b8', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <button onClick={() => setKbFilter('all')} style={{ padding: '6px 16px', borderRadius: 20, background: kbFilter === 'all' ? 'rgba(255,255,255,.1)' : 'transparent', border: `1px solid ${kbFilter === 'all' ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.07)'}`, color: kbFilter === 'all' ? '#e2e8f0' : '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>All ({kbDocs.length})</button>
                {LAW_CATEGORIES.map(cat => {
                  const count = kbDocs.filter(d => d.category === cat.id).length;
                  if (count === 0) return null;
                  return <button key={cat.id} onClick={() => setKbFilter(cat.id)} style={{ padding: '6px 16px', borderRadius: 20, background: kbFilter === cat.id ? `rgba(${getCatRgb(cat.color)},.15)` : 'transparent', border: `1px solid ${kbFilter === cat.id ? cat.color + '40' : 'rgba(255,255,255,.07)'}`, color: kbFilter === cat.id ? cat.color : '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{cat.label} ({count})</button>;
                })}
              </div>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder="Search documents…" style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '11px 14px 11px 40px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {kbDocs.filter(d => (kbFilter === 'all' || d.category === kbFilter) && (!kbSearch || d.name.toLowerCase().includes(kbSearch.toLowerCase()))).map(doc => {
                  const cat = LAW_CATEGORIES.find(c => c.id === doc.category) || LAW_CATEGORIES[0];
                  return (
                    <div key={doc.id} style={{ background: '#0a0f1d', borderRadius: 18, padding: 20, border: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', gap: 14, transition: 'all .2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = cat.color + '30'; e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)'; e.currentTarget.style.transform = 'none'; }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(${getCatRgb(cat.color)},.1)`, border: `1px solid ${cat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color, flexShrink: 0 }}>
                          <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={22} strokeWidth={1.5} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                          <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: cat.color, background: `rgba(${getCatRgb(cat.color)},.1)`, padding: '2px 8px', borderRadius: 20 }}>{cat.label}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        {[['Pages', doc.pages], ['Size', doc.size], ['Added', doc.date]].map(([l, v]) => (
                          <div key={l}>
                            <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{l}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 9, color: '#64748b', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Preview</button>
                        <button style={{ flex: 1, padding: '8px 0', background: `rgba(${getCatRgb(cat.color)},.08)`, border: `1px solid ${cat.color}20`, borderRadius: 9, color: cat.color, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Use in AI</button>
                        <button onClick={() => setKbDocs(d => d.filter(x => x.id !== doc.id))} style={{ padding: '8px 12px', background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 9, color: '#f87171', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TEMP INSTRUCTIONS */}
          {view === 'temp-instructions' && (
            <div style={{ height: '100%', display: 'flex', gap: 20, padding: 24, overflow: 'hidden' }}>
              <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0, overflow: 'hidden' }}>
                <div>
                  <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Contextual AI Memory</div>
                  <h2 style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', margin: 0 }}>Temp <span style={{ color: '#475569', fontStyle: 'normal' }}>Instructions</span></h2>
                  <p style={{ fontSize: 12, color: '#475569', marginTop: 6, marginBottom: 0 }}>Tell the AI what to say or do when specific people call or situations arise.</p>
                </div>
                <div style={{ ...S.card, border: '1px solid rgba(245,158,11,.15)' }}>
                  <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 12 }}>+ New Instruction</div>
                  <textarea value={newInstruction} onChange={e => setNewInstruction(e.target.value)} placeholder={`Examples:\n"If Raju calls, tell him to meet me tomorrow"\n"If my clerk calls, ask him to bring A4 paper"`} rows={4} style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '12px 14px', fontSize: 12, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
                  <button onClick={() => { if (!newInstruction.trim()) return; setTempInstructions(t => [...t, { id: Date.now(), text: newInstruction.trim(), active: true, created: new Date().toLocaleString() }]); setNewInstruction(''); }} disabled={!newInstruction.trim()} style={{ width: '100%', padding: '11px 0', background: newInstruction.trim() ? '#f59e0b' : 'rgba(245,158,11,.15)', border: 'none', borderRadius: 12, color: newInstruction.trim() ? '#000' : '#64748b', fontSize: 11, fontWeight: 900, cursor: newInstruction.trim() ? 'pointer' : 'default', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Save Instruction</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tempInstructions.map(instr => (
                    <div key={instr.id} className="instr-card fade-up" style={{ background: '#0a0f1d', borderRadius: 16, padding: '16px 18px', border: `1px solid ${instr.active ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.04)'}`, opacity: instr.active ? 1 : 0.5 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.6, color: instr.active ? '#e2e8f0' : '#64748b' }}>{instr.text}</p>
                          <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '0.1em' }}>Added {instr.created}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setTempInstructions(t => t.map(x => x.id === instr.id ? { ...x, active: !x.active } : x))} style={{ width: 44, height: 24, borderRadius: 12, background: instr.active ? '#10b981' : 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all .2s', flexShrink: 0 }}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: instr.active ? 22 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.4)' }} />
                          </button>
                          <span style={{ fontSize: 9, fontWeight: 900, color: instr.active ? '#10b981' : '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{instr.active ? 'Active' : 'Paused'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.04)' }}>
                        <button onClick={() => setTempInstructions(t => t.filter(x => x.id !== instr.id))} style={{ padding: '6px 14px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8, color: '#f87171', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: instr.active ? '#10b981' : '#475569' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: instr.active ? '#10b981' : '#475569', display: 'inline-block' }} />
                          {instr.active ? 'AI will follow this' : 'Not currently active'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(99,102,241,.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                      <Icon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Instruction-Aware AI</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Test your instructions live</div>
                    </div>
                    {activeInstructions.length > 0 && <div style={{ marginLeft: 'auto', padding: '4px 12px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 20, fontSize: 9, color: '#10b981', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{activeInstructions.length} active</div>}
                  </div>
                  {activeInstructions.length > 0 && (
                    <div style={{ background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.1)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>AI Currently Knows:</div>
                      {activeInstructions.map(i => (
                        <div key={i.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5 }}>
                          <span style={{ color: '#f59e0b', fontSize: 11, flexShrink: 0, marginTop: 1 }}>→</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{i.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div ref={instrAiRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    {instrAiMsgs.map((msg, idx) => (
                      <div key={idx} className="fade-up" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                        {msg.role === 'ai' && <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontSize: 9, fontWeight: 900, flexShrink: 0 }}>AI</div>}
                        <div style={{ maxWidth: '80%', padding: '11px 15px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px', background: msg.role === 'user' ? 'rgba(99,102,241,.14)' : 'rgba(255,255,255,.04)', border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.06)'}`, fontSize: 13, lineHeight: 1.6, color: msg.role === 'user' ? '#c7d2fe' : '#cbd5e1' }}>{msg.text}</div>
                      </div>
                    ))}
                    {instrAiLoading && <div style={{ display: 'flex', gap: 5, padding: '11px 15px', width: 'fit-content', background: 'rgba(255,255,255,.04)', borderRadius: '4px 18px 18px 18px' }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#475569', animationName: 'pulse2', animationDuration: '1.2s', animationIterationCount: 'infinite', animationDelay: `${i * 0.2}s` }} />)}
                    </div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={instrAiInput} onChange={e => setInstrAiInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendInstrAi(); }} placeholder={`Try: "Raju is calling" or "My clerk called"…`} style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '11px 15px', fontSize: 13 }} />
                    <button onClick={sendInstrAi} style={{ padding: '11px 20px', background: '#6366f1', border: 'none', borderRadius: 12, color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Send</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {view === 'notifications' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Updates & Alerts</div>
                <h2 style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em', margin: 0 }}>Notifications</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* ── Subscription + Self-Renew Banner ─────────────────── */}
                <SubscriptionRenewBanner user={user} />

                {notifications.map(n => (
                  <div key={n.id} className="fade-up" style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, borderColor: n.read ? 'rgba(255,255,255,.05)' : 'rgba(99,102,241,.2)' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: n.read ? '#334155' : n.type === 'payment' ? '#10b981' : '#6366f1', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: n.read ? 400 : 600, color: n.read ? '#64748b' : '#e2e8f0' }}>{n.message}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: '#334155' }}>{n.date}</p>
                    </div>
                    {!n.read && <button onClick={() => setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))} style={{ padding: '5px 13px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 9, color: '#818cf8', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Mark Read</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUPPORT */}
          {view === 'support' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 24, paddingBottom: 100, overflow: 'hidden' }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Nexus Support System</div>
                <h2 style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', margin: 0 }}>Help<span style={{ color: '#475569', fontStyle: 'normal' }}> Desk</span></h2>
              </div>
              <div ref={supportRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {supportMsgs.map((msg, idx) => (
                  <div key={idx} className="fade-up" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
                    {msg.role === 'ai' && <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>AI</div>}
                    <div style={{ maxWidth: '76%', padding: '11px 15px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px', background: msg.role === 'user' ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.06)'}`, fontSize: 13, lineHeight: 1.6, color: '#cbd5e1' }}>{msg.text}</div>
                  </div>
                ))}
                {supportLoading && <div style={{ display: 'flex', gap: 5, padding: '11px 15px', width: 'fit-content', background: 'rgba(255,255,255,.04)', borderRadius: '4px 18px 18px 18px' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#475569', animationName: 'pulse2', animationDuration: '1.2s', animationIterationCount: 'infinite', animationDelay: `${i * 0.2}s` }} />)}
                </div>}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={supportInput} onChange={e => setSupportInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendSupport(); }} placeholder="Describe your issue…" style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 13, padding: '11px 15px', fontSize: 13 }} />
                <button onClick={sendSupport} style={{ padding: '11px 20px', background: '#f59e0b', border: 'none', borderRadius: 13, color: '#000', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>Send</button>
              </div>
            </div>
          )}

          {/* READING ROOM */}
          {view === 'reading-room' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#070b14', overflow: 'hidden' }}>
              <div style={{ padding: '18px 26px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#0a0f1d', flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: '#10b981', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>Live Camera OCR — Text-to-Speech</div>
                <h3 style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', margin: 0 }}>Reading<span style={{ color: '#475569', fontStyle: 'normal' }}> Room</span></h3>
              </div>
              <div style={{ flex: 1, display: 'flex', gap: 18, padding: 18, paddingBottom: 100, overflowY: 'auto', overflowX: 'hidden' }}>

                {/* Camera panel */}
                <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: '#0a0f1d', borderRadius: 22, border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                    {/* Video viewport */}
                    <div style={{ position: 'relative', background: '#050810', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

                      {/* Hidden canvas used for OCR capture only — shown as preview after capture */}
                      <canvas ref={canvasRef} style={{ display: scanPhase === 'done' ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover', minHeight: 280, position: scanPhase === 'done' ? 'relative' : 'absolute', opacity: scanPhase === 'done' ? 1 : 0 }} />

                      {/* Idle state */}
                      {(scanPhase === 'idle' || scanPhase === 'error') && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
                          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                            <Icon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" size={30} strokeWidth={1.5} />
                          </div>
                          {scanError
                            ? <p style={{ fontSize: 12, color: '#f87171', lineHeight: 1.6, margin: 0 }}>{scanError}</p>
                            : <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, margin: 0 }}>Point your camera at a legal document.<br/>The live feed will appear here.</p>
                          }
                        </div>
                      )}

                      {/* Starting state */}
                      {scanPhase === 'starting' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                          <div className="spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(16,185,129,.2)', borderTopColor: '#10b981' }} />
                          <p style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>Requesting camera…</p>
                        </div>
                      )}

                      {/* Live video feed — always rendered when stream active, hidden when idle */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          display: (scanPhase === 'live' || scanPhase === 'processing') ? 'block' : 'none',
                          width: '100%', height: '100%', objectFit: 'cover',
                          filter: scanPhase === 'processing' ? 'brightness(0.4)' : 'none',
                          minHeight: 280,
                        }}
                      />

                      {/* LIVE badge */}
                      {scanPhase === 'live' && (
                        <>
                          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#10b981,#6ee7b7,#10b981,transparent)', boxShadow: '0 0 18px 6px rgba(16,185,129,.5)', animation: 'scanLine 2s ease-in-out infinite' }} />
                          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', borderRadius: 8, padding: '4px 10px', border: '1px solid rgba(239,68,68,.3)' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse2 1s infinite' }} />
                            <span style={{ fontSize: 9, fontWeight: 900, color: '#ef4444', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Live</span>
                          </div>
                          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,.4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(0,0,0,.5)', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                            Hold document steady · tap Capture
                          </div>
                        </>
                      )}

                      {/* Processing overlay */}
                      {scanPhase === 'processing' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 }}>
                          <div className="spin" style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(16,185,129,.2)', borderTopColor: '#10b981' }} />
                          <div style={{ fontSize: 10, fontWeight: 900, color: '#10b981', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
                            {scanProgress < 40 ? 'Capturing frame…' : `Recognising text… ${scanProgress}%`}
                          </div>
                          <div style={{ width: '72%', height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 4 }}>
                            <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#10b981,#6ee7b7)', width: `${scanProgress}%`, transition: 'width .15s' }} />
                          </div>
                        </div>
                      )}


                    </div>

                    {/* Controls */}
                    <div style={{ padding: 14, display: 'flex', gap: 9, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                      {(scanPhase === 'idle' || scanPhase === 'error') && (
                        <button onClick={startScan} style={{ flex: 1, padding: '10px 0', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 11, color: '#10b981', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ▶ Start Camera
                        </button>
                      )}
                      {scanPhase === 'starting' && (
                        <button disabled style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 11, color: '#334155', fontSize: 10, fontWeight: 900, cursor: 'default' }}>
                          Starting…
                        </button>
                      )}
                      {scanPhase === 'live' && (
                        <>
                          <button onClick={captureScan} style={{ flex: 2, padding: '10px 0', background: '#10b981', border: 'none', borderRadius: 11, color: '#fff', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                            ⚡ Capture & Read
                          </button>
                          <button onClick={stopScan} style={{ flex: 1, padding: '10px 0', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 11, color: '#f87171', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                            ■ Stop
                          </button>
                        </>
                      )}
                      {scanPhase === 'processing' && (
                        <button disabled style={{ flex: 1, padding: '10px 0', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.1)', borderRadius: 11, color: '#10b981', fontSize: 10, fontWeight: 700, cursor: 'default' }}>
                          Processing {scanProgress}%…
                        </button>
                      )}
                      {scanPhase === 'done' && (
                        <>
                          <button onClick={rescan} style={{ flex: 1, padding: '10px 0', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 11, color: '#818cf8', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                            ↺ Scan Again
                          </button>
                          <button onClick={stopScan} style={{ flex: 1, padding: '10px 0', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 11, color: '#f87171', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                            ✕ Close
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tips card */}
                  <div style={{ background: 'rgba(16,185,129,.04)', border: '1px solid rgba(16,185,129,.1)', borderRadius: 16, padding: '14px 16px' }}>
                    <div style={{ fontSize: 9, color: '#10b981', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Tips for best results</div>
                    {['Hold document flat & steady', 'Good lighting — avoid shadows', 'Fill the frame with the document', 'Works best with printed text'].map(tip => (
                      <div key={tip} style={{ display: 'flex', gap: 7, marginBottom: 5, alignItems: 'center' }}>
                        <span style={{ color: '#10b981', fontSize: 10 }}>→</span>
                        <span style={{ fontSize: 11, color: '#475569' }}>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scanned text panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
                  <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ fontSize: 9, color: '#10b981', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Scanned Text</div>
                      {scanPhase === 'done' && scannedText && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                          <span style={{ fontSize: 9, color: '#334155', fontWeight: 700 }}>{scannedText.length} chars</span>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, color: '#94a3b8', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontFamily: "'Courier New', monospace" }}>
                      {scanPhase === 'done' && scannedText
                        ? scannedText
                        : scanPhase === 'processing'
                          ? <span style={{ color: '#334155', fontStyle: 'italic' }}>Recognising text, please wait…</span>
                          : <span style={{ color: '#334155', fontStyle: 'italic' }}>Start the camera and capture a document — extracted text will appear here.</span>
                      }
                    </div>
                    {scanPhase === 'done' && scannedText && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            if (window.speechSynthesis.speaking) { liveVoice.stopSpeaking(); return; }
                            liveVoice.speak(scannedText.slice(0, 1500));
                          }}
                          style={{ flex: 1, padding: '9px 0', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 11, color: '#10b981', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ▶ Read Aloud
                        </button>
                        <button
                          onClick={() => { navigator.clipboard?.writeText(scannedText); }}
                          style={{ flex: 1, padding: '9px 0', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 11, color: '#818cf8', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ⎘ Copy Text
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([scannedText], { type: 'text/plain' });
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                            a.download = 'scanned-document.txt'; a.click();
                          }}
                          style={{ flex: 1, padding: '9px 0', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 11, color: '#f59e0b', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ↓ Save TXT
                        </button>
                        <button
                          onClick={() => {
                            setConsoleInput('I have scanned a legal document. Here is the extracted text:\n\n' + scannedText.slice(0, 2500) + '\n\nPlease analyse this document and advise on legal implications.');
                            setView('consult');
                          }}
                          style={{ flex: '0 0 100%', padding: '10px 0', background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 11, color: '#818cf8', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}>⚡</span> Ask AI about this document → Open Consult
                        </button>
                        {/* [F09] Summarise Document */}
                        <button onClick={summariseDocument} disabled={docSummaryLoading}
                          style={{ flex: '0 0 100%', padding: '10px 0', background: docSummaryLoading ? 'rgba(16,185,129,.06)' : 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 11, color: docSummaryLoading ? '#475569' : '#10b981', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {docSummaryLoading ? '⏳ Summarising…' : '🗒 AI Summarise Document'}
                        </button>
                        {docSummary && (
                          <div style={{ flex: '0 0 100%', padding: '12px 14px', background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 11 }}>
                            <div style={{ fontSize: 9, color: '#10b981', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>AI Summary</div>
                            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{docSummary}</div>
                          </div>
                        )}
                        {/* [F06] Extract to Case */}
                        {clients.length > 0 && (
                          <div style={{ flex: '0 0 100%', padding: '12px 14px', background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.12)', borderRadius: 11 }}>
                            <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>📅 Extract Hearing Date to Case [F06]</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <select value={extractClientSlNo || ''} onChange={e => setExtractClientSlNo(e.target.value)}
                                style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 9, padding: '7px 11px', color: '#e2e8f0', fontSize: 11 }}>
                                <option value="">Select client…</option>
                                {clients.map(c => <option key={c.slNo} value={c.slNo} style={{ background: '#0a0f1d' }}>{c.name} — {c.caseNumber}</option>)}
                              </select>
                              <button onClick={extractFromOrder} disabled={extractLoading || !extractClientSlNo}
                                style={{ padding: '7px 14px', background: extractClientSlNo && !extractLoading ? 'rgba(245,158,11,.15)' : 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 9, color: extractClientSlNo ? '#f59e0b' : '#475569', fontSize: 10, fontWeight: 900, cursor: extractClientSlNo ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                                {extractLoading ? '…' : 'Extract →'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOC CONVERTER */}
          {view === 'doc-converter' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#070b14', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '16px 26px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#0a0f1d', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 3 }}>Camera OCR → AI Analysis → Export</div>
                  <h3 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', margin: 0 }}>Document<span style={{ color: '#475569', fontStyle: 'normal' }}> Converter</span></h3>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {convPages.length > 0 && (
                    <div style={{ padding: '5px 14px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 20, fontSize: 11, color: '#818cf8', fontWeight: 700 }}>
                      {convPages.length} page{convPages.length > 1 ? 's' : ''} captured
                    </div>
                  )}
                  {convPages.length > 0 && (
                    <button onClick={convReset} style={{ padding: '6px 14px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 10, color: '#f87171', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                      ✕ Reset
                    </button>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* LEFT: Camera + controls */}
                <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,.05)', overflow: 'hidden' }}>

                  {/* Camera viewport */}
                  <div style={{ flex: 1, background: '#050810', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 260 }}>
                    <canvas ref={convCanvasRef} style={{ display: 'none' }} />

                    {(convPhase === 'idle' || convPhase === 'error') && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 28, textAlign: 'center' }}>
                        <div style={{ width: 72, height: 72, borderRadius: 22, background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                          <Icon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" size={32} strokeWidth={1.5} />
                        </div>
                        {convError
                          ? <p style={{ fontSize: 12, color: '#f87171', lineHeight: 1.6, margin: 0 }}>{convError}</p>
                          : <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, margin: 0 }}>Scan multi-page legal documents.<br />Each capture becomes one page.<br />AI will analyse the full document.</p>
                        }
                      </div>
                    )}

                    {convPhase === 'starting' && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div className="spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(99,102,241,.2)', borderTopColor: '#6366f1' }} />
                        <p style={{ fontSize: 11, color: '#818cf8', fontWeight: 700 }}>Starting camera…</p>
                      </div>
                    )}

                    <video ref={convVideoRef} autoPlay playsInline muted
                      style={{ display: (convPhase === 'live' || convPhase === 'processing') ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover', minHeight: 260, filter: convPhase === 'processing' ? 'brightness(0.4)' : 'none' }}
                    />

                    {convPhase === 'live' && (
                      <>
                        <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#6366f1,#818cf8,#6366f1,transparent)', boxShadow: '0 0 14px 4px rgba(99,102,241,.5)', animation: 'scanLine 2s ease-in-out infinite' }} />
                        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', borderRadius: 8, padding: '4px 10px', border: '1px solid rgba(239,68,68,.3)' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse2 1s infinite' }} />
                          <span style={{ fontSize: 9, fontWeight: 900, color: '#ef4444', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Live</span>
                        </div>
                        {convPages.length > 0 && (
                          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(99,102,241,.85)', borderRadius: 8, padding: '4px 10px' }}>
                            <span style={{ fontSize: 9, fontWeight: 900, color: '#fff' }}>Page {convPages.length + 1}</span>
                          </div>
                        )}
                        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,.5)', fontWeight: 700, background: 'rgba(0,0,0,.5)', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          Hold document steady · tap Capture
                        </div>
                      </>
                    )}

                    {convPhase === 'processing' && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 }}>
                        <div className="spin" style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(99,102,241,.2)', borderTopColor: '#6366f1' }} />
                        <div style={{ fontSize: 10, fontWeight: 900, color: '#818cf8', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                          {convProgress < 30 ? 'Capturing…' : `Reading text… ${convProgress}%`}
                        </div>
                        <div style={{ width: '72%', height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 4 }}>
                          <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#6366f1,#818cf8)', width: `${convProgress}%`, transition: 'width .15s' }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera controls */}
                  <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,.05)', display: 'flex', gap: 8, flexWrap: 'wrap', background: '#0a0f1d' }}>
                    {(convPhase === 'idle' || convPhase === 'error') && (
                      <button onClick={convStartCamera} style={{ flex: 1, padding: '10px 0', background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', borderRadius: 11, color: '#818cf8', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                        ▶ Start Camera
                      </button>
                    )}
                    {convPhase === 'starting' && (
                      <button disabled style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 11, color: '#334155', fontSize: 10, fontWeight: 700, cursor: 'default' }}>Starting…</button>
                    )}
                    {convPhase === 'live' && (
                      <>
                        <button onClick={convCapturePage} style={{ flex: 2, padding: '10px 0', background: '#6366f1', border: 'none', borderRadius: 11, color: '#fff', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ⚡ Capture Page {convPages.length + 1}
                        </button>
                        {convPages.length > 0 && (
                          <button onClick={convFinish} style={{ flex: 1, padding: '10px 0', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 11, color: '#10b981', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                            ✓ Done
                          </button>
                        )}
                        <button onClick={convStopCamera} style={{ flex: 1, padding: '10px 0', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 11, color: '#f87171', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ■ Stop
                        </button>
                      </>
                    )}
                    {convPhase === 'processing' && (
                      <button disabled style={{ flex: 1, padding: '10px 0', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.1)', borderRadius: 11, color: '#6366f1', fontSize: 10, fontWeight: 700, cursor: 'default' }}>
                        Processing {convProgress}%…
                      </button>
                    )}
                    {convPhase === 'done' && (
                      <>
                        <button onClick={() => { setConvPhase('idle'); convStartCamera(); }} style={{ flex: 1, padding: '10px 0', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 11, color: '#818cf8', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          + Add More Pages
                        </button>
                        <button onClick={convReset} style={{ flex: 1, padding: '10px 0', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 11, color: '#f87171', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ✕ Reset All
                        </button>
                      </>
                    )}
                  </div>

                  {/* Captured pages thumbnails */}
                  {convPages.length > 0 && (
                    <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.05)', background: '#070b14' }}>
                      <div style={{ fontSize: 8, color: '#475569', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Captured Pages</div>
                      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {convPages.map((p, i) => (
                          <div key={p.id} style={{ flexShrink: 0, position: 'relative' }}>
                            <img src={p.dataUrl} alt={`Page ${i+1}`} style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(99,102,241,.3)' }} />
                            <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(99,102,241,.9)', borderRadius: 4, padding: '1px 5px', fontSize: 8, color: '#fff', fontWeight: 900 }}>{i + 1}</div>
                            <button onClick={() => setConvPages(ps => ps.filter((_, idx) => idx !== i))}
                              style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 9, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: AI Analysis + Text + Export */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {convPages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center', opacity: .5 }}>
                      <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={44} strokeWidth={1} />
                      <p style={{ fontSize: 13, color: '#475569' }}>Capture document pages using the camera.<br/>AI analysis and export will appear here.</p>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                      {/* AI Analysis panel */}
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#0a0f1d', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: convAiSummary ? 12 : 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontSize: 8, fontWeight: 900 }}>AI</div>
                          <div>
                            <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase' }}>AI Legal Analysis</div>
                            <div style={{ fontSize: 11, color: '#475569' }}>{convPages.length} page{convPages.length > 1 ? 's' : ''} · {convPages.reduce((a, p) => a + p.text.length, 0)} chars extracted</div>
                          </div>
                          <button
                            onClick={convAiAnalyse}
                            disabled={convAiLoading}
                            style={{ marginLeft: 'auto', padding: '8px 18px', background: convAiLoading ? 'rgba(99,102,241,.2)' : '#6366f1', border: 'none', borderRadius: 10, color: '#fff', fontSize: 10, fontWeight: 900, cursor: convAiLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {convAiLoading ? <><div className="spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff' }} /> Analysing…</> : '⚡ Analyse with AI'}
                          </button>
                        </div>
                        {convAiSummary && (
                          <div style={{ background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto' }}>
                            {convAiSummary}
                          </div>
                        )}
                        {convAiLoading && !convAiSummary && (
                          <div style={{ display: 'flex', gap: 5, padding: '10px 0' }}>
                            {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#475569', animationName: 'pulse2', animationDuration: '1.2s', animationIterationCount: 'infinite', animationDelay: `${i * 0.2}s` }} />)}
                          </div>
                        )}
                      </div>

                      {/* Extracted text per page */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                        <div style={{ fontSize: 9, color: '#475569', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Extracted Text</div>
                        {convPages.map((p, i) => (
                          <div key={p.id} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>Page {i + 1}</span>
                              <span style={{ color: '#334155', fontSize: 8 }}>{p.text.length} chars</span>
                            </div>
                            <div style={{ background: '#0a0f1d', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: '#94a3b8', lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: "'Courier New', monospace", border: '1px solid rgba(255,255,255,.05)' }}>
                              {p.text || <span style={{ color: '#334155', fontStyle: 'italic' }}>No text detected on this page.</span>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Export bar */}
                      <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,.05)', background: '#0a0f1d', display: 'flex', gap: 8 }}>
                        <div style={{ fontSize: 9, color: '#475569', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', marginRight: 4 }}>Export:</div>
                        <button onClick={convExportTxt} style={{ flex: 1, padding: '9px 0', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, color: '#10b981', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ↓ Save as TXT
                        </button>
                        <button
                          onClick={() => {
                            const allText = convPages.map((p, i) => `=== PAGE ${i+1} ===\n${p.text}`).join('\n\n');
                            const summary = convAiSummary ? `\n\n=== AI ANALYSIS ===\n${convAiSummary}` : '';
                            navigator.clipboard?.writeText(allText + summary);
                          }}
                          style={{ flex: 1, padding: '9px 0', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 10, color: '#818cf8', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          ⎘ Copy All
                        </button>
                        <button
                          onClick={() => {
                            const allText = convPages.map((p, i) => `=== PAGE ${i+1} ===\n${p.text}`).join('\n\n');
                            const summary = convAiSummary ? `\n\n=== AI ANALYSIS ===\n${convAiSummary}` : '';
                            setConsoleInput('I have scanned a document. Here is the extracted text:\n\n' + allText.slice(0, 2000) + '\n\nPlease advise on this document.');
                            setView('consult');
                          }}
                          style={{ flex: 1, padding: '9px 0', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, color: '#f59e0b', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                          → Send to Consult AI
                        </button>
                      </div>

                      {/* ── GEMINI TRANSLATOR ── */}
                      <div style={{ borderTop: '2px solid rgba(99,102,241,.15)', background: '#070b14', flexShrink: 0 }}>

                        {/* Translator header */}
                        <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🇮🇳</div>
                          <div>
                            <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Gemini AI · Indian Language Translator</div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>Translate scanned document into any Indian language</div>
                          </div>
                          {convPages.length > 0 && (
                            <button
                              onClick={useScannedTextForTranslation}
                              style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 9, color: '#a78bfa', fontSize: 9, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              ← Use Scanned Text
                            </button>
                          )}
                        </div>

                        {/* Language selector */}
                        <div style={{ padding: '0 18px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {SARVAM_LANGS.map(lang => (
                            <button
                              key={lang.code}
                              onClick={() => { setTransTargetLang(lang.code); setTransResult(''); setTransError(''); }}
                              style={{
                                padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all .15s',
                                background: transTargetLang === lang.code ? 'rgba(139,92,246,.2)' : 'rgba(255,255,255,.04)',
                                border: `1px solid ${transTargetLang === lang.code ? 'rgba(139,92,246,.5)' : 'rgba(255,255,255,.07)'}`,
                                color: transTargetLang === lang.code ? '#c4b5fd' : '#475569',
                              }}>
                              {lang.native} <span style={{ fontSize: 9, opacity: .7 }}>{lang.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Source + Target text boxes */}
                        <div style={{ padding: '0 18px 14px', display: 'flex', gap: 10 }}>

                          {/* Source (English) */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 9, color: '#475569', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>English Source</span>
                              <span style={{ fontSize: 9, color: '#334155', fontWeight: 700 }}>{transSourceText.length}/2000</span>
                            </div>
                            <textarea
                              value={transSourceText}
                              onChange={e => { setTransSourceText(e.target.value.slice(0, 2000)); setTransResult(''); setTransError(''); }}
                              placeholder="Paste or type English text here, or click ← Use Scanned Text above…"
                              rows={5}
                              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '11px 13px', fontSize: 12, lineHeight: 1.65, resize: 'vertical', color: '#e2e8f0', outline: 'none', fontFamily: 'inherit' }}
                            />
                          </div>

                          {/* Arrow + Translate button */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0, paddingTop: 22 }}>
                            <button
                              onClick={doTranslate}
                              disabled={transLoading || !transSourceText.trim()}
                              style={{
                                width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: transSourceText.trim() ? 'pointer' : 'default',
                                background: transSourceText.trim() ? '#8b5cf6' : 'rgba(139,92,246,.2)',
                                color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: transSourceText.trim() ? '0 0 16px rgba(139,92,246,.4)' : 'none',
                                transition: 'all .2s',
                              }}>
                              {transLoading
                                ? <div className="spin" style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff' }} />
                                : '→'}
                            </button>
                            <span style={{ fontSize: 8, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                              {transLoading ? 'Translating' : 'Translate'}
                            </span>
                          </div>

                          {/* Target (Indian language) */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                {SARVAM_LANGS.find(l => l.code === transTargetLang)?.native} Translation
                              </span>
                              {transFallback && <span style={{ fontSize: 8, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,.1)', padding: '2px 7px', borderRadius: 10 }}>AI Fallback</span>}
                            </div>
                            <div
                              style={{
                                flex: 1, minHeight: 107, background: transResult ? 'rgba(139,92,246,.06)' : 'rgba(255,255,255,.02)',
                                border: `1px solid ${transResult ? 'rgba(139,92,246,.25)' : 'rgba(255,255,255,.06)'}`,
                                borderRadius: 12, padding: '11px 13px', fontSize: 14, lineHeight: 1.8,
                                color: transResult ? '#e2e8f0' : '#334155', fontStyle: transResult ? 'normal' : 'italic',
                                overflowY: 'auto', direction: transTargetLang === 'ur-IN' ? 'rtl' : 'ltr',
                              }}>
                              {transError
                                ? <span style={{ color: '#f87171', fontStyle: 'normal', fontSize: 12 }}>{transError}</span>
                                : transLoading
                                  ? <div style={{ display: 'flex', gap: 5, paddingTop: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6', animationName: 'pulse2', animationDuration: '1.2s', animationIterationCount: 'infinite', animationDelay: `${i*0.2}s` }} />)}</div>
                                  : transResult || 'Translation will appear here…'
                              }
                            </div>
                          </div>
                        </div>

                        {/* Action buttons when translation is ready */}
                        {transResult && !transLoading && (
                          <div style={{ padding: '0 18px 16px', display: 'flex', gap: 8 }}>
                            <button
                              onClick={doTts}
                              disabled={transTtsLoading}
                              style={{ flex: 1, padding: '9px 0', background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 10, color: '#a78bfa', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              {transTtsLoading
                                ? <><div className="spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa' }} /> Speaking…</>
                                : '🔊 Read Aloud (Gemini TTS)'}
                            </button>
                            <button
                              onClick={() => navigator.clipboard?.writeText(transResult)}
                              style={{ flex: 1, padding: '9px 0', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, color: '#64748b', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                              ⎘ Copy Translation
                            </button>
                            <button
                              onClick={() => {
                                const blob = new Blob([`ORIGINAL (English):\n${transSourceText}\n\nTRANSLATION (${SARVAM_LANGS.find(l=>l.code===transTargetLang)?.label}):\n${transResult}`], { type: 'text/plain' });
                                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                                a.download = `translated-${transTargetLang}.txt`; a.click();
                              }}
                              style={{ flex: 1, padding: '9px 0', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.18)', borderRadius: 10, color: '#10b981', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                              ↓ Save Translation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── TRANSLATOR ── */}
              <div style={{ borderTop: '2px solid rgba(255,255,255,.06)', background: '#020617' }}>
                <div style={{ padding: '16px 26px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 3 }}>Powered by Gemini AI · 12 Indian Languages</div>
                    <h4 style={{ fontSize: 18, fontWeight: 900, fontStyle: 'italic', margin: 0 }}>Document <span style={{ color: '#475569', fontStyle: 'normal' }}>Translator</span></h4>
                  </div>
                  {convPages.length > 0 && (
                    <button onClick={useScannedTextForTranslation}
                      style={{ padding: '7px 16px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10, color: '#f59e0b', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                      ↑ Use Scanned Text
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 0, minHeight: 220 }}>

                  {/* Source text */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px 16px 26px' }}>
                    <div style={{ fontSize: 9, color: '#475569', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Source Text (English)
                      <span style={{ color: '#334155', fontSize: 8 }}>{transSourceText.length}/2000</span>
                    </div>
                    <textarea
                      value={transSourceText}
                      onChange={e => { setTransSourceText(e.target.value.slice(0, 2000)); setTransResult(''); }}
                      placeholder="Paste or type English text here, or use ↑ Use Scanned Text above…"
                      style={{ flex: 1, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.7, resize: 'none', minHeight: 140, fontFamily: 'inherit' }}
                    />
                  </div>

                  {/* Middle controls */}
                  <div style={{ width: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 8px', flexShrink: 0 }}>
                    {/* Language selector */}
                    <div style={{ width: '100%' }}>
                      <div style={{ fontSize: 8, color: '#475569', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 5, textAlign: 'center' }}>Translate to</div>
                      <select
                        value={transTargetLang}
                        onChange={e => { setTransTargetLang(e.target.value); setTransResult(''); }}
                        style={{ width: '100%', background: '#0a0f1d', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '8px 10px', fontSize: 12, color: '#e2e8f0', cursor: 'pointer' }}>
                        {SARVAM_LANGS.map(l => (
                          <option key={l.code} value={l.code}>{l.native} — {l.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Translate button */}
                    <button
                      onClick={doTranslate}
                      disabled={transLoading || !transSourceText.trim()}
                      style={{ width: '100%', padding: '10px 0', background: transLoading || !transSourceText.trim() ? 'rgba(245,158,11,.2)' : '#f59e0b', border: 'none', borderRadius: 11, color: transLoading || !transSourceText.trim() ? '#64748b' : '#000', fontSize: 10, fontWeight: 900, cursor: transLoading || !transSourceText.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .2s' }}>
                      {transLoading
                        ? <><div className="spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(0,0,0,.2)', borderTopColor: '#000' }} /> Translating…</>
                        : '⟶ Translate'}
                    </button>

                    {transFallback && (
                      <div style={{ fontSize: 8, color: '#f59e0b', textAlign: 'center', opacity: .7, lineHeight: 1.4 }}>
                        ⚠ Translation Service unavailable<br/>Used AI fallback
                      </div>
                    )}
                  </div>

                  {/* Translated output */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 26px 16px 16px' }}>
                    <div style={{ fontSize: 9, color: '#475569', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {SARVAM_LANGS.find(l => l.code === transTargetLang)?.native} — {SARVAM_LANGS.find(l => l.code === transTargetLang)?.label}
                      {transResult && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                          <button onClick={doTts} disabled={transTtsLoading}
                            style={{ padding: '3px 10px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, color: '#10b981', fontSize: 9, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {transTtsLoading ? <div className="spin" style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(16,185,129,.3)', borderTopColor: '#10b981' }} /> : '▶'} Read
                          </button>
                          <button onClick={() => navigator.clipboard?.writeText(transResult)}
                            style={{ padding: '3px 10px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8, color: '#818cf8', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
                            ⎘ Copy
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, background: 'rgba(245,158,11,.03)', border: `1px solid ${transResult ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.07)'}`, borderRadius: 12, padding: '12px 14px', fontSize: 13, color: transResult ? '#fde68a' : '#334155', lineHeight: 1.85, minHeight: 140, whiteSpace: 'pre-wrap', overflowY: 'auto', fontStyle: transResult ? 'normal' : 'italic', transition: 'all .3s' }}>
                      {transLoading
                        ? <div style={{ display: 'flex', gap: 5, padding: '4px 0' }}>{[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', animationName: 'pulse2', animationDuration: '1.2s', animationIterationCount: 'infinite', animationDelay: `${i*0.2}s` }} />)}</div>
                        : transError
                          ? <span style={{ color: '#f87171' }}>{transError}</span>
                          : transResult || 'Translation will appear here…'
                      }
                    </div>
                  </div>
                </div>

                {/* Quick language chips */}
                <div style={{ padding: '8px 26px 18px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, color: '#334155', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', alignSelf: 'center', marginRight: 4 }}>Quick:</span>
                  {SARVAM_LANGS.map(l => (
                    <button key={l.code} onClick={() => { setTransTargetLang(l.code); setTransResult(''); }}
                      style={{ padding: '4px 12px', borderRadius: 20, background: transTargetLang === l.code ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.03)', border: `1px solid ${transTargetLang === l.code ? 'rgba(245,158,11,.35)' : 'rgba(255,255,255,.07)'}`, color: transTargetLang === l.code ? '#f59e0b' : '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
                      {l.native}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ WRITING DESK ══ */}
          {view === 'writing-desk' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* ── Toolbar ── */}
              <div style={{ background: '#070b14', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={{ marginRight: 2 }}>
                  <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>AI Drafting Studio</div>
                  <div style={{ fontSize: 14, fontWeight: 900, fontStyle: 'italic', color: '#e2e8f0', lineHeight: 1.1 }}>Writing <span style={{ color: '#475569', fontStyle: 'normal' }}>Desk</span></div>
                </div>
                <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.07)' }} />
                {/* View toggle */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)', borderRadius: 9, padding: 3, gap: 2 }}>
                  {[['split','Split'],['draft','Draft'],['chat','AI Chat']].map(([v,l]) => (
                    <button key={v} onClick={() => setDeskView(v)} style={{ padding: '4px 11px', borderRadius: 7, background: deskView===v ? '#1e293b' : 'transparent', border: deskView===v ? '1px solid rgba(255,255,255,.08)' : '1px solid transparent', color: deskView===v ? '#e2e8f0' : '#475569', fontSize: 9, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</button>
                  ))}
                </div>
                <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.07)' }} />
                {/* Suggestions summary */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {[['pending','#f59e0b','Pending'],['accepted','#10b981','OK'],['rejected','#ef4444','Out']].map(([st,col,lbl]) => {
                    const n = draftSuggestions.filter(s=>s.status===st).length;
                    return n > 0 ? (
                      <div key={st} style={{ display:'flex',alignItems:'center',gap:4,padding:'3px 8px',background:`rgba(${col==='#f59e0b'?'245,158,11':col==='#10b981'?'16,185,129':'239,68,68'},.08)`,border:`1px solid ${col}22`,borderRadius:20 }}>
                        <span style={{ width:5,height:5,borderRadius:'50%',background:col,display:'inline-block' }}/>
                        <span style={{ fontSize:8,fontWeight:900,color:col,letterSpacing:'0.1em',textTransform:'uppercase' }}>{n} {lbl}</span>
                      </div>
                    ) : null;
                  })}
                </div>
                {/* TTS status */}
                {isSpeaking && (
                  <div style={{ display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:20 }}>
                    <span className="pulse-a" style={{ width:6,height:6,borderRadius:'50%',background:'#10b981',display:'inline-block' }}/>
                    <span style={{ fontSize:9,fontWeight:900,color:'#10b981',textTransform:'uppercase',letterSpacing:'0.1em' }}>Reading P.{speakPageNum}</span>
                    <button onClick={stopSpeaking} style={{ background:'none',border:'none',color:'#10b981',cursor:'pointer',fontSize:11,padding:0,marginLeft:2 }}>■</button>
                  </div>
                )}
                {/* Voice listening badge */}
                {voiceListening && (
                  <div style={{ display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',borderRadius:20 }}>
                    <span className="pulse-a" style={{ width:6,height:6,borderRadius:'50%',background:'#ef4444',display:'inline-block' }}/>
                    <span style={{ fontSize:9,fontWeight:900,color:'#ef4444',textTransform:'uppercase',letterSpacing:'0.1em' }}>Listening…</span>
                    {voiceTranscript && <span style={{ fontSize:9,color:'#94a3b8',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{voiceTranscript}</span>}
                  </div>
                )}
                <div style={{ marginLeft:'auto',display:'flex',gap:7,alignItems:'center' }}>
                  <button onClick={() => setShowModelUpload(v=>!v)} style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 12px',background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',borderRadius:9,color:'#f59e0b',fontSize:9,fontWeight:900,cursor:'pointer' }}>
                    <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" size={12} strokeWidth={2}/> Model
                  </button>
                  <button style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 12px',background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.2)',borderRadius:9,color:'#818cf8',fontSize:9,fontWeight:900,cursor:'pointer' }}>
                    <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" size={12} strokeWidth={2}/> Export
                  </button>
                </div>
              </div>

              {/* ── Page navigator bar ── */}
              <div style={{ background:'#050810',borderBottom:'1px solid rgba(255,255,255,.05)',padding:'7px 16px',display:'flex',alignItems:'center',gap:6,flexShrink:0,overflowX:'auto' }} className="tab-scroll">
                <span style={{ fontSize:8,fontWeight:900,color:'#334155',textTransform:'uppercase',letterSpacing:'0.2em',marginRight:4,whiteSpace:'nowrap' }}>Pages</span>
                {draftPages.map((pg, i) => (
                  <button key={i} onClick={() => setCurrentPage(i+1)} style={{
                    minWidth:32,height:28,borderRadius:7,
                    background: currentPage===i+1 ? '#6366f1' : 'rgba(255,255,255,.04)',
                    border: currentPage===i+1 ? '1px solid #818cf8' : '1px solid rgba(255,255,255,.06)',
                    color: currentPage===i+1 ? '#fff' : '#475569',
                    fontSize:10,fontWeight:900,cursor:'pointer',transition:'all .15s',
                    display:'flex',alignItems:'center',justifyContent:'center',gap:4,padding:'0 8px',
                    boxShadow: currentPage===i+1 ? '0 0 12px rgba(99,102,241,.4)' : 'none'
                  }}>
                    {i+1}
                    {isSpeaking && speakPageNum===i+1 && <span style={{ width:4,height:4,borderRadius:'50%',background:'#10b981',display:'inline-block',animation:'pulse2 .8s infinite' }}/>}
                  </button>
                ))}
                {draftPages.length < MAX_PAGES ? (
                  <button onClick={addNewPage} style={{ minWidth:32,height:28,borderRadius:7,background:'rgba(16,185,129,.06)',border:'1px dashed rgba(16,185,129,.2)',color:'#10b981',fontSize:14,fontWeight:900,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 8px' }}>+</button>
                ) : (
                  <span style={{ fontSize:8,color:'#ef4444',fontWeight:700,padding:'0 8px',whiteSpace:'nowrap' }}>20-page limit reached</span>
                )}
                <span style={{ marginLeft:'auto',fontSize:8,color:'#334155',fontWeight:700,whiteSpace:'nowrap' }}>{draftPages.length}/{MAX_PAGES} pages · {draftPages.reduce((a,p)=>a+p.length,0)} chars</span>
                {/* Read aloud current page button */}
                <button
                  onClick={() => isSpeaking ? stopSpeaking() : readPageAloud(currentPage-1)}
                  style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 11px',background:isSpeaking?'rgba(16,185,129,.12)':'rgba(255,255,255,.04)',border:`1px solid ${isSpeaking?'rgba(16,185,129,.3)':'rgba(255,255,255,.07)'}`,borderRadius:9,color:isSpeaking?'#10b981':'#64748b',fontSize:9,fontWeight:900,cursor:'pointer',whiteSpace:'nowrap' }}>
                  <Icon path={isSpeaking?"M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z":"M15.536 8.464a5 5 0 010 7.072M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13"} size={12} strokeWidth={2}/>
                  {isSpeaking ? 'Stop' : 'Read P.'+(currentPage)}
                </button>
                {/* Save draft to Drive */}
                {gdrive.connected && (
                  <button onClick={gdriveSaveDraft}
                    title="Save entire draft to your Google Drive (Drafts folder)"
                    style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 11px',background:'rgba(16,185,129,.07)',border:'1px solid rgba(16,185,129,.2)',borderRadius:9,color:'#10b981',fontSize:9,fontWeight:900,cursor:'pointer',whiteSpace:'nowrap' }}>
                    <Icon path="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" size={12} strokeWidth={2}/>
                    Save to Drive
                  </button>
                )}
              </div>

              {/* ── Model draft upload panel ── */}
              {showModelUpload && (
                <div style={{ background:'#070b14',borderBottom:'1px solid rgba(255,255,255,.06)',padding:'12px 16px',flexShrink:0,animation:'slideIn .2s ease' }}>
                  <div style={{ display:'flex',gap:14,alignItems:'flex-start' }}>
                    <div className={`model-drop${modelDraftDragOver?' over':''}`}
                      style={{ flex:1,padding:'13px 18px',display:'flex',alignItems:'center',gap:12 }}
                      onDragOver={e=>{e.preventDefault();setModelDraftDragOver(true);}}
                      onDragLeave={()=>setModelDraftDragOver(false)}
                      onDrop={e=>{e.preventDefault();setModelDraftDragOver(false);const f=e.dataTransfer.files[0];if(f){setModelDraftName(f.name);setUploadedModels(m=>[...m,{id:Date.now(),name:f.name,date:new Date().toISOString().slice(0,10)}]);}}}
                      onClick={()=>modelFileRef.current?.click()}>
                      <input ref={modelFileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f){setModelDraftName(f.name);setUploadedModels(m=>[...m,{id:Date.now(),name:f.name,date:new Date().toISOString().slice(0,10)}]);}}}/>
                      <div style={{width:34,height:34,borderRadius:9,background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#f59e0b',flexShrink:0}}>
                        <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={18} strokeWidth={1.5}/>
                      </div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:'#e2e8f0',marginBottom:2}}>Upload Model Draft</div>
                        <div style={{fontSize:10,color:'#475569'}}>Drop PDF/DOC/TXT — AI uses it as drafting reference</div>
                      </div>
                      <div style={{marginLeft:'auto',padding:'5px 12px',background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.2)',borderRadius:7,color:'#f59e0b',fontSize:9,fontWeight:900,whiteSpace:'nowrap'}}>Browse</div>
                    </div>
                    {uploadedModels.length > 0 && (
                      <div style={{width:260,flexShrink:0}}>
                        <div style={{fontSize:8,color:'#475569',fontWeight:900,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:6}}>Loaded ({uploadedModels.length})</div>
                        <div style={{display:'flex',flexDirection:'column',gap:4}}>
                          {uploadedModels.map(m=>(
                            <div key={m.id} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.05)'}}>
                              <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={12} strokeWidth={1.5} style={{color:'#f59e0b',flexShrink:0}}/>
                              <span style={{fontSize:10,color:'#94a3b8',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</span>
                              <span style={{fontSize:8,color:'#334155',flexShrink:0}}>{m.date}</span>
                              <button onClick={()=>setUploadedModels(ms=>ms.filter(x=>x.id!==m.id))} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',padding:2,flexShrink:0}}>✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 3-panel body ── */}
              <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

                {/* LEFT: Draft Viewer */}
                {(deskView==='split' || deskView==='draft') && (
                  <div style={{ flex: deskView==='draft'?1:'0 0 52%', display:'flex', flexDirection:'column', borderRight:deskView==='split'?'1px solid rgba(255,255,255,.05)':'none', overflow:'hidden' }}>

                    {/* Page header */}
                    <div style={{ padding:'10px 18px', borderBottom:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', gap:8, flexShrink:0, background:'#0a0f1d', flexWrap:'wrap' }}>
                      <div style={{ width:7,height:7,borderRadius:'50%',background:'#10b981' }}/>
                      <span style={{ fontSize:9,fontWeight:900,color:'#6366f1',letterSpacing:'0.15em',textTransform:'uppercase' }}>Page {currentPage} of {draftPages.length}</span>
                      <span style={{ fontSize:8,color:'#334155',fontWeight:700 }}>{(draftPages[currentPage-1]||'').length} chars</span>
                      <div style={{ display:'flex',gap:4 }}>
                        <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} style={{ padding:'3px 8px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.06)',borderRadius:6,color:currentPage===1?'#1e293b':'#64748b',fontSize:10,cursor:currentPage===1?'default':'pointer' }}>‹</button>
                        <button onClick={()=>setCurrentPage(p=>Math.min(draftPages.length,p+1))} disabled={currentPage===draftPages.length} style={{ padding:'3px 8px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.06)',borderRadius:6,color:currentPage===draftPages.length?'#1e293b':'#64748b',fontSize:10,cursor:currentPage===draftPages.length?'default':'pointer' }}>›</button>
                      </div>
                      <button onClick={()=>isSpeaking?stopSpeaking():readPageAloud(currentPage-1)} style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 9px',background:isSpeaking&&speakPageNum===currentPage?'rgba(16,185,129,.12)':'rgba(255,255,255,.04)',border:`1px solid ${isSpeaking&&speakPageNum===currentPage?'rgba(16,185,129,.3)':'rgba(255,255,255,.06)'}`,borderRadius:7,color:isSpeaking&&speakPageNum===currentPage?'#10b981':'#475569',fontSize:9,fontWeight:700,cursor:'pointer' }}>
                        <Icon path={isSpeaking&&speakPageNum===currentPage?"M10 9v6m4-6v6":"M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"} size={11} strokeWidth={2}/>
                        {isSpeaking&&speakPageNum===currentPage?'Stop':'Read'}
                      </button>
                      <button onClick={()=>setDraftEditMode(true)} style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 10px',background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',borderRadius:7,color:'#f59e0b',fontSize:9,fontWeight:900,cursor:'pointer' }}>
                        ✎ Edit Page
                      </button>
                      {draftPages.length>1 && <button onClick={()=>deletePage(currentPage-1)} style={{ padding:'4px 9px',background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.12)',borderRadius:7,color:'#f87171',fontSize:9,fontWeight:700,cursor:'pointer' }}>Del</button>}
                      <div style={{ display:'flex',gap:5,marginLeft:'auto' }}>
                        {['#ef4444','#f59e0b','#10b981'].map((c,k)=><div key={k} style={{width:9,height:9,borderRadius:'50%',background:c,opacity:.55}}/>)}
                      </div>
                    </div>

                    {/* ── SCROLLABLE DRAFT DOCUMENT ── */}
                    <div style={{ flex:1, overflowY:'scroll', background:'#0d1117', padding:'28px 32px 60px' }}>
                      {draftSuggestions.filter(s=>s.status==='accepted').length > 0 && (
                        <div style={{ background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.15)',borderRadius:9,padding:'6px 14px',marginBottom:20,display:'flex',alignItems:'center',gap:7 }}>
                          <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={13} strokeWidth={2} style={{color:'#10b981'}}/>
                          <span style={{fontSize:10,color:'#10b981',fontWeight:600}}>{draftSuggestions.filter(s=>s.status==='accepted').length} suggestion(s) accepted</span>
                        </div>
                      )}
                      {/* Render every line as a <p> — fully scrollable, no textarea traps */}
                      {(draftPages[currentPage-1]||'').split('\n').map((line, i) => (
                        <p key={i} style={{
                          margin: line.trim()==='' ? '0 0 8px' : '0 0 4px',
                          fontFamily:"'Courier New',monospace",
                          fontSize: 12.5,
                          lineHeight: 1.85,
                          color: line.trim()==='' ? 'transparent' : line===line.toUpperCase()&&line.trim().length>2 ? '#e2e8f0' : '#cbd5e1',
                          fontWeight: line===line.toUpperCase()&&line.trim().length>2 ? 700 : 400,
                          letterSpacing: line===line.toUpperCase()&&line.trim().length>2 ? '0.02em' : 'normal',
                          borderBottom: line===line.toUpperCase()&&line.trim().length>2&&i>0 ? '1px solid rgba(255,255,255,.06)' : 'none',
                          paddingBottom: line===line.toUpperCase()&&line.trim().length>2&&i>0 ? 8 : 0,
                          paddingTop: line===line.toUpperCase()&&line.trim().length>2&&i>0 ? 14 : 0,
                          minHeight: line.trim()==='' ? 10 : 'auto',
                          whiteSpace:'pre-wrap',
                          wordBreak:'break-word',
                          userSelect:'text',
                        }}>{line||'\u00A0'}</p>
                      ))}
                      {/* Page end marker */}
                      <div style={{ marginTop:32, paddingTop:16, borderTop:'1px dashed rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                        <span style={{ fontSize:9, color:'#1e293b', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase' }}>— Page {currentPage} End —</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* ── EDIT MODAL overlay ── */}
                {draftEditMode && (
                  <div style={{ position:'absolute', inset:0, zIndex:200, background:'rgba(2,6,23,.92)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:32 }}>
                    <div style={{ width:'100%', maxWidth:740, height:'80vh', background:'#0a0f1d', borderRadius:20, border:'1px solid rgba(245,158,11,.2)', display:'flex', flexDirection:'column', boxShadow:'0 40px 100px rgba(0,0,0,.8)' }}>
                      <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                        <span style={{ fontSize:10,fontWeight:900,color:'#f59e0b',letterSpacing:'0.15em',textTransform:'uppercase' }}>✎ Edit — Page {currentPage}</span>
                        <span style={{ fontSize:9,color:'#334155',fontWeight:700 }}>{(draftPages[currentPage-1]||'').length} chars</span>
                        <div style={{ marginLeft:'auto',display:'flex',gap:8 }}>
                          <button onClick={()=>setDraftEditMode(false)} style={{ padding:'7px 20px',background:'#6366f1',border:'none',borderRadius:9,color:'#fff',fontSize:10,fontWeight:900,cursor:'pointer' }}>✓ Done</button>
                        </div>
                      </div>
                      <textarea
                        autoFocus
                        value={draftPages[currentPage-1]||''}
                        onChange={e=>updatePage(currentPage-1,e.target.value)}
                        style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#cbd5e1', fontFamily:"'Courier New',monospace", fontSize:12.5, lineHeight:1.9, padding:'20px 24px', resize:'none', overflowY:'auto' }}
                        spellCheck={false}
                        placeholder="Edit this page…"
                      />
                    </div>
                  </div>
                )}

                {/* RIGHT: Suggestions + AI Chat */}
                {(deskView==='split' || deskView==='chat') && (
                  <div style={{ flex: deskView==='chat'?1:'0 0 48%', display:'flex',flexDirection:'column',overflow:'hidden' }}>

                    {/* Suggestions panel (split only) */}
                    {deskView==='split' && (
                      <div style={{ flexShrink:0,maxHeight:'42%',display:'flex',flexDirection:'column',borderBottom:'1px solid rgba(255,255,255,.05)',overflow:'hidden' }}>
                        <div style={{ padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,.04)',display:'flex',alignItems:'center',gap:7,background:'#0a0f1d',flexShrink:0 }}>
                          <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={13} strokeWidth={2} style={{color:'#f59e0b'}}/>
                          <span style={{fontSize:9,fontWeight:900,color:'#94a3b8',letterSpacing:'0.15em',textTransform:'uppercase'}}>AI Suggestions</span>
                          <button onClick={refreshSuggestions} disabled={suggestionsLoading}
                            title="Refresh AI suggestions for current page [F02]"
                            style={{ marginLeft:'auto', padding:'3px 9px', background: suggestionsLoading?'rgba(245,158,11,.05)':'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.2)', borderRadius:7, color: suggestionsLoading?'#475569':'#f59e0b', fontSize:8, fontWeight:900, cursor: suggestionsLoading?'default':'pointer', letterSpacing:'0.1em' }}>
                            {suggestionsLoading ? '…' : '⟳ Refresh'}
                          </button>
                          <span style={{fontSize:8,color:'#475569',fontWeight:700}}>{draftSuggestions.filter(s=>s.status==='pending').length} pending</span>
                        </div>
                        <div style={{ flex:1,overflowY:'auto',padding:'8px 12px',display:'flex',flexDirection:'column',gap:7 }}>
                          {draftSuggestions.map(s=>(
                            <div key={s.id} className="suggestion-card" style={{
                              borderRadius:11,padding:'10px 12px',
                              background:s.status==='accepted'?'rgba(16,185,129,.06)':s.status==='rejected'?'rgba(239,68,68,.04)':s.severity==='critical'?'rgba(239,68,68,.04)':s.severity==='enhancement'?'rgba(99,102,241,.04)':'rgba(255,255,255,.03)',
                              border:`1px solid ${s.status==='accepted'?'rgba(16,185,129,.2)':s.status==='rejected'?'rgba(239,68,68,.15)':s.severity==='critical'?'rgba(239,68,68,.25)':s.severity==='enhancement'?'rgba(99,102,241,.2)':'rgba(245,158,11,.15)'}`,
                              opacity:s.status==='rejected'?0.4:1
                            }}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                                <span style={{fontSize:7,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.12em',padding:'2px 7px',borderRadius:20,background:s.type==='add'?'rgba(16,185,129,.15)':s.type==='delete'?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)',color:s.type==='add'?'#10b981':s.type==='delete'?'#ef4444':'#f59e0b'}}>
                                  {s.type==='add'?'+ Add':s.type==='delete'?'− Del':'✎ Edit'}
                                </span>
                                {/* Severity badge [F02] */}
                                {s.severity && <span style={{fontSize:7,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.1em',padding:'2px 7px',borderRadius:20,background:s.severity==='critical'?'rgba(239,68,68,.15)':s.severity==='enhancement'?'rgba(99,102,241,.15)':'rgba(245,158,11,.12)',color:s.severity==='critical'?'#f87171':s.severity==='enhancement'?'#818cf8':'#f59e0b'}}>
                                  {s.severity==='critical'?'🔴 Critical':s.severity==='enhancement'?'🟢 Enhance':'🟡 Advisory'}
                                </span>}
                                <span style={{fontSize:8,color:'#334155',fontWeight:700}}>{s.line}</span>
                                {s.status!=='pending'&&<span style={{marginLeft:'auto',fontSize:7,fontWeight:900,textTransform:'uppercase',color:s.status==='accepted'?'#10b981':'#ef4444'}}>{s.status==='accepted'?'✓ Done':'✕ Out'}</span>}
                              </div>
                              <p style={{fontSize:11,color:'#94a3b8',lineHeight:1.5,margin:'0 0 8px'}}>{s.text}</p>
                              {s.status==='pending'&&(
                                <div style={{display:'flex',gap:6}}>
                                  <button onClick={()=>applySuggestion(s.id)} style={{flex:1,padding:'5px 0',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.2)',borderRadius:7,color:'#10b981',fontSize:9,fontWeight:900,cursor:'pointer'}}>✓ Accept</button>
                                  <button onClick={()=>rejectSuggestion(s.id)} style={{flex:1,padding:'5px 0',background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.15)',borderRadius:7,color:'#f87171',fontSize:9,fontWeight:900,cursor:'pointer'}}>✕ Reject</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Chat */}
                    <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
                      <div style={{ padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,.04)',display:'flex',alignItems:'center',background:'#0a0f1d',flexShrink:0,flexWrap:'wrap',gap:6 }}>
                        <div style={{width:26,height:26,borderRadius:7,background:'rgba(99,102,241,.12)',border:'1px solid rgba(99,102,241,.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#818cf8',fontSize:8,fontWeight:900}}>AI</div>
                        <span style={{fontSize:9,fontWeight:900,color:'#94a3b8',letterSpacing:'0.12em',textTransform:'uppercase'}}>Drafting Assistant</span>
                        <div style={{display:'flex',gap:5,marginLeft:'auto',flexWrap:'wrap'}}>
                          {['Add clause','Read draft','Add page','Cite sections'].map(s=>(
                            <button key={s} onClick={()=>{ setDeskInput(s); setTimeout(()=>sendDeskChat(s),50); }} style={{padding:'3px 8px',background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.12)',borderRadius:20,color:'#6366f1',fontSize:8,fontWeight:700,cursor:'pointer'}}>{s}</button>
                          ))}
                        </div>
                      </div>
                      <div ref={deskChatRef} style={{ flex:1,overflowY:'auto',padding:'12px 14px 8px',display:'flex',flexDirection:'column',gap:9 }}>
                        {deskChatHistory.map((msg,idx)=>(
                          <div key={idx} className="fade-up" style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',gap:7,alignItems:'flex-end'}}>
                            {msg.role==='ai'&&<div style={{width:24,height:24,borderRadius:6,background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#818cf8',fontSize:7,fontWeight:900,flexShrink:0}}>AI</div>}
                            <div style={{maxWidth:'85%',padding:'9px 13px',borderRadius:msg.role==='user'?'14px 14px 4px 14px':'4px 14px 14px 14px',background:msg.role==='user'?'rgba(99,102,241,.14)':'rgba(255,255,255,.04)',border:`1px solid ${msg.role==='user'?'rgba(99,102,241,.25)':'rgba(255,255,255,.06)'}`,fontSize:12,lineHeight:1.65,color:msg.role==='user'?'#c7d2fe':'#cbd5e1',whiteSpace:'pre-wrap'}}>{msg.text}</div>
                          </div>
                        ))}
                        {deskLoading&&<div style={{display:'flex',gap:5,padding:'9px 13px',width:'fit-content',background:'rgba(255,255,255,.04)',borderRadius:'4px 14px 14px 14px'}}>
                          {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:'50%',background:'#475569',animationName:'pulse2',animationDuration:'1.2s',animationIterationCount:'infinite',animationDelay:`${i*0.2}s`}}/>)}
                        </div>}
                      </div>

                      {/* Voice transcript preview */}
                      {voiceListening && voiceTranscript && (
                        <div style={{ padding:'6px 14px',background:'rgba(239,68,68,.04)',borderTop:'1px solid rgba(239,68,68,.1)',fontSize:11,color:'#f87171',fontStyle:'italic' }}>
                          🎙 "{voiceTranscript}"
                        </div>
                      )}

                      {/* Input bar */}
                      <div style={{ padding:'10px 14px 80px',borderTop:'1px solid rgba(255,255,255,.05)',display:'flex',gap:7,background:'#070b14',alignItems:'flex-end' }}>
                        <textarea
                          value={deskInput}
                          onChange={e=>setDeskInput(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendDeskChat();} }}
                          placeholder="Ask AI to draft, redraft, add clause, cite law… or say 'read draft' / 'add page'"
                          rows={2}
                          style={{flex:1,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',borderRadius:11,padding:'9px 13px',fontSize:12,lineHeight:1.5,resize:'none'}}
                        />
                        {/* Voice input button */}
                        <button
                          onClick={voiceListening?stopVoiceInput:startVoiceInput}
                          style={{padding:'9px 12px',background:voiceListening?'rgba(239,68,68,.15)':'rgba(255,255,255,.05)',border:`1px solid ${voiceListening?'rgba(239,68,68,.3)':'rgba(255,255,255,.08)'}`,borderRadius:11,color:voiceListening?'#ef4444':'#475569',fontSize:14,cursor:'pointer',flexShrink:0,transition:'all .2s',boxShadow:voiceListening?'0 0 16px rgba(239,68,68,.25)':'none'}}
                          title={voiceListening?'Stop voice input':'Start voice input'}
                        >
                          🎙
                        </button>
                        <textarea
                          value={deskInput}
                          onChange={e=>setDeskInput(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendDeskChat();} }}
                          placeholder="Ask AI to draft, redraft, add clause, cite law… or say 'read draft' / 'add page'"
                          rows={2}
                          style={{flex:1,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',borderRadius:11,padding:'9px 13px',fontSize:12,lineHeight:1.5,resize:'none'}}
                        />
                        {/* [F13] Dictate-to-page button */}
                        <button
                          onPointerDown={startDictate}
                          onPointerUp={stopDictate}
                          onPointerLeave={stopDictate}
                          style={{padding:'9px 12px',background:dictateActive?'rgba(16,185,129,.2)':'rgba(16,185,129,.06)',border:`1px solid ${dictateActive?'rgba(16,185,129,.5)':'rgba(16,185,129,.15)'}`,borderRadius:11,color:dictateActive?'#10b981':'#475569',fontSize:14,cursor:'pointer',flexShrink:0,transition:'all .2s',boxShadow:dictateActive?'0 0 16px rgba(16,185,129,.3)':'none'}}
                          title="Hold to dictate directly to page"
                        >
                          📝
                        </button>
                        {/* Voice input button */}
                        <button
                          onClick={voiceListening?stopVoiceInput:startVoiceInput}
                          style={{padding:'9px 12px',background:voiceListening?'rgba(239,68,68,.15)':'rgba(255,255,255,.05)',border:`1px solid ${voiceListening?'rgba(239,68,68,.3)':'rgba(255,255,255,.08)'}`,borderRadius:11,color:voiceListening?'#ef4444':'#475569',fontSize:14,cursor:'pointer',flexShrink:0,transition:'all .2s',boxShadow:voiceListening?'0 0 16px rgba(239,68,68,.25)':'none'}}
                          title={voiceListening?'Stop voice input':'Start voice input'}
                        >
                          🎙
                        </button>
                        <button onClick={()=>sendDeskChat()} style={{padding:'9px 16px',background:'#6366f1',border:'none',borderRadius:11,color:'#fff',fontSize:10,fontWeight:900,cursor:'pointer',flexShrink:0}}>Send</button>
                      </div>
                      {/* [F05] Clause Standard Checker */}
                      <div style={{ marginTop: 10, padding: '12px 14px', background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.1)', borderRadius: 12 }}>
                        <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>⚖ Clause Standard Checker [F05]</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input value={clauseCheckInput} onChange={e => setClauseCheckInput(e.target.value)}
                            placeholder="Paste a clause to check if it's standard for Kerala courts…"
                            style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 9, padding: '7px 11px', color: '#e2e8f0', fontSize: 11, outline: 'none' }} />
                          <button onClick={async () => {
                            if (!clauseCheckInput.trim() || clauseCheckLoading) return;
                            setClauseCheckLoading(true); setClauseCheckResult('');
                            try {
                              const res = await api.post('/api/ai/clause-check', { clause: clauseCheckInput, docType: 'legal document', courtType: 'Kerala District Court' });
                              setClauseCheckResult(res.data.analysis || '');
                            } catch { setClauseCheckResult('Check failed.'); }
                            setClauseCheckLoading(false);
                          }} disabled={clauseCheckLoading || !clauseCheckInput.trim()}
                            style={{ padding: '7px 14px', background: clauseCheckInput.trim() && !clauseCheckLoading ? 'rgba(245,158,11,.15)' : 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 9, color: clauseCheckInput.trim() ? '#f59e0b' : '#475569', fontSize: 10, fontWeight: 900, cursor: clauseCheckInput.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                            {clauseCheckLoading ? '…' : 'Check'}
                          </button>
                        </div>
                        {clauseCheckResult && (
                          <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.7, padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 8 }}>{clauseCheckResult}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DEADLINES [F11] ── */}
          {view === 'deadlines' && (
            <div style={{ height:'100%', overflowY:'auto', padding:24 }}>
              <div style={{ marginBottom:22 }}>
                <div style={{ fontSize:9, color:'#f59e0b', fontWeight:900, letterSpacing:'0.3em', textTransform:'uppercase', marginBottom:4 }}>CPC / CrPC Deadline Calculator</div>
                <h2 style={{ fontSize:30, fontWeight:900, fontStyle:'italic', letterSpacing:'-0.03em', margin:0 }}>Kerala Court <span style={{ color:'#475569', fontStyle:'normal' }}>Deadlines</span></h2>
              </div>
              <div style={{ ...S.card, marginBottom:18, display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-end' }}>
                <div>
                  <div style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:6 }}>Case Type</div>
                  <select value={deadlineCaseType} onChange={e => setDeadlineCaseType(e.target.value)}
                    style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'9px 14px', color:'#e2e8f0', fontSize:13, minWidth:220 }}>
                    {CASE_TYPES.map(ct => <option key={ct.id} value={ct.id} style={{ background:'#0a0f1d' }}>{ct.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:6 }}>Order / Filing Date</div>
                  <input type="date" value={deadlineBaseDate} onChange={e => setDeadlineBaseDate(e.target.value)}
                    style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'9px 14px', color:'#e2e8f0', fontSize:13 }} />
                </div>
                <button onClick={computeDeadlines} style={{ padding:'10px 22px', background:'#f59e0b', border:'none', borderRadius:11, color:'#000', fontSize:11, fontWeight:900, cursor:'pointer' }}>
                  Calculate →
                </button>
              </div>
              {deadlineResults.length > 0 && (
                <div style={{ ...S.card }}>
                  <div style={{ fontSize:9, color:'#f59e0b', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:16 }}>
                    {CASE_TYPES.find(c=>c.id===deadlineCaseType)?.label} — Deadlines from {deadlineBaseDate}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {deadlineResults.map((d, i) => {
                      const urgent = d.daysFromToday >= 0 && d.daysFromToday <= 3;
                      const near = d.daysFromToday > 3 && d.daysFromToday <= 7;
                      const past = d.daysFromToday < 0;
                      const col = past ? '#475569' : urgent ? '#ef4444' : near ? '#f59e0b' : '#10b981';
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:`rgba(${past?'71,85,105':urgent?'239,68,68':near?'245,158,11':'16,185,129'},.05)`, border:`1px solid rgba(${past?'71,85,105':urgent?'239,68,68':near?'245,158,11':'16,185,129'},.15)`, borderRadius:12 }}>
                          <div style={{ width:44, height:44, borderRadius:12, background:`rgba(${past?'71,85,105':urgent?'239,68,68':near?'245,158,11':'16,185,129'},.1)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ fontSize:11, fontWeight:900, color:col }}>{past ? 'PAST' : d.daysFromToday === 0 ? 'TODAY' : `+${d.daysFromToday}d`}</span>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{d.label}</div>
                            <div style={{ fontSize:10, color:'#475569' }}>{d.rule}</div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:col }}>{d.date}</div>
                            <div style={{ fontSize:9, color:'#334155', marginTop:2 }}>Day {d.days} from filing</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop:16, fontSize:10, color:'#334155', fontStyle:'italic' }}>
                    ⚠ Deadlines are indicative. Always verify with the actual court order and applicable rules.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INSIGHTS [F15/F18-C1] ── */}
          {view === 'insights' && (
            <div style={{ height:'100%', overflowY:'auto', padding:24 }}>
              <div style={{ marginBottom:22 }}>
                <div style={{ fontSize:9, color:'#6366f1', fontWeight:900, letterSpacing:'0.3em', textTransform:'uppercase', marginBottom:4 }}>Practice Analytics</div>
                <h2 style={{ fontSize:30, fontWeight:900, fontStyle:'italic', letterSpacing:'-0.03em', margin:0 }}>Advocate <span style={{ color:'#475569', fontStyle:'normal' }}>Insights</span></h2>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:20 }}>
                {[
                  ['Active Cases', clients.length, '#6366f1'],
                  ['Hearings Next 7 Days', clients.filter(c => { const d = Math.ceil((new Date(c.nextPostingDate)-new Date())/(1000*60*60*24)); return d>=0&&d<=7; }).length, '#f59e0b'],
                  ['Upcoming (14 days)', clients.filter(c => { const d = Math.ceil((new Date(c.nextPostingDate)-new Date())/(1000*60*60*24)); return d>=0&&d<=14; }).length, '#10b981'],
                  ['AI Consultations', chatHistory.filter(m=>m.role==='ai').length, '#8b5cf6'],
                  ['Drafts Created', draftPages.filter(p=>p.trim().length>50).length, '#f59e0b'],
                  ['KB Documents', kbDocs.length, '#6366f1'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ ...S.card, textAlign:'center' }}>
                    <div style={{ fontSize:36, fontWeight:900, color, marginBottom:8 }}>{val}</div>
                    <div style={{ fontSize:11, color:'#475569', fontWeight:700 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...S.card, marginBottom:16 }}>
                <div style={{ fontSize:9, color:'#f59e0b', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:14 }}>Upcoming Hearing Load (14 days)</div>
                {Array.from({length:14}).map((_,i) => {
                  const d = new Date(); d.setDate(d.getDate()+i);
                  const dStr = d.toISOString().slice(0,10);
                  const count = clients.filter(c => c.nextPostingDate === dStr).length;
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <span style={{ fontSize:9, color:'#475569', fontWeight:700, width:70, flexShrink:0 }}>{d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>
                      <div style={{ flex:1, height:16, background:'rgba(255,255,255,.04)', borderRadius:8, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(count*40,100)}%`, background: count>2?'#ef4444':count>0?'#f59e0b':'transparent', borderRadius:8, transition:'width .3s' }} />
                      </div>
                      {count > 0 && <span style={{ fontSize:9, color:'#f59e0b', fontWeight:900, width:20 }}>{count}</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ ...S.card }}>
                <div style={{ fontSize:9, color:'#6366f1', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:14 }}>Cases by Posting Purpose</div>
                {Object.entries(clients.reduce((acc, c) => { acc[c.purposeOfPosting || 'Unknown'] = (acc[c.purposeOfPosting || 'Unknown']||0)+1; return acc; }, {})).map(([purpose, count]) => (
                  <div key={purpose} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:11, color:'#94a3b8', flex:1 }}>{purpose}</span>
                    <div style={{ width:100, height:10, background:'rgba(255,255,255,.04)', borderRadius:5, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(count/clients.length*100,100)}%`, background:'#6366f1', borderRadius:5 }} />
                    </div>
                    <span style={{ fontSize:10, color:'#6366f1', fontWeight:700, width:16 }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CONTRACT REVIEW [F19] ── */}
          {view === 'contract-review' && (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'16px 26px', borderBottom:'1px solid rgba(255,255,255,.05)', background:'#0a0f1d', flexShrink:0 }}>
                <div style={{ fontSize:9, color:'#10b981', fontWeight:900, letterSpacing:'0.3em', textTransform:'uppercase', marginBottom:4 }}>Indian Law Playbook — Apache 2.0 (anthropics/claude-for-legal)</div>
                <h3 style={{ fontSize:24, fontWeight:900, fontStyle:'italic', margin:0 }}>Contract <span style={{ color:'#475569', fontStyle:'normal' }}>Review & Redlining</span></h3>
              </div>
              <div style={{ flex:1, display:'flex', gap:0, overflow:'hidden' }}>
                {/* LEFT: Input */}
                <div style={{ width:420, flexShrink:0, borderRight:'1px solid rgba(255,255,255,.05)', display:'flex', flexDirection:'column', padding:18, gap:12 }}>
                  <div>
                    <div style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:6 }}>Document Type</div>
                    <select value={contractType} onChange={e => setContractType(e.target.value)}
                      style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, padding:'9px 13px', color:'#e2e8f0', fontSize:13 }}>
                      {['contract','sale deed','lease agreement','MOU','NDA','partnership deed','loan agreement','employment agreement','service agreement'].map(t => (
                        <option key={t} value={t} style={{ background:'#0a0f1d' }}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em' }}>Paste Contract Text</div>
                    <textarea value={contractText} onChange={e => setContractText(e.target.value)}
                      placeholder="Paste the contract or agreement text here…"
                      style={{ flex:1, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:'12px 14px', color:'#e2e8f0', fontSize:12, lineHeight:1.7, resize:'none', minHeight:300 }} />
                    <div style={{ fontSize:9, color:'#334155' }}>{contractText.length}/4000 chars</div>
                  </div>
                  <button onClick={runContractReview} disabled={!contractText.trim() || contractLoading}
                    style={{ padding:'12px 0', background: contractText.trim() && !contractLoading ? '#10b981' : 'rgba(16,185,129,.2)', border:'none', borderRadius:12, color: contractText.trim() && !contractLoading ? '#000' : '#475569', fontSize:11, fontWeight:900, cursor: contractText.trim() ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    {contractLoading ? <><div className="spin" style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(0,0,0,.2)', borderTopColor:'#000' }} /> Reviewing…</> : '⚡ Review with Indian Law Playbook'}
                  </button>
                  <div style={{ fontSize:9, color:'#334155', lineHeight:1.6 }}>
                    Reviews against: Indian Contract Act 1872, Specific Relief Act 1963, Transfer of Property Act 1882, Kerala Stamp Act, Registration Act 1908
                  </div>
                </div>
                {/* RIGHT: Results */}
                <div style={{ flex:1, overflowY:'auto', padding:18 }}>
                  {!contractReview && !contractLoading && (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, opacity:.4 }}>
                      <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={44} strokeWidth={1} />
                      <p style={{ fontSize:13, color:'#475569', textAlign:'center' }}>Paste a contract on the left and click Review.<br/>AI will flag clauses using Indian law standards.</p>
                    </div>
                  )}
                  {contractLoading && (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12 }}>
                      <div className="spin" style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(16,185,129,.2)', borderTopColor:'#10b981' }} />
                      <p style={{ fontSize:12, color:'#10b981', fontWeight:700 }}>Reviewing against Indian Law Playbook…</p>
                    </div>
                  )}
                  {contractReview && (
                    <div className="fade-up">
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                        <div style={{ padding:'6px 16px', borderRadius:20, background: contractReview.overall==='HIGH'?'rgba(239,68,68,.15)':contractReview.overall==='LOW'?'rgba(16,185,129,.15)':'rgba(245,158,11,.15)', border:`1px solid ${contractReview.overall==='HIGH'?'rgba(239,68,68,.3)':contractReview.overall==='LOW'?'rgba(16,185,129,.3)':'rgba(245,158,11,.3)'}`, color: contractReview.overall==='HIGH'?'#f87171':contractReview.overall==='LOW'?'#10b981':'#f59e0b', fontSize:11, fontWeight:900 }}>
                          Overall Risk: {contractReview.overall}
                        </div>
                        <button onClick={() => navigator.clipboard?.writeText(contractReview.fullText)}
                          style={{ padding:'6px 14px', background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.15)', borderRadius:10, color:'#818cf8', fontSize:10, fontWeight:900, cursor:'pointer' }}>
                          ⎘ Copy Review
                        </button>
                      </div>
                      <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:16, padding:18, fontSize:12, color:'#94a3b8', lineHeight:1.8, whiteSpace:'pre-wrap' }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(contractReview.fullText) }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ── Nexus Voice AI Dock ── */}
        <div style={{ position: 'absolute', bottom: 'max(20px, calc(20px + env(safe-area-inset-bottom, 0px)))', left: '50%', transform: 'translateX(-50%)', zIndex: 100, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>

          {/* Voice status bubble — shown when active */}
          {voiceAiOn && (
            <div className="fade-up" style={{ background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(20px)', border: `1px solid ${voiceAiListening ? 'rgba(239,68,68,.4)' : voiceAiThinking ? 'rgba(245,158,11,.4)' : voiceAiSpeaking ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.1)'}`, borderRadius: 20, padding: '10px 18px', maxWidth: 420, minWidth: 260, pointerEvents: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,.7)', transition: 'border-color .3s' }}>

              {/* Status row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: voiceAiTranscript || voiceAiReply ? 8 : 0 }}>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  {voiceAiListening
                    ? [0,1,2,3].map(i => <div key={i} style={{ width: 3, background: '#ef4444', borderRadius: 2, animationName: 'waveBar', animationDuration: '.5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDirection: 'alternate', animationDelay: `${i*0.1}s`, height: `${10 + Math.random()*12}px` }} />)
                    : voiceAiThinking
                      ? [0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animationName: 'pulse2', animationDuration: '1.2s', animationIterationCount: 'infinite', animationDelay: `${i*0.2}s` }} />)
                      : voiceAiSpeaking
                        ? [0,1,2,3,4].map(i => <div key={i} style={{ width: 3, background: '#818cf8', borderRadius: 2, animationName: 'waveBar', animationDuration: '.4s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDirection: 'alternate', animationDelay: `${i*0.08}s`, height: `${8 + Math.random()*16}px` }} />)
                        : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                  }
                </div>
                <span style={{ fontSize: 10, fontWeight: 900, color: voiceAiListening ? '#ef4444' : voiceAiThinking ? '#f59e0b' : voiceAiSpeaking ? '#818cf8' : '#10b981', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  {voiceAiListening ? 'Listening…' : voiceAiThinking ? 'Thinking…' : voiceAiSpeaking ? 'Speaking…' : 'Ready — say a command'}
                </span>
                {!voiceAiListening && !voiceAiThinking && !voiceAiSpeaking && (
                  <button onClick={startDockListening} style={{ marginLeft: 'auto', padding: '3px 10px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 20, color: '#f87171', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
                    🎙 Tap to speak
                  </button>
                )}
              </div>

              {/* Transcript */}
              {voiceAiTranscript && (
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontStyle: 'italic' }}>
                  You: "{voiceAiTranscript}"
                </div>
              )}

              {/* AI reply */}
              {voiceAiReply && (
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 8 }}>
                  {(() => { const c = voiceAiReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(); return c.length > 160 ? c.slice(0, 157) + '…' : c; })()}
                </div>
              )}

              {/* Command hints */}
              {!voiceAiTranscript && !voiceAiListening && !voiceAiThinking && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                  {['"Go to Consult"', '"Open Clients"', '"Start camera"', '"What is IPC 302?"', '"Add instruction…"'].map(hint => (
                    <span key={hint} style={{ fontSize: 9, color: '#334155', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{hint}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main dock pill */}
          <div style={{ background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(20px)', padding: '10px 18px', borderRadius: 38, border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.8)' }}>

            {/* Camera button — opens Reading Room + starts scan */}
            <button onClick={() => {
                // Stop any active streams first (Android: only one camera consumer at a time)
                stopCamera(convStreamRef, convVideoRef.current);
                stopCamera(streamRef, videoRef.current);
                setConvPhase(p => (p === 'done' ? 'done' : 'idle'));
                if (camOn) {
                  // Toggle off
                  stopScan();
                  setCamOn(false);
                } else {
                  // Toggle on — navigate to Reading Room and start camera
                  // startScan() is called directly from this onClick = user gesture = safe on Android
                  setView('reading-room');
                  setCamOn(true);
                  startScan();
                }
              }}
              title="Open Consult (camera)"
              style={{ width: 48, height: 48, borderRadius: '50%', background: camOn ? '#6366f1' : 'rgba(255,255,255,.05)', border: `2px solid ${camOn ? '#818cf8' : 'rgba(255,255,255,.1)'}`, color: camOn ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .3s', boxShadow: camOn ? '0 0 20px rgba(99,102,241,.5)' : 'none', transform: camOn ? 'scale(1.1)' : 'scale(1)' }}>
              <Icon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" size={18} />
            </button>

            {/* Mic / Voice AI button — opens Consult */}
            <button onClick={() => { toggleVoiceAi(); setView('consult'); }}
              title={voiceAiOn ? 'Turn off Voice AI' : 'Activate Nexus Voice AI — opens Consult'}
              style={{ width: 48, height: 48, borderRadius: '50%', background: voiceAiOn ? (voiceAiListening ? '#ef4444' : '#6366f1') : 'rgba(239,68,68,.1)', border: `2px solid ${voiceAiOn ? (voiceAiListening ? '#f87171' : '#818cf8') : 'rgba(239,68,68,.2)'}`, color: voiceAiOn ? '#fff' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .3s', boxShadow: voiceAiOn ? `0 0 20px ${voiceAiListening ? 'rgba(239,68,68,.6)' : 'rgba(99,102,241,.5)'}` : 'none', transform: voiceAiOn ? 'scale(1.1)' : 'scale(1)' }}>
              <Icon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" size={18} />
            </button>

            <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,.1)' }} />

            <div style={{ padding: '0 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                ✦ Gemini 2.5 Flash
              </div>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#6366f1', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Nexus Link</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: voiceAiOn ? '#10b981' : '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2, transition: 'color .3s' }}>
                {voiceAiOn ? (voiceAiListening ? '● LISTENING' : voiceAiThinking ? '● THINKING' : voiceAiSpeaking ? '● SPEAKING' : '● READY') : 'OFFLINE'}
              </div>
            </div>
          </div>
        </div>

      {/* ── [F10-C4] Review Checkpoint Modal ── */}
      {reviewCheckpoint && (
        <div style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(2,6,23,.9)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="fade-up" style={{ width:'100%', maxWidth:700, background:'#0a0f1d', borderRadius:24, border:'1px solid rgba(99,102,241,.3)', overflow:'hidden', boxShadow:'0 40px 100px rgba(0,0,0,.8)' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b' }} />
              <span style={{ fontSize:10, fontWeight:900, color:'#f59e0b', letterSpacing:'0.2em', textTransform:'uppercase' }}>Review Before Saving — {reviewCheckpoint.label}</span>
            </div>
            <div style={{ display:'flex', gap:0 }}>
              <div style={{ flex:1, padding:18, borderRight:'1px solid rgba(255,255,255,.05)' }}>
                <div style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:8 }}>Source Data</div>
                <pre style={{ fontSize:11, color:'#64748b', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0, maxHeight:200, overflowY:'auto' }}>{reviewCheckpoint.source}</pre>
              </div>
              <div style={{ flex:1, padding:18 }}>
                <div style={{ fontSize:9, color:'#10b981', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:8 }}>AI Output — Edit if needed</div>
                <textarea defaultValue={reviewCheckpoint.extracted} id="review-checkpoint-edit"
                  style={{ width:'100%', minHeight:180, background:'rgba(255,255,255,.04)', border:'1px solid rgba(16,185,129,.2)', borderRadius:10, padding:'10px 12px', color:'#e2e8f0', fontSize:12, lineHeight:1.7, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }} />
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid rgba(255,255,255,.06)', display:'flex', gap:10 }}>
              <button onClick={() => reviewCheckpoint.onConfirm()}
                style={{ flex:1, padding:'11px 0', background:'#10b981', border:'none', borderRadius:12, color:'#000', fontSize:11, fontWeight:900, cursor:'pointer' }}>
                ✓ Confirm & Save
              </button>
              <button onClick={() => { const val = document.getElementById('review-checkpoint-edit')?.value; reviewCheckpoint.onEdit(val || reviewCheckpoint.extracted); }}
                style={{ flex:1, padding:'11px 0', background:'rgba(99,102,241,.12)', border:'1px solid rgba(99,102,241,.25)', borderRadius:12, color:'#818cf8', fontSize:11, fontWeight:900, cursor:'pointer' }}>
                ✎ Save Edited Version
              </button>
              <button onClick={() => setReviewCheckpoint(null)}
                style={{ padding:'11px 18px', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.15)', borderRadius:12, color:'#f87171', fontSize:11, fontWeight:900, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── [F07/F10-C6] Client Message Modal ── */}
      {msgDraftModal && (
        <div style={{ position:'fixed', inset:0, zIndex:998, background:'rgba(2,6,23,.9)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="fade-up" style={{ width:'100%', maxWidth:520, background:'#0a0f1d', borderRadius:24, border:'1px solid rgba(99,102,241,.2)', boxShadow:'0 40px 100px rgba(0,0,0,.8)' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize:9, color:'#6366f1', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:2 }}>Draft Client Message [F07]</div>
              <div style={{ fontSize:16, fontWeight:900 }}>{msgDraftModal.name} — {msgDraftModal.caseNumber}</div>
            </div>
            <div style={{ padding:18 }}>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                {[['whatsapp','WhatsApp 📱'],['letter','Formal Letter 📄'],['sms','SMS 💬']].map(([ch,label]) => (
                  <button key={ch} onClick={() => { setMsgChannel(ch); setMsgResult(''); }}
                    style={{ flex:1, padding:'7px 0', background: msgChannel===ch?'rgba(99,102,241,.15)':'rgba(255,255,255,.04)', border:`1px solid ${msgChannel===ch?'rgba(99,102,241,.4)':'rgba(255,255,255,.08)'}`, borderRadius:10, color: msgChannel===ch?'#818cf8':'#475569', fontSize:10, fontWeight:900, cursor:'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                {[['ml','Malayalam'],['en','English'],['hi','Hindi']].map(([l,label]) => (
                  <button key={l} onClick={() => { setMsgLang(l); setMsgResult(''); }}
                    style={{ flex:1, padding:'6px 0', background: msgLang===l?'rgba(16,185,129,.12)':'rgba(255,255,255,.04)', border:`1px solid ${msgLang===l?'rgba(16,185,129,.3)':'rgba(255,255,255,.08)'}`, borderRadius:9, color: msgLang===l?'#10b981':'#475569', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => generateClientMessage(msgDraftModal, msgChannel, msgLang)} disabled={msgLoading}
                style={{ width:'100%', padding:'10px 0', background: msgLoading?'rgba(99,102,241,.2)':'#6366f1', border:'none', borderRadius:11, color:'#fff', fontSize:11, fontWeight:900, cursor: msgLoading?'default':'pointer', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {msgLoading ? <><div className="spin" style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff' }} /> Generating…</> : '⚡ Generate Message'}
              </button>
              {msgResult && (
                <div style={{ background:'rgba(16,185,129,.05)', border:'1px solid rgba(16,185,129,.2)', borderRadius:12, padding:14, marginBottom:10 }}>
                  <div style={{ fontSize:12, color:'#e2e8f0', lineHeight:1.8, whiteSpace:'pre-wrap', marginBottom:10 }}>{msgResult}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => navigator.clipboard?.writeText(msgResult)}
                      style={{ flex:1, padding:'7px 0', background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.2)', borderRadius:9, color:'#818cf8', fontSize:10, fontWeight:900, cursor:'pointer' }}>⎘ Copy</button>
                    <button onClick={() => liveVoice.speak(msgResult)}
                      style={{ flex:1, padding:'7px 0', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:9, color:'#10b981', fontSize:10, fontWeight:900, cursor:'pointer' }}>▶ Read Aloud</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding:'0 18px 18px' }}>
              <button onClick={() => { setMsgDraftModal(null); setMsgResult(''); }}
                style={{ width:'100%', padding:'10px 0', background:'transparent', border:'1px solid rgba(255,255,255,.08)', borderRadius:11, color:'#475569', fontSize:11, fontWeight:700, cursor:'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── [F16] Fee Note Modal ── */}
      {feeNoteModal && (
        <div style={{ position:'fixed', inset:0, zIndex:997, background:'rgba(2,6,23,.9)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="fade-up" style={{ width:'100%', maxWidth:500, background:'#0a0f1d', borderRadius:24, border:'1px solid rgba(245,158,11,.2)', boxShadow:'0 40px 100px rgba(0,0,0,.8)' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize:9, color:'#f59e0b', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:2 }}>Fee Note Generator [F16]</div>
              <div style={{ fontSize:16, fontWeight:900 }}>{feeNoteModal.name} — {feeNoteModal.caseNumber}</div>
            </div>
            <div style={{ padding:18 }}>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', display:'block', marginBottom:5 }}>Work Done</label>
                <input value={feeNoteWork} onChange={e => setFeeNoteWork(e.target.value)}
                  placeholder={feeNoteModal.purposeOfPosting || 'Attended hearing, filed written arguments…'}
                  style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, padding:'9px 13px', color:'#e2e8f0', fontSize:12, boxSizing:'border-box' }} />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', display:'block', marginBottom:5 }}>Amount (₹)</label>
                <input type="number" value={feeNoteAmount} onChange={e => setFeeNoteAmount(e.target.value)}
                  placeholder="5000"
                  style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, padding:'9px 13px', color:'#e2e8f0', fontSize:12, boxSizing:'border-box' }} />
              </div>
              <button onClick={() => generateFeeNote(feeNoteModal)} disabled={!feeNoteAmount || feeNoteLoading}
                style={{ width:'100%', padding:'10px 0', background: feeNoteAmount&&!feeNoteLoading?'#f59e0b':'rgba(245,158,11,.2)', border:'none', borderRadius:11, color: feeNoteAmount&&!feeNoteLoading?'#000':'#475569', fontSize:11, fontWeight:900, cursor: feeNoteAmount?'pointer':'default', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {feeNoteLoading ? <><div className="spin" style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(0,0,0,.2)', borderTopColor:'#000' }} /> Generating…</> : '⚡ Generate Fee Note'}
              </button>
              {feeNoteHtml && (
                <div style={{ marginBottom:10 }}>
                  <div dangerouslySetInnerHTML={{ __html: feeNoteHtml }} style={{ background:'#fff', borderRadius:10, padding:0, overflow:'hidden', fontSize:12 }} />
                  <button onClick={() => {
                    const w = window.open('', '_blank');
                    w.document.write('<html><body>' + feeNoteHtml + '</body></html>');
                    w.print();
                  }} style={{ width:'100%', marginTop:8, padding:'8px 0', background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.2)', borderRadius:9, color:'#818cf8', fontSize:10, fontWeight:900, cursor:'pointer' }}>
                    🖨 Print / Save as PDF
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding:'0 18px 18px' }}>
              <button onClick={() => { setFeeNoteModal(null); setFeeNoteHtml(''); setFeeNoteAmount(''); setFeeNoteWork(''); }}
                style={{ width:'100%', padding:'10px 0', background:'transparent', border:'1px solid rgba(255,255,255,.08)', borderRadius:11, color:'#475569', fontSize:11, fontWeight:700, cursor:'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── [F22] Case Brief Modal ── */}
      {caseBriefModal && (
        <div style={{ position:'fixed', inset:0, zIndex:996, background:'rgba(2,6,23,.9)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="fade-up" style={{ width:'100%', maxWidth:600, maxHeight:'85vh', background:'#0a0f1d', borderRadius:24, border:'1px solid rgba(139,92,246,.2)', boxShadow:'0 40px 100px rgba(0,0,0,.8)', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
              <div style={{ fontSize:9, color:'#8b5cf6', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:2 }}>AI Case Brief [F22]</div>
              <div style={{ fontSize:16, fontWeight:900 }}>{caseBriefModal.name} — {caseBriefModal.caseNumber}</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:18 }}>
              {!caseBriefResult && !caseBriefLoading && (
                <button onClick={() => generateCaseBrief(caseBriefModal)}
                  style={{ width:'100%', padding:'12px 0', background:'#8b5cf6', border:'none', borderRadius:12, color:'#fff', fontSize:11, fontWeight:900, cursor:'pointer' }}>
                  ⚡ Generate Case Brief
                </button>
              )}
              {caseBriefLoading && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, gap:10 }}>
                  <div className="spin" style={{ width:24, height:24, borderRadius:'50%', border:'3px solid rgba(139,92,246,.2)', borderTopColor:'#8b5cf6' }} />
                  <span style={{ color:'#8b5cf6', fontSize:12, fontWeight:700 }}>Generating brief…</span>
                </div>
              )}
              {caseBriefResult && (
                <div>
                  <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:14, padding:16, fontSize:12, color:'#94a3b8', lineHeight:1.8, whiteSpace:'pre-wrap', marginBottom:12 }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(caseBriefResult) }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => navigator.clipboard?.writeText(caseBriefResult)}
                      style={{ flex:1, padding:'8px 0', background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.2)', borderRadius:9, color:'#818cf8', fontSize:10, fontWeight:900, cursor:'pointer' }}>⎘ Copy</button>
                    <button onClick={() => { setCaseBriefResult(''); }}
                      style={{ flex:1, padding:'8px 0', background:'rgba(139,92,246,.1)', border:'1px solid rgba(139,92,246,.2)', borderRadius:9, color:'#a78bfa', fontSize:10, fontWeight:900, cursor:'pointer' }}>↺ Regenerate</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding:'0 18px 18px', flexShrink:0 }}>
              <button onClick={() => { setCaseBriefModal(null); setCaseBriefResult(''); }}
                style={{ width:'100%', padding:'10px 0', background:'transparent', border:'1px solid rgba(255,255,255,.08)', borderRadius:11, color:'#475569', fontSize:11, fontWeight:700, cursor:'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── [F03/F10-C5] Intake Questionnaire Modal ── */}
      {intakeModal && (
        <div style={{ position:'fixed', inset:0, zIndex:995, background:'rgba(2,6,23,.9)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="fade-up" style={{ width:'100%', maxWidth:520, background:'#0a0f1d', borderRadius:24, border:'1px solid rgba(99,102,241,.2)', boxShadow:'0 40px 100px rgba(0,0,0,.8)' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize:9, color:'#6366f1', fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:2 }}>Intake → Draft [F03]</div>
              <div style={{ fontSize:16, fontWeight:900 }}>New Case Questionnaire</div>
            </div>
            <div style={{ padding:18 }}>
              {intakeStep === 1 && (
                <>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', display:'block', marginBottom:5 }}>Case Type</label>
                    <select value={intakeCaseType} onChange={e => { setIntakeCaseType(e.target.value); setIntakeFields({}); }}
                      style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, padding:'9px 13px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }}>
                      {Object.keys(INTAKE_FIELDS).map(t => <option key={t} value={t} style={{ background:'#0a0f1d' }}>{t}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setIntakeStep(2)}
                    style={{ width:'100%', padding:'10px 0', background:'#6366f1', border:'none', borderRadius:11, color:'#fff', fontSize:11, fontWeight:900, cursor:'pointer' }}>
                    Continue →
                  </button>
                </>
              )}
              {intakeStep === 2 && (
                <>
                  <div style={{ fontSize:9, color:'#6366f1', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12 }}>{intakeCaseType} Details</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14, maxHeight:320, overflowY:'auto' }}>
                    {(INTAKE_FIELDS[intakeCaseType] || []).map(field => (
                      <div key={field.key}>
                        <label style={{ fontSize:9, color:'#475569', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.12em', display:'block', marginBottom:4 }}>{field.label}</label>
                        <input value={intakeFields[field.key] || ''} onChange={e => setIntakeFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.label}
                          style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:9, padding:'8px 12px', color:'#e2e8f0', fontSize:12, boxSizing:'border-box' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setIntakeStep(1)} style={{ flex:1, padding:'10px 0', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:11, color:'#94a3b8', fontSize:11, fontWeight:700, cursor:'pointer' }}>← Back</button>
                    <button onClick={submitIntake} disabled={intakeDraftLoading}
                      style={{ flex:2, padding:'10px 0', background: intakeDraftLoading?'rgba(99,102,241,.3)':'#6366f1', border:'none', borderRadius:11, color:'#fff', fontSize:11, fontWeight:900, cursor: intakeDraftLoading?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      {intakeDraftLoading ? <><div className="spin" style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff' }} /> Drafting…</> : '⚡ Generate Draft →'}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding:'0 18px 18px' }}>
              <button onClick={() => { setIntakeModal(false); setIntakeStep(1); setIntakeFields({}); }}
                style={{ width:'100%', padding:'10px 0', background:'transparent', border:'1px solid rgba(255,255,255,.08)', borderRadius:11, color:'#475569', fontSize:11, fontWeight:700, cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}
