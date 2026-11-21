import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

const expenseSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  description: z.string().trim().max(200).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

expensesRouter.get('/', async (req, res) => {
  const { from, to } = req.query;
  const conditions = ['e.user_id = $1'];
  const params = [req.userId];

  if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    params.push(from);
    conditions.push(`e.spent_at >= $${params.length}`);
  }
  if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    params.push(to);
    conditions.push(`e.spent_at <= $${params.length}`);
  }

  const result = await pool.query(
    `SELECT e.id, e.amount, e.description, e.spent_at AS "spentAt", e.category_id AS "categoryId",
            c.name AS "categoryName", c.color AS "categoryColor"
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.spent_at DESC, e.id DESC`,
    params
  );
  res.json(result.rows);
});

const summaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

expensesRouter.get('/summary', async (req, res) => {
  const parsed = summaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'year and month query params are required' });
  }
  const { year, month } = parsed.data;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

  const result = await pool.query(
    `SELECT c.id AS "categoryId", c.name AS "categoryName", c.color AS "categoryColor",
            COALESCE(SUM(e.amount), 0) AS total
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.user_id = $1 AND date_trunc('month', e.spent_at) = $2::date
     GROUP BY c.id, c.name, c.color
     ORDER BY total DESC`,
    [req.userId, monthStart]
  );
  const totalResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
     WHERE user_id = $1 AND date_trunc('month', spent_at) = $2::date`,
    [req.userId, monthStart]
  );
  res.json({ byCategory: result.rows, monthTotal: totalResult.rows[0].total });
});

expensesRouter.post('/', async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid expense data' });
  }
  const { amount, description, categoryId, spentAt } = parsed.data;

  const result = await pool.query(
    `INSERT INTO expenses (user_id, category_id, amount, description, spent_at)
     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE))
     RETURNING id, amount, description, spent_at AS "spentAt", category_id AS "categoryId"`,
    [req.userId, categoryId ?? null, amount, description ?? null, spentAt ?? null]
  );
  res.status(201).json(result.rows[0]);
});

expensesRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid expense id' });
  }
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid expense data' });
  }
  const { amount, description, categoryId, spentAt } = parsed.data;

  const result = await pool.query(
    `UPDATE expenses SET amount = $1, description = $2, category_id = $3, spent_at = COALESCE($4, spent_at)
     WHERE id = $5 AND user_id = $6
     RETURNING id, amount, description, spent_at AS "spentAt", category_id AS "categoryId"`,
    [amount, description ?? null, categoryId ?? null, spentAt ?? null, id, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  res.json(result.rows[0]);
});

expensesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid expense id' });
  }
  const result = await pool.query(
    'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  res.status(204).end();
});
