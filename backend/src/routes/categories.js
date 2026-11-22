import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

const categorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

categoriesRouter.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, color FROM categories WHERE user_id = $1 ORDER BY name',
    [req.userId]
  );
  res.json(result.rows);
}));

categoriesRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid category name or color' });
  }
  const { name, color } = parsed.data;

  try {
    const result = await pool.query(
      'INSERT INTO categories (user_id, name, color) VALUES ($1, $2, COALESCE($3, \'#6C5CE7\')) RETURNING id, name, color',
      [req.userId, name, color ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    throw err;
  }
}));

categoriesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid category id' });
  }
  const result = await pool.query(
    'DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }
  res.status(204).end();
}));
