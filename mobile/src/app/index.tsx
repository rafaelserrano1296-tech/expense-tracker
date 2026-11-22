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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={expenses.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => (
            <View style={styles.expenseRow}>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDescription}>{item.description || 'No description'}</Text>
                {item.recurrenceType && (
                  <Text style={styles.expenseCategory}>
                    {item.recurrenceType === 'installment'
                      ? `Installment ${item.installmentNumber}/${item.totalInstallments}`
                      : 'Fixed, recurring'}
                  </Text>
                )}
              </View>
              <Text style={styles.expenseAmount}>{formatCurrency(Number(item.amount))}</Text>
            </View>
          )}
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
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  expenseInfo: {
    flexShrink: 1,
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
