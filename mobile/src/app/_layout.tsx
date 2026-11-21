import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/lib/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen
          name="add-expense"
          options={{ presentation: 'modal', headerShown: true, title: 'Add Expense' }}
        />
        <Stack.Screen
          name="set-balance"
          options={{ presentation: 'modal', headerShown: true, title: 'Starting Balance' }}
        />
      </Stack>
    </AuthProvider>
  );
}
