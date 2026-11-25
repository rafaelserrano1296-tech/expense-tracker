import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';

type Props = TextInputProps & { containerStyle?: StyleProp<ViewStyle> };

export function PasswordInput({ containerStyle, style, ...props }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <TextInput
        {...props}
        style={[style, styles.input]}
        secureTextEntry={!isVisible}
      />
      <Pressable
        style={styles.toggle}
        hitSlop={10}
        onPress={() => setIsVisible((v) => !v)}
      >
        <Ionicons name={isVisible ? 'eye-off' : 'eye'} size={20} color={Colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
  },
  input: {
    marginBottom: 0,
    paddingRight: 44,
  },
  toggle: {
    position: 'absolute',
    right: 14,
  },
});
