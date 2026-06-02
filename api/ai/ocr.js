import { requireAuth } from '../_lib/auth.js';
import { callGeminiWithRobustness } from '../_lib/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });
  try {
    const response = await callGeminiWithRobustness({
      contents: [
        { inlineData: { data: imageBase64, mimeType } },
        'Extract all text from this legal document image verbatim. Preserve all dates, names, case numbers.',
      ]
    });
    res.json({ ok: true, text: response.text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'OCR failed.' });
  }
}
