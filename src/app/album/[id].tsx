import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaBrowser } from '@/components/media-browser';
import { NameDialog } from '@/components/name-dialog';
import { HeaderButton } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMediaList } from '@/hooks/use-media';
import { useTheme } from '@/hooks/use-theme';
import { countLabel, type MediaFilter } from '@/lib/media';
import { deleteAlbum, removeFromAlbum, renameAlbum, useGalleryStore } from '@/lib/store';

const FILTERS: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
];

export default function AlbumScreen() {
  const params = useLocalSearchParams<{ id: string; kind: 'custom' | 'device'; title?: string }>();
  const isCustom = params.kind === 'custom';
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [renaming, setRenaming] = useState(false);

  const customAlbum = useGalleryStore((s) => s.albums.find((a) => a.id === params.id));
  const device = useMediaList(filter, params.id, !isCustom);

  // Leave the screen if this custom album was deleted.
  const missing = isCustom && !customAlbum;
  useEffect(() => {
    if (missing && router.canGoBack()) router.back();
  }, [missing]);

  const title = customAlbum?.name ?? params.title ?? 'Album';
  const customItems = customAlbum?.items ?? [];
  const items = isCustom
    ? filter === 'all'
      ? customItems
      : customItems.filter((i) => i.kind === filter)
    : device.items;

  let subtitle: string | undefined;
  if (isCustom) {
    const videos = customItems.filter((i) => i.kind === 'video').length;
    subtitle = countLabel(customItems.length - videos, videos);
  } else if (!device.loading) {
    subtitle = `${device.items.length}${device.done ? '' : '+'} items · Device folder`;
  }

  const addMedia = () => router.push({ pathname: '/pick-media', params: { albumId: params.id } });

  const showAlbumMenu = () =>
    Alert.alert(title, undefined, [
      { text: 'Rename', onPress: () => setRenaming(true) },
      {
        text: 'Delete album',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Delete “${title}”?`,
            'The album is removed, but its photos and videos stay on your device.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteAlbum(params.id) },
            ]
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <>
      <MediaBrowser
        title={title}
        subtitle={subtitle}
        items={items}
        loading={isCustom ? false : device.loading}
        refreshing={isCustom ? false : device.refreshing}
        onRefresh={isCustom ? undefined : device.refresh}
        onEndReached={isCustom ? undefined : device.loadMore}
        headerLeft={<HeaderButton icon="back" onPress={() => router.back()} />}
        headerRight={
          isCustom ? (
            <>
              <HeaderButton icon="add" onPress={addMedia} />
              <HeaderButton icon="more" onPress={showAlbumMenu} />
            </>
          ) : null
        }
        headerChildren={<Segmented options={FILTERS} value={filter} onChange={setFilter} />}
        bottomInset={insets.bottom}
        removeAction={
          isCustom
            ? {
                label: 'Remove',
                run: (selected) => removeFromAlbum(params.id, selected.map((i) => i.id)),
              }
            : undefined
        }
        emptyTitle={isCustom && customItems.length === 0 ? 'This album is empty' : 'Nothing to show'}
        emptyMessage={
          isCustom && customItems.length === 0
            ? 'Add photos and videos to start filling it up.'
            : filter === 'video'
              ? 'There are no videos in this album.'
              : filter === 'image'
                ? 'There are no photos in this album.'
                : undefined
        }
      />

      {isCustom && customItems.length === 0 ? (
        <View style={[styles.emptyAction, { bottom: insets.bottom + Spacing.five }]}>
          <Pressable
            onPress={addMedia}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: theme.tint },
              pressed && { opacity: 0.8 },
            ]}>
            <ThemedText style={styles.addButtonText}>Add photos & videos</ThemedText>
          </Pressable>
        </View>
      ) : null}

      <NameDialog
        visible={renaming}
        title="Rename album"
        initialValue={title}
        onCancel={() => setRenaming(false)}
        onSubmit={(name) => {
          renameAlbum(params.id, name);
          setRenaming(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  emptyAction: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  addButton: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three - 4,
    borderRadius: 24,
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
});
