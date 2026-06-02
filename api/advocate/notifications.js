// GET /api/advocate/notifications
// PUT /api/advocate/notifications  (mark read: body { notifId })
import { requireAuth } from '../_lib/auth.js';
import { getNotifications, markNotifRead } from '../_lib/db.js';
export default async function handler(req, res) {
  const user = requireAuth(req, res); if (!user) return;
  if (req.method === 'GET') {
    const notifs = await getNotifications(user.id);
    return res.json(notifs);
  }
  if (req.method === 'PUT') {
    const { notifId } = req.body || {};
    const updated = await markNotifRead(user.id, notifId);
    return res.json(updated);
  }
  res.status(405).end();
}
