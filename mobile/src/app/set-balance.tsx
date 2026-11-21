import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { api, ApiError } from '@/lib/api';
import { Colors } from '@/constants/theme';

export default function SetBalanceScreen() {
  const params = useLocalSearchParams<{ year: string; month: string; current: string }>();
  const year = Number(params.year);
  const month = Number(params.month);

  const [value, setValue] = useState(params.current ?? '0');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave() {
    const amount = Number(value.replace(',', '.'));
    if (Number.isNaN(amount)) {
      setError('Enter a valid number.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await api.setBalance(year, month, amount);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save balance.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Monthly income or starting balance</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={setValue}
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSave} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
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
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: Colors.text,
    marginBottom: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: Colors.danger,
    marginBottom: 10,
  },
});
