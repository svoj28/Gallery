import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaGrid } from '@/components/media-grid';
import { HeaderButton, ScreenHeader } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import { ThemedView } from '@/components/themed-view';
import { useMediaList } from '@/hooks/use-media';
import type { MediaFilter, MediaItem } from '@/lib/media';
import { addToAlbum, useGalleryStore } from '@/lib/store';

const FILTERS: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
];

/** Multi-select picker for adding library items to one of the user's own albums. */
export default function PickMediaScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const album = useGalleryStore((s) => s.albums.find((a) => a.id === albumId));
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<MediaFilter>('all');
  const { items, loading, loadMore } = useMediaList(filter);
  const [selected, setSelected] = useState<Map<string, MediaItem>>(new Map());

  const alreadyInAlbum = new Set(album?.items.map((i) => i.id));
  const visible = items.filter((i) => !alreadyInAlbum.has(i.id));

  const toggle = (item: MediaItem) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });

  const confirm = () => {
    if (album && selected.size) addToAlbum(album.id, [...selected.values()]);
    router.back();
  };

  return (
    <ThemedView style={styles.flex}>
      <ScreenHeader
        title={album ? `Add to ${album.name}` : 'Add to album'}
        subtitle={selected.size ? `${selected.size} selected` : 'Tap photos and videos to select'}
        right={
          <>
            <HeaderButton label="Cancel" onPress={() => router.back()} />
            <HeaderButton
              label={selected.size ? `Add ${selected.size}` : 'Add'}
              onPress={confirm}
            />
          </>
        }>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </ScreenHeader>
      <MediaGrid
        items={visible}
        loading={loading}
        onEndReached={loadMore}
        selectedIds={new Set(selected.keys())}
        onPressItem={(index) => toggle(visible[index])}
        emptyTitle="Nothing to add"
        emptyMessage="Everything here is already in this album."
        bottomInset={insets.bottom}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
