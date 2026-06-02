import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { draftFacts } = req.body || {};
  if (!draftFacts?.trim()) {
    return res.status(400).json({ error: 'facts are required' });
  }
  try {
    const prompt = `You are an expert legal researcher specializing in Indian Supreme Court and High Court judgments.
Based on the following facts of the case:
"${draftFacts}"

Please analyze the case facts and find 3 highly relevant and favorable, real or highly probable Supreme Court or High Court case citations that support our client's legal position in this exact context.
If absolutely no relevant precedents or cases can be found for these facts, respond with exactly:
NO_CASES_FOUND

Otherwise, respond ONLY with the relevant cases in the following exact format (do not include any conversational intro/outro, only the structured blocks):

[CASE]
Title: [Provide the exact Case Citation, e.g., Satish Chandra Verma v. Union of India (2019) SCC Online SC or state high court equivalents]
Court: [Supreme Court or High Court]
Paragraph: [Write a highly detailed, professional paragraph explaining the legal principle, relevant paragraph excerpt, and why this case is favorable to our current client's context.]
[END_CASE]

Remember, if you find nothing, output exactly "NO_CASES_FOUND". Do not add markdown styling around the blocks.`;

    const text = await geminiChat(prompt);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Citations search failed' });
  }
}
