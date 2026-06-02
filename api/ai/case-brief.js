// POST /api/ai/case-brief
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { clientName, caseNumber, courtName, purpose, notes = '', chatSummary = '' } = req.body || {};
  try {
    const brief = await geminiChat(
      `Generate a structured 1-page case brief.\nClient: ${clientName} | Case: ${caseNumber} | Court: ${courtName} | Stage: ${purpose}\nNotes: ${notes.slice(0,500)}\nConsultation: ${chatSummary.slice(0,500)}\n\nFormat:\n## PARTIES\n## FACTS OF THE CASE\n## LEGAL ISSUES\n## APPLICABLE LAW (with sections)\n## ARGUMENTS / STRATEGY\n## CURRENT STATUS\n## NEXT STEPS`
    );
    res.json({ ok: true, brief, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Brief generation failed.' }); }
}
