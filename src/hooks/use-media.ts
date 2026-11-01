import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchDeviceAlbums,
  fetchMediaPage,
  fetchSystemFavorites,
  type DeviceAlbum,
  type MediaFilter,
  type MediaItem,
} from '@/lib/media';
import { library, libraryKind } from '@/lib/media-library';
import { bumpLibraryVersion, getState, seedFavorites, useGalleryStore } from '@/lib/store';

export const isMediaLibrarySupported = libraryKind !== 'none';

export function useMediaPermission() {
  const [permission, requestPermission] = library.usePermissions();
  return {
    permission,
    granted: permission?.granted ?? false,
    limited: permission?.accessPrivileges === 'limited',
    requestPermission,
  };
}

/** Keeps lists fresh when photos are added/removed outside the app, and imports system favorites once. */
export function useLibrarySync(granted: boolean) {
  const hydrated = useGalleryStore((s) => s.hydrated);

  useEffect(() => {
    if (!granted || !isMediaLibrarySupported) return;
    const subscription = library.addListener(() => bumpLibraryVersion());
    return () => subscription.remove();
  }, [granted]);

  useEffect(() => {
    if (!granted || !hydrated || getState().seededFavorites) return;
    fetchSystemFavorites()
      .then(seedFavorites)
      .catch(() => seedFavorites([]));
  }, [granted, hydrated]);
}

/** Paginated, newest-first list of photos and/or videos, optionally limited to a device folder. */
export function useMediaList(filter: MediaFilter, albumId?: string, enabled = true) {
  const libraryVersion = useGalleryStore((s) => s.libraryVersion);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const loadingMore = useRef(false);
  const cursor = useRef<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const page = await fetchMediaPage(filter, albumId, null);
      if (id !== requestId.current) return;
      cursor.current = page.cursor;
      setItems(page.items);
      setDone(page.cursor === null);
      setError(null);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filter, albumId]);

  useEffect(() => {
    if (!enabled) return;
    loadFirstPage();
  }, [enabled, loadFirstPage, libraryVersion]);

  const loadMore = useCallback(async () => {
    if (done || loadingMore.current || loading) return;
    loadingMore.current = true;
    const id = requestId.current;
    try {
      const page = await fetchMediaPage(filter, albumId, cursor.current);
      if (id !== requestId.current) return;
      cursor.current = page.cursor;
      setItems((prev) => [...prev, ...page.items]);
      setDone(page.cursor === null);
    } catch {
      // Keep what we have; the next scroll will retry.
    } finally {
      loadingMore.current = false;
    }
  }, [done, loading, filter, albumId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadFirstPage();
  }, [loadFirstPage]);

  return { items, loading, refreshing, done, error, loadMore, refresh };
}

export function useDeviceAlbums(enabled = true) {
  const libraryVersion = useGalleryStore((s) => s.libraryVersion);
  const [albums, setAlbums] = useState<DeviceAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setAlbums(await fetchDeviceAlbums());
    } catch (error) {
      console.warn('Failed to load device albums', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load, libraryVersion]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return { albums, loading, refreshing, refresh };
}
