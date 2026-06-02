export default async function handler(req, res) {
  res.status(501).json({ ok: false, connected: false, error: 'Google Drive not configured in test mode.' });
}
