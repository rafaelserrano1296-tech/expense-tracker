import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { api, ApiError, type Category } from '@/lib/api';
import { Colors } from '@/constants/theme';

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{ year: string; month: string }>();
  const year = Number(params.year);
  const month = Number(params.month);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  async function handleSave() {
    const numericAmount = Number(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const day = new Date().getDate();
      const daysInMonth = new Date(year, month, 0).getDate();
      const safeDay = Math.min(day, daysInMonth);
      const spentAt = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;

      await api.createExpense({
        amount: numericAmount,
        description: description.trim() || undefined,
        categoryId: selectedCategoryId,
        spentAt,
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

      <Text style={styles.label}>Category</Text>
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => {
          const isSelected = selectedCategoryId === item.id;
          return (
            <Pressable
              onPress={() => setSelectedCategoryId(isSelected ? null : item.id)}
              style={[
                styles.categoryChip,
                { borderColor: item.color },
                isSelected && { backgroundColor: item.color },
              ]}
            >
              <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyCategories}>No categories yet.</Text>}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSave} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Expense</Text>}
      </Pressable>
    </View>
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
  categoryList: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipText: {
    color: Colors.text,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  emptyCategories: {
    color: Colors.textSecondary,
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
