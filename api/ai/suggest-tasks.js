// POST /api/ai/suggest-tasks
import { requireAuth } from '../_lib/auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  const { caseType = '', purpose = '' } = req.body || {};
  const taskMap = {
    'Original Suit': ['File plaint','Pay court fees','Serve summons','File Written Statement','Attend framing of issues','Lead evidence','File final arguments'],
    'Criminal': ['Appear for bail hearing','File bail application','Attend charge framing','Attend trial','File written arguments'],
    'Writ Petition': ['File writ petition','Pay court fees','File affidavit','Attend admission hearing','File counter affidavit'],
    'Appeal': ['File memorandum of appeal','Pay court fees','Serve notice on respondent','Attend admission'],
    'Family Court': ['File petition','Attend mediation','Lead evidence','File final arguments'],
  };
  let tasks = ['Attend next hearing','Prepare case file','Brief client on developments'];
  for (const [key, val] of Object.entries(taskMap)) {
    if (caseType.toLowerCase().includes(key.toLowerCase()) || purpose.toLowerCase().includes(key.toLowerCase())) {
      tasks = val; break;
    }
  }
  res.json({ ok: true, tasks: tasks.map(t => ({ text: t, done: false, dueDate: null })) });
}
