// GET /api/calls         — list calls
// DELETE /api/calls?id=  — delete call
import { requireAuth } from './_lib/auth.js';
import { getCalls, deleteCall } from './_lib/db.js';
export default async function handler(req, res) {
  const user = requireAuth(req, res); if (!user) return;
  if (req.method === 'GET') {
    const calls = await getCalls(user.id);
    return res.json(calls);
  }
  if (req.method === 'DELETE') {
    const id = req.query.id || req.body?.id;
    if (id) await deleteCall(user.id, id);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
