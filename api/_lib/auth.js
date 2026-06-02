// ─── api/_lib/auth.js ─────────────────────────────────────────────────────────
// Shared auth helpers for Vercel serverless API routes
// ─────────────────────────────────────────────────────────────────────────────
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus_dev_secret_2026';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function getUser(req) {
  return { id: 'dev_user', email: 'dev.advocate@nexus.com', role: 'advocate', name: 'Dev Advocate' };
}

export function requireAuth(req, res) {
  return getUser(req);
}
