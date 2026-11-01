import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Space to leave at the bottom of tab screens so content clears the tab bar. */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return BottomTabInset + (Platform.OS === 'ios' ? insets.bottom : 0);
}

export function ScreenHeader({
  title,
  subtitle,
  left,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.row}>
        {left}
        <View style={styles.titles}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {right ? <View style={styles.actions}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

export function HeaderButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon?: IconName;
  label?: string;
  onPress: () => void;
  color?: string;
}) {
  const theme = useTheme();
  const tint = color ?? theme.tint;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label ?? icon}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement },
        pressed && { opacity: 0.6 },
      ]}>
      {icon ? <Icon name={icon} size={18} color={tint} /> : null}
      {label ? (
        <ThemedText type="smallBold" style={{ color: tint }}>
          {label}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  titles: { flex: 1 },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two + 2,
    borderRadius: 18,
  },
});
