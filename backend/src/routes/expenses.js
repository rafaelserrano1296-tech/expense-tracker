import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import { materializeRecurringExpenses } from '../lib/recurrence.js';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

const recurrenceSchema = z.object({
  type: z.enum(['fixed', 'installment']),
  totalInstallments: z.number().int().min(1).max(600).optional(),
}).refine((r) => r.type !== 'installment' || typeof r.totalInstallments === 'number', {
  message: 'totalInstallments is required for installment recurrence',
});

const expenseSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  description: z.string().trim().max(200).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recurrence: recurrenceSchema.optional(),
});

const dateQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// When `from`/`to` bound a single calendar month, materialize that month's
// recurring expenses before reading, so fixed/installment expenses show up
// without needing a background job.
async function materializeIfSingleMonth(userId, from, to) {
  if (!from || !to) return;
  const fromDate = new Date(from);
  const [year, month] = [fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1];
  const expectedTo = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  if (to === expectedTo) {
    await materializeRecurringExpenses(userId, year, month);
  }
}

expensesRouter.get('/', asyncHandler(async (req, res) => {
  const parsedQuery = dateQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: 'Invalid date range' });
  }
  const { from, to } = parsedQuery.data;
  await materializeIfSingleMonth(req.userId, from, to);

  const conditions = ['e.user_id = $1'];
  const params = [req.userId];

  if (from) {
    params.push(from);
    conditions.push(`e.spent_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`e.spent_at <= $${params.length}`);
  }

  const result = await pool.query(
    `SELECT e.id, e.amount, e.description, e.spent_at AS "spentAt", e.category_id AS "categoryId",
            c.name AS "categoryName", c.color AS "categoryColor",
            e.recurring_expense_id AS "recurringExpenseId", e.installment_number AS "installmentNumber",
            r.recurrence_type AS "recurrenceType", r.total_installments AS "totalInstallments"
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN recurring_expenses r ON r.id = e.recurring_expense_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.spent_at DESC, e.id DESC`,
    params
  );
  res.json(result.rows);
}));

const summaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

expensesRouter.get('/summary', asyncHandler(async (req, res) => {
  const parsed = summaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'year and month query params are required' });
  }
  const { year, month } = parsed.data;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

  await materializeRecurringExpenses(req.userId, year, month);

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
}));

expensesRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid expense data' });
  }
  const { amount, description, categoryId, spentAt, recurrence } = parsed.data;

  if (categoryId != null && !(await categoryBelongsToUser(categoryId, req.userId))) {
    return res.status(400).json({ error: 'Category not found' });
  }

  if (recurrence) {
    const referenceDate = spentAt ? new Date(spentAt) : new Date();
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth() + 1;
    const dayOfMonth = spentAt ? Number(spentAt.slice(8, 10)) : new Date().getDate();

    const recurringResult = await pool.query(
      `INSERT INTO recurring_expenses
         (user_id, description, amount, recurrence_type, day_of_month, start_year, start_month, total_installments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        req.userId,
        description ?? null,
        amount,
        recurrence.type,
        dayOfMonth,
        year,
        month,
        recurrence.type === 'installment' ? recurrence.totalInstallments : null,
      ]
    );
    const recurringExpenseId = recurringResult.rows[0].id;

    await materializeRecurringExpenses(req.userId, year, month);

    const firstOccurrence = await pool.query(
      `SELECT id, amount, description, spent_at AS "spentAt", category_id AS "categoryId"
       FROM expenses WHERE recurring_expense_id = $1 AND installment_number = 1`,
      [recurringExpenseId]
    );

    if (categoryId != null && firstOccurrence.rows[0]) {
      await pool.query('UPDATE expenses SET category_id = $1 WHERE id = $2', [categoryId, firstOccurrence.rows[0].id]);
    }

    return res.status(201).json({ ...firstOccurrence.rows[0], categoryId: categoryId ?? null, recurringExpenseId });
  }

  const result = await pool.query(
    `INSERT INTO expenses (user_id, category_id, amount, description, spent_at)
     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE))
     RETURNING id, amount, description, spent_at AS "spentAt", category_id AS "categoryId"`,
    [req.userId, categoryId ?? null, amount, description ?? null, spentAt ?? null]
  );
  res.status(201).json(result.rows[0]);
}));

expensesRouter.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid expense id' });
  }
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid expense data' });
  }
  const { amount, description, categoryId, spentAt } = parsed.data;

  if (categoryId != null && !(await categoryBelongsToUser(categoryId, req.userId))) {
    return res.status(400).json({ error: 'Category not found' });
  }

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
}));

expensesRouter.delete('/recurring/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid recurring expense id' });
  }
  const result = await pool.query(
    'UPDATE recurring_expenses SET is_active = FALSE WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Recurring expense not found' });
  }
  // Remove any already-generated occurrences that are still in the future.
  await pool.query(
    `DELETE FROM expenses WHERE recurring_expense_id = $1 AND spent_at > CURRENT_DATE`,
    [id]
  );
  res.status(204).end();
}));

expensesRouter.delete('/:id', asyncHandler(async (req, res) => {
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
}));

async function categoryBelongsToUser(categoryId, userId) {
  const result = await pool.query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId]);
  return result.rows.length > 0;
}
