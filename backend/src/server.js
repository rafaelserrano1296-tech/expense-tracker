import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { categoriesRouter } from './routes/categories.js';
import { expensesRouter } from './routes/expenses.js';
import { balanceRouter } from './routes/balance.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/categories', categoriesRouter);
app.use('/expenses', expensesRouter);
app.use('/balance', balanceRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Record already exists' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on port ${port}`));
