import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';

export default function RemoveAdsScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="construct-outline" size={48} color={Colors.primary} />
      <Text style={styles.title}>Coming Soon</Text>
      <Text style={styles.subtitle}>
        A monthly subscription to remove ads will be available here soon.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
