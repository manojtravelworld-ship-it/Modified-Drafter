// POST /api/ai/suggestions
import { requireAuth } from '../_lib/auth.js';
import { geminiJSON } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { pageText, pageNum = 1, docType = 'legal document' } = req.body || {};
  if (!pageText?.trim()) return res.json({ ok: true, suggestions: [] });
  try {
    const suggestions = await geminiJSON(
      `Review this ${docType} draft (page ${pageNum}) for a Kerala court. Return a JSON array of up to 4 suggestions.
Each item: { "type": "add"|"edit"|"delete", "severity": "critical"|"advisory"|"enhancement", "line": "section description", "text": "suggestion" }
Only return the JSON array, no other text.
Draft:\n${pageText.slice(0, 1500)}`
    );
    res.json({ ok: true, suggestions: Array.isArray(suggestions) ? suggestions : [] });
  } catch (e) { res.json({ ok: true, suggestions: [] }); }
}
