import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { draftFacts, draftModel } = req.body || {};
  if (!draftFacts?.trim()) {
    return res.status(400).json({ error: 'facts are required' });
  }
  try {
    const prompt = `Based on the following facts of the case:
${draftFacts}

${draftModel ? `And using this model/template as a guide:
${draftModel}` : ''}

Please draft a formal legal document suitable for submission before a court. 
Maintain a professional legal tone, use appropriate legal terminology, and follow standard court formatting.`;

    const text = await geminiChat(prompt);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Drafting failed' });
  }
}
