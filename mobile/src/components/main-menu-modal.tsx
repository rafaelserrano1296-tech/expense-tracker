import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function MainMenuModal({ visible, onClose }: Props) {
  const { logout } = useAuth();

  function go(pathname: '/profile' | '/change-password' | '/remove-ads') {
    onClose();
    router.push(pathname);
  }

  async function handleLogout() {
    onClose();
    await logout();
    router.replace('/login');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.actionRow} onPress={() => go('/profile')}>
            <Text style={styles.actionText}>View Profile</Text>
          </Pressable>

          <Pressable style={styles.actionRow} onPress={() => go('/change-password')}>
            <Text style={styles.actionText}>Change Password</Text>
          </Pressable>

          <Pressable style={styles.actionRow} onPress={() => go('/remove-ads')}>
            <Text style={styles.actionText}>Remove Ads</Text>
          </Pressable>

          <Pressable style={styles.actionRow} onPress={handleLogout}>
            <Text style={[styles.actionText, styles.logoutText]}>Log Out</Text>
          </Pressable>

          <Pressable style={styles.cancelRow} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
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
    paddingTop: 12,
    paddingBottom: 36,
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
  logoutText: {
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
});
