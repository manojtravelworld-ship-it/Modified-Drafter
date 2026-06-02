// POST /api/ai/voice-draft
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { instruction, caseFacts = '', context = '' } = req.body || {};
  try {
    const prompt = `Draft a legal document section for a Kerala court based on this instruction:\n${instruction}\n${caseFacts ? 'Case facts: ' + caseFacts : ''}\n${context ? 'Context: ' + context.slice(0,500) : ''}`;
    const reply = await geminiChat(prompt, 'You are a Kerala legal drafting expert. Draft formal court documents in proper Indian legal format. Support both English and Malayalam.');
    res.json({ reply, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Drafting unavailable.' }); }
}
