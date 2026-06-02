// ─── LocalAIController.js ─────────────────────────────────────────────────────
// Nexus Justice v5 — Gemini 2.5 Flash edition
//
// Previously: downloaded Gemma 2B (~1GB) to the user's phone via WebLLM.
// Now:        calls Gemma 3n-E4B-IT on Google AI Studio from the server.
//             Same API key as Gemini. Zero download. Works on any device.
//             Model: gemma-3n-e4b-it
// ─────────────────────────────────────────────────────────────────────────────

import api from '../../api.js';

// ── Response cache — avoids duplicate API calls for identical prompts ──────────
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.value;
}
function setCache(key, value) {
  if (_cache.size > 50) _cache.delete(_cache.keys().next().value);
  _cache.set(key, { value, ts: Date.now() });
}

// ── Main controller class ─────────────────────────────────────────────────────
class GemmaAPIController {
  constructor() {
    // status is always 'ready' — no download required
    this.status   = 'ready';
    this.model    = 'gemini-3.5-flash';      // PRIMARY ORCHESTRATOR
    this.draftModel = 'gemini-3.5-flash';          // PRIMARY for drafting
    this.fallback   = 'gemini-3.5-flash'; // fallback for both
    this.progress = 100;
  }

  // Compatibility shim — callers that used to wait for model download
  // now resolve immediately since the model is server-side
  async init() { return Promise.resolve(); }
  isReady()    { return true; }
  isLoading()  { return false; }
  async destroy() {}

  // ── Primary chat method ──────────────────────────────────────────────────
  async chat(userMessage, systemPrompt = '', history = []) {
    const cacheKey = JSON.stringify({ userMessage, systemPrompt, history: history.slice(-2) });
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const res = await api.post('/api/ai/consult', {
        message: userMessage,
        history: history.slice(-6).map(h => ({ role: h.role, text: h.text })),
        language: 'en',
        languageInstruction: systemPrompt || '',
      });
      const text = res.data.reply || 'No response received.';
      setCache(cacheKey, text);
      return text;
    } catch (e) {
      if (!navigator.onLine) {
        return 'You are offline. Please reconnect to use Nexus AI (powered by Gemini AI).';
      }
      throw e;
    }
  }

  // ── Fast document drafting via Gemma 3n ──────────────────────────────────
  async draft(instruction, currentDraft = '', caseFacts = '') {
    try {
      const res = await api.post('/api/ai/voice-draft', {
        instruction,
        currentDraft,
        caseFacts,
      });
      return res.data.reply || '';
    } catch (e) {
      throw new Error(`Draft failed: ${e.message}`);
    }
  }

  // ── Classify intent: SEARCH | DRAFT | CHAT ───────────────────────────────
  // Fast local heuristic — no API round-trip needed for routing
  async classifyIntent(query) {
    if (/draft|write|prepare|format|document|petition|notice|agreement|contract/i.test(query))
      return 'DRAFT';
    if (/latest|recent|current|news|judgment|2024|2025|2026|today|now/i.test(query))
      return 'SEARCH';
    return 'CHAT';
  }

  // ── Summarise call transcript ─────────────────────────────────────────────
  async summarise(transcript) {
    try {
      const res = await api.post('/api/ai/consult', {
        message: `Summarise this call transcript in 2 sentences:\n\n${transcript.slice(0, 1500)}`,
        history: [],
      });
      return res.data.reply || '';
    } catch { return ''; }
  }
}

// Singleton — drop-in replacement for old localAI singleton
export const localAI = new GemmaAPIController();
export default localAI;
