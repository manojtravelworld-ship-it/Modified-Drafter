// ─── api/_lib/db.js ───────────────────────────────────────────────────────────
// Vercel KV (Redis) database helpers
// All user data stored as JSON strings under simple key patterns:
//   user:{email}        → { id, name, email, passwordHash, role, createdAt }
//   userid:{id}         → email  (reverse lookup)
//   session:{token}     → userId (optional — JWT is stateless, this is for revocation)
//
// Vercel KV is Redis-compatible — free tier: 30K commands/day, 256MB storage
// Setup: vercel.com → Storage → Create KV Database → link to project
// Env vars auto-injected: KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN etc.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';

// Local file-backed database mock for Vercel KV persistence
const DB_FILE = path.join(process.cwd(), 'local_kv_db.json');
let store = {};

function loadStore() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      store = JSON.parse(content || '{}');
    }
  } catch (e) {
    console.warn('Could not read local_kv_db.json, using fresh in-memory database', e);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not save local_kv_db.json', e);
  }
}

// Initial load
loadStore();

export const kv = {
  get: async (key) => {
    loadStore();
    return store[key] !== undefined ? store[key] : null;
  },
  set: async (key, value) => {
    store[key] = value;
    saveStore();
    return 'OK';
  },
  del: async (key) => {
    delete store[key];
    saveStore();
    return 1;
  }
};

// ── User helpers ─────────────────────────────────────────────────────────────

export async function getUserByEmail(email) {
  if (!email) return null;
  const data = await kv.get(`user:${email.toLowerCase()}`);
  return data || null;
}

export async function getUserById(id) {
  if (!id) return null;
  const email = await kv.get(`userid:${id}`);
  if (!email) return null;
  return getUserByEmail(email);
}

export async function saveUser(user) {
  const key = `user:${user.email.toLowerCase()}`;
  await kv.set(key, user);
  await kv.set(`userid:${user.id}`, user.email.toLowerCase());
  return user;
}

export async function updateUser(email, updates) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const updated = { ...user, ...updates, updatedAt: Date.now() };
  await kv.set(`user:${email.toLowerCase()}`, updated);
  return updated;
}

export function newUserId() {
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function getNotifications(userId) {
  const data = await kv.get(`notif:${userId}`);
  return data || [];
}

export async function addNotification(userId, notif) {
  const existing = await getNotifications(userId);
  const updated = [{ ...notif, id: Date.now().toString(), read: false, createdAt: Date.now() }, ...existing].slice(0, 50);
  await kv.set(`notif:${userId}`, updated);
  return updated;
}

export async function markNotifRead(userId, notifId) {
  const notifs = await getNotifications(userId);
  const updated = notifs.map(n => n.id === notifId ? { ...n, read: true } : n);
  await kv.set(`notif:${userId}`, updated);
  return updated;
}

// ── Calls log ─────────────────────────────────────────────────────────────────
export async function getCalls(userId) {
  const data = await kv.get(`calls:${userId}`);
  return data || [];
}

export async function addCall(userId, call) {
  const existing = await getCalls(userId);
  const newCall = { ...call, id: Date.now().toString(), receivedAt: Date.now() };
  const updated = [newCall, ...existing].slice(0, 100);
  await kv.set(`calls:${userId}`, updated);
  return newCall;
}

export async function deleteCall(userId, callId) {
  const existing = await getCalls(userId);
  const updated = existing.filter(c => c.id !== callId);
  await kv.set(`calls:${userId}`, updated);
}
