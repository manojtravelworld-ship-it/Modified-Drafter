// ─── useLiveVoice.js ──────────────────────────────────────────────────────────
// Nexus Justice v6 — Mobile-hardened Web Speech + Gemini AI
//
// ANDROID/iOS FIXES:
//   1. Gesture-only start() — never call from setTimeout or useEffect
//   2. voiceschanged async race — await event before TTS
//   3. Zombie recognition — null handlers before abort()
//   4. continuous=false — required on Android Chrome
//   5. Mic closed BEFORE TTS — Android can't run both simultaneously
//   6. onend loop guard — statusRef mirrors state inside callbacks
//   7. iOS Safari: SpeechRecognition behind webkit prefix, needs explicit lang
//   8. HTTPS guard — getUserMedia silently fails on HTTP on mobile
//   9. Kick interval — Android pauses speechSynthesis in background
//  10. Gemini model text updated to match actual stack
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../../api.js';

// ─── Cloud AI ─────────────────────────────────────────────────────────────────
async function cloudChat(message, history = [], context = '') {
  try {
    const res = await api.post('/api/ai/consult', {
      message: context ? `Context: ${context.slice(0, 400)}\n\nQuery: ${message}` : message,
      history: history.slice(-6),
    });
    return { text: res.data.reply || '', source: 'gemini-2.5-flash' };
  } catch (e) {
    if (e.response?.status === 402) return { text: '🔒 Subscription required.', source: 'blocked', expired: true };
    return { text: 'AI unavailable. Please check your connection.', source: 'error' };
  }
}

async function cloudDraft(instruction, caseFacts = '', context = '') {
  try {
    const res = await api.post('/api/ai/voice-draft', { instruction, caseFacts, context: context.slice(0, 800) });
    return { text: res.data.reply || '', source: 'gemini-2.5-flash' };
  } catch {
    return { text: 'Drafting unavailable.', source: 'error' };
  }
}

async function cloudSearch(query) {
  try {
    const res = await api.post('/api/ai/search', { query });
    return { text: res.data.summary || '', source: 'gemini-2.5-flash' };
  } catch {
    return { text: '', source: 'error' };
  }
}

// ─── Intent classifier ────────────────────────────────────────────────────────
function classifyIntent(text) {
  if (/draft|write|prepare|format|document|petition|notice|agreement|contract|vakalatnama/i.test(text)) return 'DRAFT';
  if (/latest|recent|current|news|judgment|2024|2025|2026|today|now|case law|amendment/i.test(text)) return 'SEARCH';
  return 'CHAT';
}

// ─── Language detection ───────────────────────────────────────────────────────
export function detectLang(text) {
  if (!text) return 'en-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  return 'en-IN';
}

// ─── HTTPS check ─────────────────────────────────────────────────────────────
export function isSecureContext() {
  return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
}

// ─── Android-safe TTS ─────────────────────────────────────────────────────────
function getVoicesAsync() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis?.getVoices() || [];
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis?.addEventListener('voiceschanged', handler);
    // Safety: some Android WebViews never fire voiceschanged
    setTimeout(() => {
      window.speechSynthesis?.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis?.getVoices() || []);
    }, 2500);
  });
}

function pickVoice(voices, lang) {
  return (
    voices.find(v => v.lang === lang) ||
    voices.find(v => v.lang.startsWith(lang.split('-')[0])) ||
    voices.find(v => v.lang.includes('IN')) ||
    voices[0] || null
  );
}

async function speakAsync(text, lang) {
  // FIX 5: caller must close mic BEFORE calling this
  return new Promise(async (resolve) => {
    if (!window.speechSynthesis || !text?.trim()) { resolve(); return; }
    window.speechSynthesis.cancel();
    // Brief pause after cancel — required on Android
    await new Promise(r => setTimeout(r, 180));
    if (!window.speechSynthesis) { resolve(); return; }

    const voices = await getVoicesAsync();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 900));
    utt.lang = lang || 'en-IN';
    utt.rate = 0.95;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    const voice = pickVoice(voices, utt.lang);
    if (voice) utt.voice = voice;

    const wordCount = text.split(/\s+/).length;
    const safetyMs = Math.max(6000, wordCount * 450) + 3000;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(safetyTimer);
      clearInterval(kickInterval);
      resolve();
    };

    const safetyTimer = setTimeout(finish, safetyMs);
    // FIX 9: kick interval prevents Android from silently pausing synthesis
    const kickInterval = setInterval(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 8000);

    utt.onend = finish;
    utt.onerror = finish; // 'interrupted' on Android is normal — treat as done
    window.speechSynthesis.speak(utt);
  });
}

