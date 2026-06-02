import bcrypt from 'bcryptjs';
import { getUserByEmail } from '../_lib/db.js';
import { signToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  try {
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'No account found with this email.' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Incorrect password.' });
    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    const { passwordHash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (e) { res.status(500).json({ error: 'Login failed.' }); }
}
