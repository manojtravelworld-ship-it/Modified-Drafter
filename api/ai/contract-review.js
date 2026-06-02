// POST /api/ai/contract-review
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { contractText, documentType = 'contract' } = req.body || {};
  try {
    const review = await geminiChat(
      `Review this ${documentType} against Indian law:\n\n${(contractText || '').slice(0,4000)}`,
      'You are a senior Indian legal AI. Review contracts against: Indian Contract Act 1872, Specific Relief Act 1963, Transfer of Property Act 1882, Kerala Stamp Act, Registration Act 1908. Rate clauses: 🟢 STANDARD | 🟡 ADVISORY | 🔴 CRITICAL. Provide redline suggestions as: REPLACE: [original] → WITH: [suggested]'
    );
    res.json({ ok: true, review, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Review failed.' }); }
}
