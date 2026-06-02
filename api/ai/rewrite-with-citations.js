import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { draftFacts, initialDraft, selectedCitationsList } = req.body || {};
  if (!draftFacts?.trim()) return res.status(400).json({ error: 'facts are required' });
  if (!initialDraft?.trim()) return res.status(400).json({ error: 'initialDraft is required' });
  if (!selectedCitationsList?.trim()) return res.status(400).json({ error: 'selectedCitationsList is required' });
  try {
    const prompt = `You are an elite Senior Legal Draftsman.
We are drafting a court complaint / petition based on these facts:
"${draftFacts}"

We have already prepared an initial draft:
"${initialDraft}"

The user has selected the following favorable case citations which MUST be fully integrated into the petition to support our client's position:
${selectedCitationsList}

Please rewrite the entire court complaint / petition to:
1. Seamlessly integrate and argue these accepted precedents at their logically correct positions in the petition (such as in legal grounds, pleadings, or arguments section).
2. Clearly cite the case name, court, and details, framing them beautifully.
3. Keep the formal format, structured structure, and high legal quality of the document intact.
4. Do not output checklists or notes or bullet summaries; return the complete, polished, court-ready rewritten text.`;

    const text = await geminiChat(prompt);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Rewrite failed' });
  }
}
