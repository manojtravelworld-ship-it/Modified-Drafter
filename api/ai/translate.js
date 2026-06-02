import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { text, targetLang = 'ml-IN' } = req.body || {};
  
  // Strip regional tags if present (e.g. ml-IN -> ml, hi-IN -> hi)
  const langCode = targetLang.split('-')[0].toLowerCase();
  const langNames = { 
    ml: 'Malayalam', 
    hi: 'Hindi', 
    ta: 'Tamil', 
    en: 'English', 
    te: 'Telugu', 
    kn: 'Kannada',
    mr: 'Marathi',
    gu: 'Gujarati',
    pa: 'Punjabi',
    bn: 'Bengali',
    od: 'Odia',
    ur: 'Urdu'
  };
  
  try {
    const targetLanguageName = langNames[langCode] || langCode;
    const translated = await geminiChat(`Translate to ${targetLanguageName}. Return only the translated text, do not add explanation or introductory sentences:\n\n${(text || '').slice(0, 2000)}`);
    res.json({ ok: true, translatedText: translated, translated: translated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Translation failed.' });
  }
}
