import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const balanceRouter = Router();
balanceRouter.use(requireAuth);

const yearMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const balanceBodySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  startingBalance: z.number().min(-1_000_000).max(1_000_000),
});

balanceRouter.get('/', async (req, res) => {
  const parsed = yearMonthQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'year and month query params are required' });
  }
  const { year, month } = parsed.data;

  const result = await pool.query(
    'SELECT starting_balance AS "startingBalance" FROM monthly_balances WHERE user_id = $1 AND year = $2 AND month = $3',
    [req.userId, year, month]
  );
  res.json({ startingBalance: result.rows[0]?.startingBalance ?? '0' });
});

balanceRouter.put('/', async (req, res) => {
  const parsed = balanceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid balance data' });
  }
  const { year, month, startingBalance } = parsed.data;

  const result = await pool.query(
    `INSERT INTO monthly_balances (user_id, year, month, starting_balance)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, year, month)
     DO UPDATE SET starting_balance = EXCLUDED.starting_balance
     RETURNING starting_balance AS "startingBalance"`,
    [req.userId, year, month, startingBalance]
  );
  res.json(result.rows[0]);
});
