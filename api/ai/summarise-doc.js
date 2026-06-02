// POST /api/ai/summarise-doc
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { text } = req.body || {};
  try {
    const summary = await geminiChat(
      `Summarise this Indian legal document in exactly 4 bullet points:\n1. Document type and date\n2. Parties involved\n3. Key dates, deadlines, or orders\n4. Action required by advocate\nDocument:\n${(text || '').slice(0,3000)}\nReturn only the 4 bullet points.`
    );
    res.json({ ok: true, summary, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Summarisation failed.' }); }
}
