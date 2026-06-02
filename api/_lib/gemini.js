// ─── api/_lib/gemini.js ───────────────────────────────────────────────────────
// Gemini AI helpers with robust retries and fallback
// ─────────────────────────────────────────────────────────────────────────────
import { GoogleGenAI } from '@google/genai';

const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-3.5-flash';

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Simple sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callGeminiWithRobustness(parameters) {
  const ai = getClient();
  
  // Try PRIMARY_MODEL with robust retries
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        ...parameters,
        model: PRIMARY_MODEL,
      });
      return response;
    } catch (e) {
      const errMsg = e.message || String(e);
      const isOverload = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429') || errMsg.includes('high demand') || errMsg.includes('busy');
      
      console.warn(`Attempt ${attempt} failed with ${PRIMARY_MODEL}. Error: ${errMsg}`);
      
      if (attempt === 1 && isOverload) {
        // Wait a bit and try again
        await sleep(500);
        continue;
      }
      
      // If still overloaded or if it's attempt 2, call highly available fallback model
      if (isOverload) {
        console.warn(`Falling back to ${FALLBACK_MODEL} due to overload on ${PRIMARY_MODEL}.`);
        try {
          const response = await ai.models.generateContent({
            ...parameters,
            model: FALLBACK_MODEL,
          });
          return response;
        } catch (fallbackErr) {
          console.error(`Fallback model ${FALLBACK_MODEL} also failed:`, fallbackErr);
          throw fallbackErr;
        }
      }
      
      throw e;
    }
  }
}

export async function geminiChat(prompt, systemInstruction) {
  const response = await callGeminiWithRobustness({
    contents: prompt,
    config: {
      systemInstruction: systemInstruction || 'You are Nexus Justice AI, a legal assistant for Kerala advocates. Be precise, professional, and cite relevant Indian law sections. Support both English and Malayalam.',
    }
  });
  return response.text;
}

export async function geminiJSON(prompt) {
  const response = await callGeminiWithRobustness({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    }
  });
  const text = response.text;
  try { return JSON.parse(text); }
  catch { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
}
