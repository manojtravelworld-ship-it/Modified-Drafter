export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  res.json({ ok: true, message: 'Reset link sent. (Email not configured in test mode.)' });
}
