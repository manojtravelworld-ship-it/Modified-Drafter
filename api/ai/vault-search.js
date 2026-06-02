// POST /api/ai/vault-search
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { query, kbDocs = [] } = req.body || {};
  try {
    const docContext = kbDocs.map(d => `- ${d.name} (${d.category})`).join('\n') || '(No documents uploaded yet)';
    const answer = await geminiChat(
      `Advocate's Knowledge Base documents:\n${docContext}\n\nQuery: "${query}"\n\n1. Which document is most relevant?\n2. What does Indian law say about this query? Cite relevant sections. 3-4 sentences.`
    );
    res.json({ ok: true, answer, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Vault search failed.' }); }
}
