// POST /api/ai/extract-order
import { requireAuth } from '../_lib/auth.js';
import { geminiJSON } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { ocrText } = req.body || {};
  try {
    const data = await geminiJSON(
      `Extract structured data from this Indian court order. Return ONLY JSON:
{"hearingDate":"YYYY-MM-DD or null","caseNumber":"string or null","courtName":"string or null","directive":"what the court ordered","nextSteps":"what the advocate must do"}
OCR text:\n${(ocrText || '').slice(0,2000)}`
    );
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ error: 'Extraction failed.' }); }
}
