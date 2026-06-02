// ─── ContractReview.js ────────────────────────────────────────────────────────
// AI Contract Review with Redlining [F19]
// Adapted from anthropics/claude-for-legal (Apache 2.0)
// Playbook tailored for Indian law: Contract Act 1872, Specific Relief Act,
// Kerala Stamp Act, Transfer of Property Act
// ─────────────────────────────────────────────────────────────────────────────

export const INDIA_PLAYBOOK = {
  governingLaw: 'Indian Contract Act, 1872 and applicable Indian statutes',
  jurisdiction: 'Courts in Kerala / India',
  standardClauses: [
    'Parties with full legal names and addresses',
    'Consideration clearly stated',
    'Object of contract (lawful)',
    'Performance obligations with timelines',
    'Breach and remedy clause',
    'Termination / determination clause',
    'Dispute resolution (Arbitration Act 1996 or civil court jurisdiction)',
    'Force majeure clause',
    'Governing law and jurisdiction',
    'Stamp duty compliance (Kerala Stamp Act / Indian Stamp Act)',
    'Witness and execution clause (two witnesses for property agreements)',
    'Registration requirement (if applicable under Registration Act 1908)',
  ],
  redFlags: [
    'Unlimited liability clauses',
    'Unilateral variation rights without notice',
    'Automatic renewal without opt-out',
    'Dispute resolution only in foreign jurisdiction',
    'No limitation of liability cap',
    'Missing arbitration clause for commercial contracts',
  ],
};

// Builds the review prompt for the AI
export function buildReviewPrompt(contractText, documentType = 'general') {
  return `You are a senior Indian legal AI assistant reviewing a ${documentType} contract.

INDIAN LAW PLAYBOOK:
- Governing Law: ${INDIA_PLAYBOOK.governingLaw}
- Jurisdiction: ${INDIA_PLAYBOOK.jurisdiction}

Review the following contract clause by clause. For each major clause or section:
1. Rate it: 🟢 STANDARD (complies with Indian norms) | 🟡 ADVISORY (acceptable but review) | 🔴 CRITICAL (non-standard, risky, or missing)
2. State the issue concisely
3. Suggest alternative/redline language if YELLOW or RED

Also check for presence of these standard clauses: ${INDIA_PLAYBOOK.standardClauses.join(', ')}.

Flag these red-flag patterns immediately: ${INDIA_PLAYBOOK.redFlags.join(', ')}.

CONTRACT TEXT:
${contractText.slice(0, 4000)}

Format your response as:
## OVERALL RISK: [LOW / MEDIUM / HIGH]
## CLAUSE REVIEW
[For each clause: Clause name → Rating → Issue → Redline suggestion]
## MISSING CLAUSES
[List any standard clauses that are absent]
## SUMMARY
[3-5 bullet points for the advocate]`;
}

// Parse AI response into structured redlines
export function parseReviewResponse(text) {
  const lines = text.split('\n');
  const clauses = [];
  let overall = 'MEDIUM';
  let inClauseSection = false;

  for (const line of lines) {
    if (line.includes('OVERALL RISK:')) {
      if (line.includes('HIGH')) overall = 'HIGH';
      else if (line.includes('LOW')) overall = 'LOW';
      else overall = 'MEDIUM';
    }
    if (line.includes('## CLAUSE REVIEW')) { inClauseSection = true; continue; }
    if (line.startsWith('## ') && inClauseSection) { inClauseSection = false; }
    if (inClauseSection && line.trim()) {
      const rating = line.includes('🔴') ? 'critical' : line.includes('🟡') ? 'advisory' : line.includes('🟢') ? 'standard' : null;
      if (rating) clauses.push({ text: line.trim(), rating });
    }
  }
  return { overall, clauses, fullText: text };
}
