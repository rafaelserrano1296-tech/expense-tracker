import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
});

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

authRouter.post('/signup', asyncHandler(async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email or password (min 8 characters)' });
  }
  const { email, password } = parsed.data;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user;
  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );
    user = result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw err;
  }

  const token = signToken(user.id);
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }
  const { email, password } = parsed.data;

  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.userId]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(result.rows[0]);
}));

const passwordSchema = z.object({
  newPassword: z.string().min(8).max(100),
});

authRouter.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  const { newPassword } = parsed.data;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.userId]);
  res.status(204).end();
}));
