import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { draftText } = req.body || {};
  if (!draftText?.trim()) {
    return res.status(400).json({ error: 'draftText is required' });
  }
  try {
    const prompt = `Review the following legal draft and provide 3-5 specific suggestions for improvement or additional points to consider. Provide the suggestions as a bulleted list. Draft to review:
${draftText}`;

    const text = await geminiChat(prompt);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Suggestions failed' });
  }
}
