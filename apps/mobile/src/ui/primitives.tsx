import { Pressable, StyleSheet, Text, type TextProps } from 'react-native';
import { useMobileTheme } from './theme';

export function AppText({ weight = 'regular', muted, style, ...props }: TextProps & { weight?: 'regular' | 'medium' | 'semibold'; muted?: boolean }) {
  const { colors, fontsReady } = useMobileTheme();
  const family = { regular: 'Geist', medium: 'GeistMedium', semibold: 'GeistSemibold' }[weight];
  return <Text {...props} style={[styles.text, { color: muted ? colors.muted : colors.text, fontFamily: fontsReady ? family : undefined, fontWeight: fontsReady ? 'normal' : weight === 'semibold' ? '600' : weight === 'medium' ? '500' : '400' }, style]} />;
}

export function ActionButton({ title, onPress, disabled = false, variant = 'primary' }: {
  title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
}) {
  const { colors } = useMobileTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, {
        backgroundColor: disabled ? colors.subtle : variant === 'primary' ? colors.primary : 'transparent',
        borderColor: disabled || variant === 'secondary' ? colors.border : 'transparent',
        opacity: pressed ? 0.75 : 1,
      }]}>
      <AppText weight="medium" style={{ textAlign: 'center', color: disabled ? colors.muted : variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.negative : colors.text }}>{title}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
});
