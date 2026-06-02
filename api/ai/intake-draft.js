// POST /api/ai/intake-draft
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { caseType, fields, advocateName = 'Advocate', barCouncilNo = '' } = req.body || {};
  try {
    const fieldStr = Object.entries(fields || {}).map(([k,v]) => `${k}: ${v}`).join('\n');
    const draft = await geminiChat(
      `Draft Page 1 of a ${caseType} for a Kerala court in proper Indian court format.\nAdvocate: ${advocateName}, Bar Council No: ${barCouncilNo}\nDetails:\n${fieldStr}`,
      'You are a Kerala court legal drafting expert. Use proper Indian court heading format: court name, case number, parties, opening paragraphs.'
    );
    res.json({ ok: true, draft, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Draft generation failed.' }); }
}