async function speakInstant(text, lang, onStart, onDone, shouldContinue) {
  if (!text?.trim()) { onDone?.(); return; }
  const sentences = text
    .replace(/([.!?।॥\n])\s*/g, '$1|||')
    .split('|||')
    .map(s => s.trim())
    .filter(s => s.length > 2);
  if (!sentences.length) { onDone?.(); return; }
  let first = true;
  for (const sentence of sentences) {
    if (shouldContinue && !shouldContinue()) break;
    if (first) { onStart?.(); first = false; }
    await speakAsync(sentence, lang);
    if (shouldContinue && !shouldContinue()) break;
    await new Promise(r => setTimeout(r, 100));
  }
  onDone?.();
}

// ─── Mobile-safe camera helper ────────────────────────────────────────────────
// Tries environment (back) camera first, falls back to any camera
// Handles iOS OverconstrainedError and Android permission quirks
export async function startCamera(videoEl) {
  if (!isSecureContext()) {
    throw new Error('Camera requires HTTPS. Please use a secure connection.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera not supported on this browser. Use Chrome on Android or Safari on iOS.');
  }

  const constraints = [
    // Best: back camera, HD
    { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    // Fallback: back camera, any resolution
    { video: { facingMode: 'environment' }, audio: false },
    // Fallback: any camera
    { video: true, audio: false },
  ];

  let stream = null;
  let lastError = null;

  for (const constraint of constraints) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraint);
      break;
    } catch (e) {
      lastError = e;
      // OverconstrainedError — try next constraint
      if (e.name === 'OverconstrainedError' || e.name === 'ConstraintNotSatisfiedError') continue;
      // NotAllowedError — no point retrying
      if (e.name === 'NotAllowedError') throw new Error('Camera access denied. Allow camera permission in browser settings.');
      // NotFoundError — no camera
      if (e.name === 'NotFoundError') throw new Error('No camera found on this device.');
    }
  }

  if (!stream) {
    throw new Error(lastError?.message || 'Camera unavailable.');
  }

  if (videoEl) {
    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', ''); // iOS Safari requires this attribute
    videoEl.setAttribute('muted', '');
    // FIX: play() rejects with AbortError on Android when page is backgrounded
    try {
      await videoEl.play();
    } catch (e) {
      if (e.name !== 'AbortError') throw e;
      // AbortError = page was backgrounded mid-play — stream is still valid
    }
  }

  return stream;
}

