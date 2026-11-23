import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Colors } from '@/constants/theme';
import { type Expense } from '@/lib/api';

type Props = {
  expense: Expense | null;
  onClose: () => void;
  onMarkPaid: (expense: Expense, isPaid: boolean) => Promise<void>;
  onChangeDate: (expense: Expense, newDate: Date) => Promise<void>;
  onDelete: (expense: Expense) => Promise<void>;
};

function toDate(spentAt: string) {
  return new Date(spentAt.slice(0, 10) + 'T00:00:00');
}

export function ExpenseActionModal({ expense, onClose, onMarkPaid, onChangeDate, onDelete }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (!expense) return null;

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
      onClose();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{expense.description || 'No description'}</Text>

          {isBusy ? (
            <ActivityIndicator color={Colors.primary} style={styles.busyIndicator} />
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

              <Pressable style={styles.actionRow} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.actionText}>Edit date</Text>
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={() => runAction(() => onDelete(expense))}
              >
                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
              </Pressable>

              <Pressable style={styles.cancelRow} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={toDate(expense.spentAt)}
              mode="date"
              display={Platform.select({ ios: 'spinner', default: 'default' })}
              onChange={(_event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  runAction(() => onChangeDate(expense, selectedDate));
                }
              }}
            />
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
