// GET /api/advocate/insights
import { requireAuth } from '../_lib/auth.js';
import { getUserById } from '../_lib/db.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  try {
    const full = await getUserById(user.id);
    res.json({ ok: true, advocate: { name: full?.name || user.name, activeCases: 0, joinedAt: full?.createdAt } });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
