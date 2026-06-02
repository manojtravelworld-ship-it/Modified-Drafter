// GET /api/advocate/subscription
import { requireAuth } from '../_lib/auth.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  // All active in test mode — no subscription logic
  res.json({ status: 'active', plan: 'Pro', daysLeft: 30 });
}
