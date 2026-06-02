// POST /api/ai/search
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { query } = req.body || {};
  try {
    const reply = await geminiChat(
      `Legal research query: ${query}\nProvide relevant Indian law sections, case precedents, and analysis. Cite specific sections and landmark cases.`,
      'You are an Indian legal research AI. Provide accurate citations from Indian statutes and Supreme Court/High Court judgments.'
    );
    res.json({ summary: reply, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Search unavailable.' }); }
}
