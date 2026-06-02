// ─── DeadlineEngine.js ────────────────────────────────────────────────────────
// Kerala Court Procedural Deadline Calculator [F11]
// Based on CPC / CrPC procedural rules applicable in Kerala
// ─────────────────────────────────────────────────────────────────────────────

export const CASE_TYPES = [
  { id: 'os', label: 'Original Suit (OS)' },
  { id: 'ia', label: 'Interlocutory Application (IA)' },
  { id: 'criminal', label: 'Criminal Case (CC/SC/Sessions)' },
  { id: 'writ', label: 'Writ Petition (WP)' },
  { id: 'appeal', label: 'Civil Appeal (RFA/AS)' },
  { id: 'execution', label: 'Execution Petition (EP)' },
  { id: 'family', label: 'Family Court (OP/FCOP)' },
  { id: 'consumer', label: 'Consumer Forum (CC)' },
];

// Returns array of { label, daysFromBase, rule, date } sorted by date
export function calculateDeadlines(caseType, baseDate) {
  const base = new Date(baseDate);
  const add = (days) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const deadlines = {
    os: [
      { label: 'Serve Summons on Defendant',         days: 7,   rule: 'CPC Order V Rule 1' },
      { label: 'Written Statement due',               days: 30,  rule: 'CPC Order VIII Rule 1' },
      { label: 'Rejoinder (if any)',                  days: 45,  rule: 'CPC Order VIII Rule 9' },
      { label: 'Framing of Issues',                   days: 60,  rule: 'CPC Order XIV Rule 1' },
      { label: 'Plaintiff Evidence',                  days: 90,  rule: 'CPC Order XVIII Rule 4' },
      { label: 'Defendant Evidence',                  days: 120, rule: 'CPC Order XVIII Rule 4' },
      { label: 'Final Arguments',                     days: 150, rule: 'CPC Order XVIII Rule 2' },
      { label: 'File Memo of Parties',                days: 5,   rule: 'High Court Rules, Kerala' },
    ],
    ia: [
      { label: 'Counter Affidavit due',               days: 10,  rule: 'CPC Order XXXIX Rule 3' },
      { label: 'Reply Affidavit (if any)',             days: 17,  rule: 'CPC Order XIX' },
      { label: 'Hearing of IA',                        days: 21,  rule: 'CPC Order XXXIX Rule 3A' },
    ],
    criminal: [
      { label: 'Police Report / Charge Sheet',        days: 60,  rule: 'CrPC Section 167(2)' },
      { label: 'Charges to be framed',                days: 30,  rule: 'CrPC Section 240' },
      { label: 'Prosecution Evidence',                days: 90,  rule: 'CrPC Section 311' },
      { label: 'Defence Evidence',                    days: 120, rule: 'CrPC Section 315' },
      { label: 'Final Arguments',                     days: 135, rule: 'CrPC Section 314' },
      { label: 'Bail Application — Hearing',          days: 3,   rule: 'CrPC Section 437' },
    ],
    writ: [
      { label: 'Counter Affidavit by Respondent',    days: 28,  rule: 'Kerala HC Rules Rule 18' },
      { label: 'Reply Affidavit by Petitioner',      days: 42,  rule: 'Kerala HC Rules Rule 19' },
      { label: 'Admission Hearing',                   days: 7,   rule: 'Kerala HC Original Side Rules' },
    ],
    appeal: [
      { label: 'File Memorandum of Appeal',           days: 30,  rule: 'CPC Order XLI Rule 1' },
      { label: 'Limitation Period (decree/order)',    days: 90,  rule: 'Limitation Act Art. 116' },
      { label: 'Serve Notice of Appeal',              days: 15,  rule: 'CPC Order XLI Rule 11' },
      { label: 'Cross-Objection if any',              days: 30,  rule: 'CPC Order XLI Rule 22' },
    ],
    execution: [
      { label: 'File Execution Petition',             days: 12*365, rule: 'Limitation Act Art. 136' },
      { label: 'Notice to Judgment Debtor',           days: 14,  rule: 'CPC Order XXI Rule 22' },
      { label: 'Show Cause Notice period',            days: 30,  rule: 'CPC Order XXI Rule 37' },
    ],
    family: [
      { label: 'Counter Petition due',               days: 30,  rule: 'Family Courts Act 1984' },
      { label: 'Mediation / Reconciliation',         days: 60,  rule: 'Family Courts Act Section 9' },
      { label: 'Evidence Stage',                      days: 90,  rule: 'Family Courts Act Section 13' },
    ],
    consumer: [
      { label: 'Notice to Opposite Party',           days: 21,  rule: 'Consumer Protection Act 2019 S.38' },
      { label: 'Response from Opposite Party',       days: 45,  rule: 'Consumer Protection Act 2019 S.38(2)' },
      { label: 'Hearing',                             days: 75,  rule: 'Consumer Protection Act 2019 S.38(3)' },
      { label: 'Disposal (target)',                  days: 150, rule: 'Consumer Protection Act 2019 S.38(7)' },
    ],
  };

  const list = (deadlines[caseType] || deadlines.os).map(d => ({
    ...d,
    date: add(d.days),
    daysFromToday: Math.ceil((new Date(add(d.days)) - new Date()) / (1000*60*60*24)),
  }));
  return list.sort((a, b) => a.days - b.days);
}
