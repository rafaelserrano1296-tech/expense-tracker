import * as SecureStore from 'expo-secure-store';

// Point this at your deployed backend before shipping a release build.
// For local dev on a physical device/emulator, replace localhost with your machine's LAN IP.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'auth_token';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? 'Something went wrong');
  }

  return data as T;
}

export type AuthResponse = { token: string; user: { id: number; email: string } };

export const api = {
  signup: (email: string, password: string) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  getCategories: () => request<Category[]>('/categories'),

  createCategory: (name: string, color?: string) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify({ name, color }) }),

  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),

  getExpenses: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request<Expense[]>(`/expenses${qs ? `?${qs}` : ''}`);
  },

  createExpense: (input: ExpenseInput) =>
    request<Expense>('/expenses', { method: 'POST', body: JSON.stringify(input) }),

  updateExpense: (id: number, input: ExpenseInput) =>
    request<Expense>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  patchExpense: (id: number, input: { spentAt?: string; isPaid?: boolean }) =>
    request<Expense>(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  deleteExpense: (id: number) => request<void>(`/expenses/${id}`, { method: 'DELETE' }),

  cancelRecurringExpense: (id: number) => request<void>(`/expenses/recurring/${id}`, { method: 'DELETE' }),

  getBalance: (year: number, month: number) =>
    request<{ startingBalance: string }>(`/balance?year=${year}&month=${month}`),

  setBalance: (year: number, month: number, startingBalance: number) =>
    request<{ startingBalance: string }>('/balance', {
      method: 'PUT',
      body: JSON.stringify({ year, month, startingBalance }),
    }),

  getSummary: (year: number, month: number) =>
    request<Summary>(`/expenses/summary?year=${year}&month=${month}`),
};

export type Summary = {
  byCategory: { categoryId: number | null; categoryName: string | null; categoryColor: string | null; total: string }[];
  monthTotal: string;
};

export type Category = { id: number; name: string; color: string };

export type Expense = {
  id: number;
  amount: string;
  description: string | null;
  spentAt: string;
  categoryId: number | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  recurringExpenseId?: number | null;
  installmentNumber?: number | null;
  recurrenceType?: 'fixed' | 'installment' | null;
  totalInstallments?: number | null;
  isPaid: boolean;
};

export type RecurrenceInput =
  | { type: 'fixed' }
  | { type: 'installment'; totalInstallments: number };

export type ExpenseInput = {
  amount: number;
  description?: string;
  categoryId?: number | null;
  spentAt?: string;
  recurrence?: RecurrenceInput;
};