export function stopCamera(streamRef, videoEl) {
  if (streamRef?.current) {
    streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
    try { videoEl.load(); } catch {}
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useLiveVoice({
  onTranscript, onThinking, onReply, onSpeaking, onListening, onError, onDraftReady,
  history = [], context = '', autoRestart = true,
} = {}) {

  const [status, setStatus] = useState('idle');
  const modelText = 'Gemini 2.5 Flash · Voice AI';

  const activeRef      = useRef(false);
  const busyRef        = useRef(false);
  const recognitionRef = useRef(null);
  const langRef        = useRef('en-IN');
  const autoRestartRef = useRef(autoRestart);
  const statusRef      = useRef('idle');
  autoRestartRef.current = autoRestart;

  const setStatusBoth = useCallback((s) => { setStatus(s); statusRef.current = s; }, []);

  // FIX 3: null handlers FIRST, then abort
  const destroyRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    rec.onstart = null;
    rec.onresult = null;
    rec.onnomatch = null;
    rec.onerror = null;
    rec.onend = null;
    try { rec.abort(); } catch {}
  }, []);

  const processQuery = useCallback(async (transcript) => {
    onTranscript?.(transcript);
    langRef.current = detectLang(transcript);
    onThinking?.();
    setStatusBoth('thinking');
    busyRef.current = true;

    let replyText = '';
    let source = 'gemini';

    try {
      if (!navigator.onLine) {
        replyText = '📵 You are offline. Please reconnect to use the AI assistant.';
        source = 'offline';
      } else {
        const intent = classifyIntent(transcript);
        if (intent === 'DRAFT') {
          const r = await cloudDraft(transcript, '', context);
          replyText = r.text; source = r.source;
          if (replyText && !r.expired) onDraftReady?.(replyText);
        } else if (intent === 'SEARCH') {
          const r = await cloudSearch(transcript);
          replyText = r.text || (await cloudChat(transcript, history, context)).text;
          source = r.source;
        } else {
          const r = await cloudChat(transcript, history, context);
          replyText = r.text; source = r.source;
        }
      }
    } catch (e) {
      replyText = 'An error occurred. Please try again.';
      onError?.(e.message);
    }

    setStatusBoth('speaking');
    onReply?.(replyText, source);
    onSpeaking?.(true);

    await speakInstant(
      replyText, langRef.current, undefined,
      () => {
        onSpeaking?.(false);
        busyRef.current = false;
        setStatusBoth('idle');
        if (activeRef.current && autoRestartRef.current) {
          setTimeout(() => startListening(), 500);
        }
      },
      () => activeRef.current
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, context, onTranscript, onThinking, onReply, onSpeaking, onError, onDraftReady]);

  const startListening = useCallback(() => {
    if (!activeRef.current || busyRef.current) return;

    // FIX 8: HTTPS required for mic on mobile
    if (!isSecureContext()) {
      onError?.('Microphone requires HTTPS. Please use a secure connection.');
      return;
    }

    // FIX 7: iOS Safari uses webkit prefix
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onError?.('Speech recognition not supported. Use Chrome on Android or Safari 14.5+ on iOS.');
      return;
    }

    destroyRecognition();

    const rec = new SR();
    rec.continuous = false;     // FIX 4: must be false on Android
    rec.interimResults = false; // causes double-fire on Android
    rec.maxAlternatives = 1;
    rec.lang = langRef.current || 'en-IN';

    rec.onstart = () => { setStatusBoth('listening'); onListening?.(true); };

    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript?.trim();
      if (transcript && transcript.length > 1) {
        destroyRecognition(); // FIX 5: close mic before TTS
        onListening?.(false);
        processQuery(transcript);
      }
    };

    rec.onnomatch = () => {
      if (!recognitionRef.current) return;
      onListening?.(false);
      setStatusBoth('idle');
      if (activeRef.current && !busyRef.current) setTimeout(() => startListening(), 700);
    };

    rec.onerror = (e) => {
      if (!recognitionRef.current) return; // already destroyed
      onListening?.(false);
      setStatusBoth('idle');
      if (e.error === 'no-speech') {
        if (activeRef.current && !busyRef.current) setTimeout(() => startListening(), 900);
      } else if (e.error === 'audio-capture') {
        if (activeRef.current && !busyRef.current) setTimeout(() => startListening(), 1800);
      } else if (e.error === 'not-allowed') {
        activeRef.current = false;
        onError?.('Microphone access denied. Tap the lock icon in your browser address bar and allow microphone access.');
      } else if (e.error === 'network') {
        onError?.('Network error. Check your connection.');
        if (activeRef.current && !busyRef.current) setTimeout(() => startListening(), 2500);
      } else {
        if (activeRef.current && !busyRef.current) setTimeout(() => startListening(), 1200);
      }
    };

    rec.onend = () => {
      if (!recognitionRef.current) return; // FIX 6: destroyed — don't loop
      onListening?.(false);
      if (activeRef.current && !busyRef.current &&
          statusRef.current !== 'thinking' && statusRef.current !== 'speaking') {
        setTimeout(() => startListening(), 500);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      destroyRecognition();
      if (activeRef.current) setTimeout(() => startListening(), 600);
    }
  }, [processQuery, onListening, onError, destroyRecognition, setStatusBoth]);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    busyRef.current = false;
    destroyRecognition();
    window.speechSynthesis?.cancel();
    setStatusBoth('idle');
    onListening?.(false);
    onSpeaking?.(false);
  }, [onListening, onSpeaking, destroyRecognition, setStatusBoth]);

  // FIX 1: start() MUST be called directly from a user gesture (onClick).
  // NEVER wrap in setTimeout or useEffect — Android will throw NotAllowedError.
  const start = useCallback(() => {
    // FIX 8: check HTTPS
    if (!isSecureContext()) {
      onError?.('Microphone requires HTTPS.');
      return;
    }
    activeRef.current = true;
    busyRef.current = false;
    startListening();
  }, [startListening, onError]);

  const stop = useCallback(() => stopAll(), [stopAll]);

  const speak = useCallback((text, onDone) => {
    speakInstant(text, detectLang(text), undefined, onDone, () => true);
  }, []);

  const speakReply = useCallback(async (text) => {
    if (!text?.trim()) return;
    onSpeaking?.(true);
    await speakInstant(text, detectLang(text), undefined, () => onSpeaking?.(false), () => true);
  }, [onSpeaking]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    onSpeaking?.(false);
  }, [onSpeaking]);

  const enableLocalModel = useCallback(() => {}, []); // stub — no local model

  useEffect(() => () => stopAll(), []); // cleanup on unmount

  return {
    status,
    modelStatus: 'ready',
    modelProgress: 100,
    modelText,
    start,
    stop,
    speak,
    speakReply,
    stopSpeaking,
    enableLocalModel,
    isReady: true,
  };
}

export default useLiveVoice;
