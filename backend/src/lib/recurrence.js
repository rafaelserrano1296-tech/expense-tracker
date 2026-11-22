import { pool } from '../db/pool.js';

function monthsBetween(startYear, startMonth, year, month) {
  return (year - startYear) * 12 + (month - startMonth);
}

function lastDayOf(year, month) {
  return new Date(year, month, 0).getDate();
}

// Ensures every active recurring expense for this user has its occurrence
// materialized as a row in `expenses` for the given year/month, if that
// month falls within the recurrence's active range.
export async function materializeRecurringExpenses(userId, year, month) {
  const { rows: recurrences } = await pool.query(
    `SELECT id, description, amount, recurrence_type AS "recurrenceType", day_of_month AS "dayOfMonth",
            start_year AS "startYear", start_month AS "startMonth", total_installments AS "totalInstallments"
     FROM recurring_expenses
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  for (const recurrence of recurrences) {
    const offset = monthsBetween(recurrence.startYear, recurrence.startMonth, year, month);
    if (offset < 0) continue;
    if (recurrence.recurrenceType === 'installment' && offset >= recurrence.totalInstallments) continue;

    const installmentNumber = offset + 1;
    const day = Math.min(recurrence.dayOfMonth, lastDayOf(year, month));
    const spentAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    await pool.query(
      `INSERT INTO expenses (user_id, recurring_expense_id, installment_number, amount, description, spent_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (recurring_expense_id, installment_number) DO NOTHING`,
      [userId, recurrence.id, installmentNumber, recurrence.amount, recurrence.description, spentAt]
    );
  }
}
