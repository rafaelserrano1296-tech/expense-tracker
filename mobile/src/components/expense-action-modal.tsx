import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { Colors } from '@/constants/theme';
import { type Expense } from '@/lib/api';

type Props = {
  expense: Expense | null;
  onClose: () => void;
  onMarkPaid: (expense: Expense, isPaid: boolean) => Promise<void>;
  onDeleteOne: (expense: Expense) => Promise<void>;
  onDeleteThisAndFuture: (expense: Expense) => Promise<void>;
  onDuplicateToNextMonth: (expense: Expense) => Promise<void>;
};

export function ExpenseActionModal({
  expense,
  onClose,
  onMarkPaid,
  onDeleteOne,
  onDeleteThisAndFuture,
  onDuplicateToNextMonth,
}: Props) {
  const [isBusy, setIsBusy] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  if (!expense) return null;

  const isRecurring = expense.recurringExpenseId != null;

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
      onClose();
    } finally {
      setIsBusy(false);
    }
  }

  function handleClose() {
    setShowDeleteOptions(false);
    onClose();
  }

  function handleEdit(current: Expense) {
    router.push({
      pathname: '/edit-expense',
      params: {
        id: current.id,
        amount: current.amount,
        description: current.description ?? '',
        spentAt: current.spentAt,
      },
    });
    handleClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{expense.description || 'No description'}</Text>

          {isBusy ? (
            <ActivityIndicator color={Colors.primary} style={styles.busyIndicator} />
          ) : showDeleteOptions ? (
            <>
              <Pressable
                style={styles.actionRow}
                onPress={() => runAction(() => onDeleteOne(expense))}
              >
                <Text style={[styles.actionText, styles.deleteText]}>Delete this one</Text>
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={() => runAction(() => onDeleteThisAndFuture(expense))}
              >
                <Text style={[styles.actionText, styles.deleteText]}>
                  Delete this and future
                </Text>
              </Pressable>

              <Pressable style={styles.cancelRow} onPress={() => setShowDeleteOptions(false)}>
                <Text style={styles.cancelText}>Back</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={styles.actionRow}
                onPress={() => runAction(() => onMarkPaid(expense, !expense.isPaid))}
              >
                <Text style={styles.actionText}>
                  {expense.isPaid ? 'Mark as not paid' : 'Mark as paid'}
                </Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={() => handleEdit(expense)}>
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={() => runAction(() => onDuplicateToNextMonth(expense))}
              >
                <Text style={styles.actionText}>Duplicate to next month</Text>
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  if (isRecurring) {
                    setShowDeleteOptions(true);
                  } else {
                    runAction(() => onDeleteOne(expense));
                  }
                }}
              >
                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
              </Pressable>

              <Pressable style={styles.cancelRow} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  actionRow: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionText: {
    fontSize: 16,
    color: Colors.text,
  },
  deleteText: {
    color: Colors.danger,
  },
  cancelRow: {
    paddingVertical: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  busyIndicator: {
    paddingVertical: 24,
  },
});
