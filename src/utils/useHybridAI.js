// ─── useHybridAI.js ──────────────────────────────────────────────────────────
// Nexus Justice — Gemini 2.5 Flash Edition
//
// All AI is served via backend API using Gemini 2.5 Flash only.
// No local models, no Gemma, no Sarvam AI routing.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import api from '../../api.js';

// ── Network status hook ───────────────────────────────────────────────────────
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return isOnline;
}

// ── Main AI hook ──────────────────────────────────────────────────────────────
export function useHybridAI() {
  const isOnline = useOnlineStatus();

  // Backwards-compat fields — always report ready, Gemini 2.5 Flash
  const localModelStatus       = 'api-ready';
  const localModelProgress     = 100;
  const localModelProgressText = 'Gemini 2.5 Flash (server-side)';

  // ── Standard AI call ──────────────────────────────────────────────────────
  const askAI = useCallback(async (message, history = [], options = {}) => {
    if (!isOnline) {
      return {
        text: '⚠️ You are offline. Nexus AI requires an internet connection. Please reconnect.',
        model: 'offline',
        source: 'offline',
      };
    }
    try {
      const res = await api.post('/api/ai/consult', {
        message,
        history: history.slice(-6),
        language:            options.language            || 'en',
        languageInstruction: options.languageInstruction || '',
        detectedLanguage:    options.detectedLanguage    || '',
      });
      return {
        text:    res.data.reply  || '',
        model:   res.data.model  || 'gemini-2.5-flash',
        source:  'cloud',
        intent:  res.data.intent || 'CHAT',
      };
    } catch (e) {
      return { text: `Error: ${e.message}`, model: 'error', source: 'error' };
    }
  }, [isOnline]);

  // Alias used by some components
  const ask = askAI;

  // ── Draft generation ──────────────────────────────────────────────────────
  const draftDocument = useCallback(async (instruction, currentDraft = '', caseFacts = '') => {
    if (!isOnline) {
      return { text: '⚠️ Drafting requires an internet connection.', model: 'offline' };
    }
    try {
      const res = await api.post('/api/ai/voice-draft', { instruction, currentDraft, caseFacts });
      return { text: res.data.reply || '', model: res.data.model || 'gemini-2.5-flash', source: 'cloud' };
    } catch (e) {
      return { text: `Draft error: ${e.message}`, model: 'error' };
    }
  }, [isOnline]);

  // ── Legal research ────────────────────────────────────────────────────────
  const researchLegal = useCallback(async (query) => {
    if (!isOnline) {
      return { text: '⚠️ Research requires an internet connection.', model: 'offline', results: [] };
    }
    try {
      const res = await api.post('/api/ai/search', { query });
      return {
        text:    res.data.summary || '',
        model:   res.data.model   || 'gemini-2.5-flash',
        results: res.data.results || [],
        source:  'cloud',
      };
    } catch (e) {
      return { text: `Research error: ${e.message}`, model: 'error', results: [] };
    }
  }, [isOnline]);

  // ── Intent classifier ─────────────────────────────────────────────────────
  const classifyIntent = useCallback((query) => {
    if (/draft|write|prepare|format|document|petition|notice|agreement|contract/i.test(query))
      return 'DRAFT';
    if (/latest|recent|current|news|judgment|2024|2025|2026|today|now/i.test(query))
      return 'SEARCH';
    return 'CHAT';
  }, []);

  // ── No-op stubs for backwards compat ─────────────────────────────────────
  const initLocalModel   = useCallback(() => Promise.resolve(), []);
  const enableLocalModel = useCallback(() => {}, []);
  const disableLocalAI   = useCallback(() => {}, []);

  return {
    askAI,
    ask,
    draftDocument,
    researchLegal,
    classifyIntent,

    isOnline,
    localModelStatus,
    localModelProgress,
    localModelProgressText,
    localAIReady:  true,
    usingLocalAI:  false,
    isLocalReady:  true,

    initLocalModel,
    enableLocalModel,
    enableLocalAI:   enableLocalModel,
    disableLocalAI,
    setAutoDownload: () => {},
    autoDownload:    false,

    currentModel: isOnline ? 'gemini-2.5-flash' : 'offline',
    modelLabel:   isOnline ? 'Gemini 2.5 Flash' : 'Offline',
    draftModel:   'gemini-2.5-flash',
    draftFallback: 'gemini-2.5-flash',
  };
}

export default useHybridAI;
