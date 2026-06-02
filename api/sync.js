// POST /api/sync — stub for offline sync queue
import { requireAuth } from './_lib/auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = requireAuth(req, res); if (!user) return;
  // In test mode, acknowledge sync without processing
  res.json({ ok: true, synced: 0 });
}
