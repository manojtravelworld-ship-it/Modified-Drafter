import { requireAuth } from '../_lib/auth.js';
import { geminiChat } from '../_lib/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { target, draftFacts, draftModel, customPromptText, workbenchDocs = [] } = req.body || {};
  
  try {
    const factsText = draftFacts?.trim() || "(No facts provided yet)";
    const modelTemplate = draftModel?.trim() ? `Model Draft / Template Guide:\n${draftModel.trim()}` : "";
    
    let docsContentSection = "";
    if (workbenchDocs.length > 0) {
      docsContentSection = "\n\nUploaded Supporting Case Documents:\n" + workbenchDocs.map((doc, idx) => {
        return `--- Document #${idx + 1}: ${doc.name} (Type: ${doc.type}) ---
Extracted Content / Refined Text:
${doc.content || "(No extracted text or processing error)"}
`;
      }).join("\n");
    }
    
    let prompt = "";
    if (target === 'draft') {
      prompt = `You are an elite legal drafting expert specializing in Indian legal pleadings and court documents.
The user wants a customized legal draft based on:

Case Facts:
${factsText}

${modelTemplate}
${docsContentSection}

User's Specific Instructions & Prompt:
"${customPromptText}"

Please analyze the facts, synthesize any uploaded supporting case documents, and follow the user's specific instructions to generate an exceptionally high-quality, professional court-ready draft. 
Return ONLY the direct text of the petition/plaint itself, with structured headings, formal legal tone, and appropriate statutory references. Keep the document comprehensive.`;
    } else {
      prompt = `You are a senior judicial scholar and elite legal advisor.
The user wants a customized, professional set of improvement suggestions and legal strategies based on:

Case Facts:
${factsText}

${modelTemplate}
${docsContentSection}

User's Specific Instructions & Prompt:
"${customPromptText}"

Please analyze the facts, the uploaded supporting case documents, current document structure, and the user's specific instructions. Give 3 to 6 highly detailed, professional improvement recommendations, key statutory avenues, or formatting changes. 
Format your output cleanly using markdown with bold headings and bullet points.`;
    }

    const text = await geminiChat(prompt);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Custom prompting failed' });
  }
}
