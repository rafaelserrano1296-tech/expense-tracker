import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/lib/auth-context';
import { api, type Expense } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { ExpenseActionModal } from '@/components/expense-action-modal';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysOverdue(expense: Expense): number {
  if (expense.isPaid) return 0;
  const spentDate = new Date(expense.spentAt.slice(0, 10) + 'T00:00:00');
  const diffMs = startOfToday().getTime() - spentDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatShortDate(spentAt: string) {
  const d = new Date(spentAt.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function HomeScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [startingBalance, setStartingBalance] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const loadData = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    try {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [expensesRes, balanceRes, summaryRes] = await Promise.all([
        api.getExpenses(from, to),
        api.getBalance(year, month),
        api.getSummary(year, month),
      ]);

      setExpenses(expensesRes);
      setStartingBalance(Number(balanceRes.startingBalance));
      setMonthTotal(Number(summaryRes.monthTotal));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthLoading && !user) {
        router.replace('/login');
        return;
      }
      if (user) {
        loadData(cursor.year, cursor.month);
      }
    }, [user, isAuthLoading, cursor, loadData])
  );

  function goToPreviousMonth() {
    setCursor((prev) => {
      const month = prev.month === 1 ? 12 : prev.month - 1;
      const year = prev.month === 1 ? prev.year - 1 : prev.year;
      return { year, month };
    });
  }

  function goToNextMonth() {
    setCursor((prev) => {
      const month = prev.month === 12 ? 1 : prev.month + 1;
      const year = prev.month === 12 ? prev.year + 1 : prev.year;
      return { year, month };
    });
  }

  const currentBalance = useMemo(() => startingBalance - monthTotal, [startingBalance, monthTotal]);
  const hasOverdue = useMemo(() => expenses.some((e) => daysOverdue(e) > 0), [expenses]);

  async function refresh() {
    await loadData(cursor.year, cursor.month);
  }

  async function handleMarkPaid(expense: Expense, isPaid: boolean) {
    await api.patchExpense(expense.id, { isPaid });
    await refresh();
  }

  async function handleChangeDate(expense: Expense, newDate: Date) {
    const spentAt = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    await api.patchExpense(expense.id, { spentAt });
    await refresh();
  }

  async function handleDelete(expense: Expense) {
    if (expense.recurringExpenseId) {
      await api.cancelRecurringExpense(expense.recurringExpenseId);
    } else {
      await api.deleteExpense(expense.id);
    }
    await refresh();
  }

  if (isAuthLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.push({ pathname: '/set-balance', params: { year: cursor.year, month: cursor.month, current: startingBalance } })}
            style={styles.balancePressable}
          >
            <Text style={styles.balanceLabel}>
              Starting Balance: {formatCurrency(startingBalance)}
            </Text>
          </Pressable>
          <View style={styles.headerIcons}>
            <Pressable hitSlop={10} style={styles.iconButton}>
              <Ionicons name="search" size={22} color="#fff" />
            </Pressable>
            <Pressable hitSlop={10} style={styles.iconButton}>
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.monthNav}>
          <Pressable hitSlop={10} onPress={goToPreviousMonth}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[cursor.month - 1]} / {cursor.year}
          </Text>
          <Pressable hitSlop={10} onPress={goToNextMonth}>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      {hasOverdue && (
        <View style={styles.overdueBanner}>
          <Text style={styles.overdueBannerText}>There are overdue expenses</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={expenses.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => {
            const overdueDays = daysOverdue(item);
            const isOverdue = overdueDays > 0;
            const isPaid = item.isPaid;
            const hasDarkBg = isPaid || isOverdue;
            return (
              <Pressable
                style={[
                  styles.expenseRow,
                  isOverdue && styles.expenseRowOverdue,
                  isPaid && styles.expenseRowPaid,
                ]}
                onPress={() => setSelectedExpense(item)}
              >
                <View style={styles.expenseInfo}>
                  <Text style={[styles.expenseDescription, hasDarkBg && styles.textOnDark]}>
                    {item.description || 'No description'}
                  </Text>
                  <Text style={[styles.expenseCategory, hasDarkBg && styles.textOnDarkMuted]}>
                    {formatShortDate(item.spentAt)}
                  </Text>
                  {item.recurrenceType && (
                    <Text style={[styles.expenseCategory, hasDarkBg && styles.textOnDarkMuted]}>
                      {item.recurrenceType === 'installment'
                        ? `Installment ${item.installmentNumber}/${item.totalInstallments}`
                        : 'Fixed, recurring'}
                    </Text>
                  )}
                </View>
                <View style={styles.expenseRight}>
                  <Text style={[styles.expenseAmount, hasDarkBg && styles.textOnDark]}>
                    {formatCurrency(Number(item.amount))}
                  </Text>
                  {isPaid ? (
                    <Text style={styles.paidText}>paid</Text>
                  ) : isOverdue ? (
                    <Text style={styles.overdueText}>{overdueDays}d overdue</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No expenses this month.</Text>}
        />
      )}

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total Spent</Text>
          <Text style={styles.footerLabel}>Current Balance</Text>
        </View>
        <View>
          <Text style={styles.footerValue}>{formatCurrency(monthTotal)}</Text>
          <Text style={styles.footerValue}>{formatCurrency(currentBalance)}</Text>
        </View>
      </View>

      <Pressable
        style={styles.fab}
        onPress={() => router.push({ pathname: '/add-expense', params: { year: cursor.year, month: cursor.month } })}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

      <ExpenseActionModal
        expense={selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onMarkPaid={handleMarkPaid}
        onChangeDate={handleChangeDate}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balancePressable: {
    flexShrink: 1,
  },
  balanceLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    padding: 2,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  monthLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    paddingVertical: 8,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  overdueBanner: {
    backgroundColor: '#FBD5D5',
    paddingVertical: 8,
    alignItems: 'center',
  },
  overdueBannerText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  expenseRowOverdue: {
    backgroundColor: Colors.danger,
  },
  expenseRowPaid: {
    backgroundColor: Colors.primary,
  },
  expenseInfo: {
    flexShrink: 1,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  overdueText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 2,
    fontWeight: '700',
  },
  paidText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 2,
    fontWeight: '700',
  },
  textOnDark: {
    color: '#fff',
  },
  textOnDarkMuted: {
    color: 'rgba(255,255,255,0.85)',
  },
  expenseDescription: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  expenseCategory: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  footerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 76,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
