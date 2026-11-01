import { router } from 'expo-router';

import type { MediaItem } from '@/lib/media';

/**
 * The list the photo viewer / video player swipes through. Kept in memory rather than in route
 * params because it can hold thousands of items.
 */
let viewerList: MediaItem[] = [];
/** Items waiting to be placed into an album by the "Add to album" sheet. */
let pendingAlbumItems: MediaItem[] = [];

export function getViewerList() {
  return viewerList;
}

export function openMedia(list: MediaItem[], index: number) {
  const item = list[index];
  if (!item) return;
  if (item.kind === 'video') {
    viewerList = list.filter((i) => i.kind === 'video');
    router.push({ pathname: '/player', params: { id: item.id } });
  } else {
    viewerList = list;
    router.push({ pathname: '/viewer', params: { id: item.id } });
  }
}

export function openAddToAlbum(items: MediaItem[]) {
  pendingAlbumItems = items;
  router.push('/add-to-album');
}

export function takePendingAlbumItems() {
  return pendingAlbumItems;
}
