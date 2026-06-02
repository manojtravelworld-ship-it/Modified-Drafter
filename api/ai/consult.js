// POST /api/ai/consult
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { message, history = [] } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message required' });
  try {
    const historyText = history.slice(-6).map(h => `${h.role === 'ai' ? 'Assistant' : 'User'}: ${h.text}`).join('\n');
    const prompt = historyText ? `${historyText}\nUser: ${message}` : message;
    const reply = await geminiChat(prompt);
    res.json({ reply, model: 'gemini-2.5-flash' });
  } catch (e) {
    console.error('Consult error:', e.message);
    res.status(500).json({ error: 'AI unavailable. Check GEMINI_API_KEY.' });
  }
}
