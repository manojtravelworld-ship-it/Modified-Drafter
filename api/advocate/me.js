// GET /api/advocate/me
import { requireAuth } from '../_lib/auth.js';
import { getUserById } from '../_lib/db.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  try {
    const full = await getUserById(user.id);
    if (!full) return res.status(404).json({ error: 'User not found' });
    const { passwordHash, ...safe } = full;
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
