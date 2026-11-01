import { useState } from 'react';

import { MediaBrowser } from '@/components/media-browser';
import { useTabBarInset } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import type { MediaFilter } from '@/lib/media';
import { countLabel } from '@/lib/media';
import { useGalleryStore } from '@/lib/store';

const FILTERS: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
];

export default function FavoritesScreen() {
  const [filter, setFilter] = useState<MediaFilter>('all');
  const favorites = useGalleryStore((s) => s.favorites);
  const bottomInset = useTabBarInset();

  const all = Object.values(favorites).sort(
    (a, b) => (b.creationTime ?? b.addedAt) - (a.creationTime ?? a.addedAt)
  );
  const items = filter === 'all' ? all : all.filter((i) => i.kind === filter);
  const videoCount = all.filter((i) => i.kind === 'video').length;

  return (
    <MediaBrowser
      title="Favorites"
      subtitle={all.length ? countLabel(all.length - videoCount, videoCount) : undefined}
      items={items}
      headerChildren={all.length ? <Segmented options={FILTERS} value={filter} onChange={setFilter} /> : null}
      bottomInset={bottomInset}
      emptyTitle={filter === 'video' ? 'No favorite videos' : filter === 'image' ? 'No favorite photos' : 'No favorites yet'}
      emptyMessage="Tap the heart on any photo or video to add it here."
    />
  );
}
