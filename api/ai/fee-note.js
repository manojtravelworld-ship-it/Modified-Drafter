// POST /api/ai/fee-note
import { requireAuth } from '../_lib/auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { advocateName, barCouncilNo, clientName, caseNumber, courtName, workDone, amount } = req.body || {};
  const today = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
  const html = `<div style="font-family:Georgia,serif;max-width:600px;margin:auto;padding:40px;border:2px solid #333">
<div style="text-align:center;margin-bottom:20px"><h2 style="margin:0;font-size:20px;text-transform:uppercase">ADVOCATE'S FEE NOTE</h2><p style="margin:4px 0;font-size:13px">Date: ${today}</p></div>
<p><strong>From:</strong> ${advocateName || 'Advocate'}<br><span style="font-size:12px">Bar Council Enrolment No: ${barCouncilNo || 'N/A'}</span></p>
<p><strong>To:</strong> ${clientName}</p><hr/>
<p><strong>Re:</strong> Case No. ${caseNumber} before ${courtName}</p>
<p><strong>Work Done:</strong> ${workDone}</p><hr/>
<p style="font-size:18px;text-align:right"><strong>Fee: ₹${amount}/-</strong></p>
<p style="font-size:11px;color:#555;margin-top:30px">This fee note is for professional legal services rendered. Payment due within 7 days.</p>
<div style="margin-top:60px;text-align:right"><p>_____________________<br/>${advocateName || 'Advocate'}<br/>Advocate</p></div></div>`;
  res.json({ ok: true, html });
}
