import bcrypt from 'bcryptjs';
import { getUserByEmail, saveUser, newUserId } from '../_lib/db.js';
import { signToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { name, email, phone, password, barCouncilNo, specialisation, affiliateCode } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: newUserId(), name: name.trim(), email: email.toLowerCase().trim(), phone: phone || '', passwordHash, role: 'advocate', barCouncilNo: barCouncilNo || '', specialisation: specialisation || '', affiliateCode: affiliateCode || '', status: 'active', createdAt: Date.now() };
    await saveUser(user);
    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser });
  } catch (e) { res.status(500).json({ error: 'Signup failed.' }); }
}
