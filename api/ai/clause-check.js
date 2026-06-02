// POST /api/ai/clause-check
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { clause, docType = 'legal document', courtType = 'Kerala District Court' } = req.body || {};
  try {
    const analysis = await geminiChat(
      `Is this clause standard for a ${docType} in ${courtType}?\nClause: "${clause.slice(0,800)}"\n1. Standard/Non-standard/Missing citation\n2. Issue\n3. Suggested improvement citing exact Indian statute/rule. Max 4 sentences.`
    );
    res.json({ ok: true, analysis, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Clause check failed.' }); }
}
