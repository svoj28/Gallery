import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { NameDialog } from '@/components/name-dialog';
import { HeaderButton, ScreenHeader, useTabBarInset } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDeviceAlbums } from '@/hooks/use-media';
import { useTheme } from '@/hooks/use-theme';
import { countLabel, type MediaItem } from '@/lib/media';
import { createAlbum, useGalleryStore } from '@/lib/store';

export default function AlbumsScreen() {
  const theme = useTheme();
  const bottomInset = useTabBarInset();
  const { width } = useWindowDimensions();
  const customAlbums = useGalleryStore((s) => s.albums);
  const { albums: deviceAlbums, loading, refreshing, refresh } = useDeviceAlbums();
  const [creating, setCreating] = useState(false);

  const columns = width < 500 ? 2 : Math.floor(width / 220);
  const cardWidth = (width - Spacing.three * 2 - Spacing.three * (columns - 1)) / columns;

  const openAlbum = (id: string, kind: 'custom' | 'device', title: string) =>
    router.push({ pathname: '/album/[id]', params: { id, kind, title } });

  return (
    <ThemedView style={styles.flex}>
      <ScreenHeader
        title="Albums"
        right={<HeaderButton icon="add" label="New" onPress={() => setCreating(true)} />}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + Spacing.four }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <SectionTitle title="My albums" />
        <View style={styles.grid}>
          {customAlbums.map((album) => {
            const videos = album.items.filter((i) => i.kind === 'video').length;
            return (
              <AlbumCard
                key={album.id}
                width={cardWidth}
                title={album.name}
                subtitle={countLabel(album.items.length - videos, videos)}
                cover={album.items[0]}
                placeholderIcon="album"
                onPress={() => openAlbum(album.id, 'custom', album.name)}
              />
            );
          })}
          <Pressable
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            accessibilityLabel="Create album"
            style={({ pressed }) => [{ width: cardWidth }, pressed && styles.pressed]}>
            <View
              style={[
                styles.cover,
                styles.newAlbum,
                { width: cardWidth, height: cardWidth, borderColor: theme.backgroundSelected },
              ]}>
              <Icon name="add" size={32} color={theme.tint} />
            </View>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              New album
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Pick photos & videos
            </ThemedText>
          </Pressable>
        </View>

        <SectionTitle title="On this device" hint="Created automatically from your folders" />
        {loading ? (
          <ActivityIndicator style={styles.loader} color={theme.textSecondary} />
        ) : deviceAlbums.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No folders with photos or videos found.
          </ThemedText>
        ) : (
          <View style={styles.grid}>
            {deviceAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                width={cardWidth}
                title={album.title}
                subtitle={countLabel(album.photoCount, album.videoCount)}
                cover={album.cover ?? undefined}
                placeholderIcon="folder"
                onPress={() => openAlbum(album.id, 'device', album.title)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <NameDialog
        visible={creating}
        title="New album"
        confirmLabel="Create"
        onCancel={() => setCreating(false)}
        onSubmit={(name) => {
          setCreating(false);
          const album = createAlbum(name);
          openAlbum(album.id, 'custom', album.name);
          router.push({ pathname: '/pick-media', params: { albumId: album.id } });
        }}
      />
    </ThemedView>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText style={styles.sectionText}>{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

function AlbumCard({
  width,
  title,
  subtitle,
  cover,
  placeholderIcon,
  onPress,
}: {
  width: number;
  title: string;
  subtitle: string;
  cover?: MediaItem;
  placeholderIcon: IconName;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <View
        style={[
          styles.cover,
          { width, height: width, backgroundColor: theme.backgroundElement },
        ]}>
        {cover ? (
          <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Icon name={placeholderIcon} size={36} color={theme.textSecondary} />
        )}
      </View>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.cardTitle}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {subtitle}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  sectionTitle: { marginTop: Spacing.two },
  sectionText: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  cover: {
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newAlbum: { borderWidth: 2, borderStyle: 'dashed' },
  cardTitle: { marginTop: Spacing.two },
  pressed: { opacity: 0.7 },
  loader: { marginTop: Spacing.four },
});
