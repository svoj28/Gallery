import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { MediaBrowser } from '@/components/media-browser';
import { useTabBarInset } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMediaList } from '@/hooks/use-media';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/media';
import { openMedia } from '@/lib/open-media';
import { useGalleryStore } from '@/lib/store';

export default function VideosScreen() {
  const { items, loading, refreshing, done, loadMore, refresh } = useMediaList('video');
  const bottomInset = useTabBarInset();

  return (
    <MediaBrowser
      title="Videos"
      subtitle={loading ? undefined : `${items.length}${done ? '' : '+'} videos`}
      items={items}
      loading={loading}
      refreshing={refreshing}
      onRefresh={refresh}
      onEndReached={loadMore}
      headerChildren={<ContinueWatching />}
      bottomInset={bottomInset}
      emptyTitle="No videos yet"
      emptyMessage="Videos you record or save on this device will show up here."
    />
  );
}

function ContinueWatching() {
  const theme = useTheme();
  const positions = useGalleryStore((s) => s.positions);
  const recent = Object.values(positions)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10);
  if (recent.length === 0) return null;
  const list = recent.map((p) => p.item);

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Continue watching
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {recent.map((entry, index) => {
          const durationSec = (entry.item.duration ?? 0) / 1000;
          const progress = durationSec > 0 ? Math.min(1, entry.position / durationSec) : 0;
          return (
            <Pressable
              key={entry.item.id}
              onPress={() => openMedia(list, index)}
              accessibilityRole="button"
              accessibilityLabel={`Resume ${entry.item.filename ?? 'video'}`}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
              <Image
                source={{ uri: entry.item.uri }}
                style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}
                contentFit="cover"
              />
              <View style={styles.playBadge}>
                <Icon name="play" size={14} color="#fff" />
              </View>
              <View style={styles.meta}>
                <ThemedText type="small" style={styles.remaining}>
                  {formatDuration((durationSec - entry.position) * 1000)} left
                </ThemedText>
              </View>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: theme.tint }]}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  row: { gap: Spacing.two },
  card: { width: 150, height: 90, borderRadius: 10, overflow: 'hidden' },
  thumb: { flex: 1 },
  playBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  meta: { position: 'absolute', right: 6, bottom: 8 },
  remaining: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 14,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 3,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  fill: { height: 3 },
});
