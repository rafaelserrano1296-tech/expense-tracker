import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{user?.email}</Text>
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
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 20,
  },
});
