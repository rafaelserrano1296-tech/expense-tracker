import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { api, ApiError, type RecurrenceInput } from '@/lib/api';
import { Colors } from '@/constants/theme';

type RepeatMode = 'none' | 'repeat';
type RepeatKind = 'fixed' | 'installment';

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{ year: string; month: string }>();
  const year = Number(params.year);
  const month = Number(params.month);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    const day = Math.min(now.getDate(), new Date(year, month, 0).getDate());
    return new Date(year, month - 1, day);
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [repeatKind, setRepeatKind] = useState<RepeatKind>('fixed');
  const [installments, setInstallments] = useState('12');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave() {
    const numericAmount = Number(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter a valid amount.');
      return;
    }

    let recurrence: RecurrenceInput | undefined;
    if (repeatMode === 'repeat') {
      if (repeatKind === 'installment') {
        const totalInstallments = Number(installments);
        if (!Number.isInteger(totalInstallments) || totalInstallments < 1) {
          setError('Enter a valid number of installments.');
          return;
        }
        recurrence = { type: 'installment', totalInstallments };
      } else {
        recurrence = { type: 'fixed' };
      }
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await api.createExpense({
        amount: numericAmount,
        description: description.trim() || undefined,
        spentAt: toDateString(date),
        recurrence,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        autoFocus
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Groceries"
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Date</Text>
      <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateText}>{formatDisplayDate(date)}</Text>
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.select({ ios: 'spinner', default: 'default' })}
          onChange={(_event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}

      <View style={styles.radioRow}>
        <RadioOption
          label="Don't repeat"
          selected={repeatMode === 'none'}
          onPress={() => setRepeatMode('none')}
        />
        <RadioOption
          label="Repeat"
          selected={repeatMode === 'repeat'}
          onPress={() => setRepeatMode('repeat')}
        />
      </View>

      {repeatMode === 'repeat' && (
        <>
          <View style={styles.radioRow}>
            <RadioOption
              label="Fixed"
              selected={repeatKind === 'fixed'}
              onPress={() => setRepeatKind('fixed')}
            />
            <RadioOption
              label="Installments"
              selected={repeatKind === 'installment'}
              onPress={() => setRepeatKind('installment')}
            />
          </View>

          {repeatKind === 'installment' && (
            <>
              <Text style={styles.label}>Number of installments</Text>
              <TextInput
                style={styles.input}
                placeholder="12"
                keyboardType="number-pad"
                value={installments}
                onChangeText={setInstallments}
              />
            </>
          )}
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSave} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Expense</Text>}
      </Pressable>
    </View>
  );
}

function RadioOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.radioOption} onPress={onPress}>
      <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    color: Colors.text,
  },
  radioRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 12,
    marginBottom: 4,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: Colors.danger,
    marginTop: 8,
  },
});
