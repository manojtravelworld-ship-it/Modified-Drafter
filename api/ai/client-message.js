// POST /api/ai/client-message
import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { clientName, caseNumber, courtName, nextDate, purpose, channel = 'whatsapp', language = 'ml' } = req.body || {};
  const langMap = { ml: 'Write ENTIRELY in Malayalam script.', hi: 'Write in Hindi.', en: 'Write in English.' };
  const prompts = {
    whatsapp: `${langMap[language] || langMap.ml} Draft a brief friendly WhatsApp message to client ${clientName} about case ${caseNumber} at ${courtName}. Next hearing: ${nextDate} for ${purpose}. 2-3 sentences. Sign as "Advocate".`,
    letter: `Draft a formal English letter to client ${clientName} re: Case ${caseNumber} at ${courtName}. Next hearing: ${nextDate} for ${purpose}. Use formal legal letter format.`,
    sms: `One SMS under 160 chars to ${clientName}: Case ${caseNumber} at ${courtName} listed on ${nextDate} for ${purpose}.`,
  };
  try {
    const message = await geminiChat(prompts[channel] || prompts.whatsapp);
    res.json({ ok: true, message, model: 'gemini-2.5-flash' });
  } catch (e) { res.status(500).json({ error: 'Message generation failed.' }); }
}
