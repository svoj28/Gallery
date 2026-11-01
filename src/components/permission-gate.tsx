import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isMediaLibrarySupported, useMediaPermission } from '@/hooks/use-media';
import { useTheme } from '@/hooks/use-theme';
import { library } from '@/lib/media-library';

/** Renders children only once the user has granted access to their photos and videos. */
export function PermissionGate({ children }: { children: ReactNode }) {
  const { permission, granted, requestPermission } = useMediaPermission();
  const theme = useTheme();

  if (!isMediaLibrarySupported) {
    return (
      <Message
        title={Platform.OS === 'web' ? 'Open Gallery on your phone' : 'Photo library unavailable'}
        body={
          Platform.OS === 'web'
            ? 'Your photo library is only available in the iOS and Android app.'
            : 'This build of the app doesn’t include photo library support. Rebuild it with “npx expo run:android” or “npx expo run:ios”.'
        }
      />
    );
  }

  if (!permission) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
      </ThemedView>
    );
  }

  if (!granted) {
    const blocked = !permission.canAskAgain;
    return (
      <Message
        title="See all your photos and videos"
        body="Gallery needs access to your library to show your photos, videos and folders. Nothing leaves your device."
        action={blocked ? 'Open Settings' : 'Allow access'}
        onAction={blocked ? () => Linking.openSettings() : requestPermission}
      />
    );
  }

  return children;
}

/** Shown when the user only shared some photos (iOS 14+/Android 14+). */
export function LimitedAccessBanner() {
  const { limited } = useMediaPermission();
  const theme = useTheme();
  if (!limited) return null;
  return (
    <Pressable
      onPress={() => library.presentPermissionsPicker().catch(() => Linking.openSettings())}
      style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
        You&apos;ve given access to only some photos.
      </ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.tint }}>
        Manage
      </ThemedText>
    </Pressable>
  );
}

function Message({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.center}>
      <View style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
        <Icon name="photo" size={36} color={theme.tint} />
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.body}>
        {body}
      </ThemedText>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.tint },
            pressed && { opacity: 0.8 },
          ]}>
          <ThemedText style={styles.buttonText}>{action}</ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.three,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 360 },
  button: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three - 4,
    borderRadius: 24,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three - 4,
    borderRadius: 12,
  },
});
