import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { MediaItem } from '@/lib/media';

/**
 * App-owned data persisted to AsyncStorage. Device folders come straight from the media library;
 * everything the user curates inside this app (favorites, custom albums, playback progress) lives here.
 *
 * Stored JSON shape (key `gallery-state-v1`):
 * {
 *   favorites: { [assetId]: MediaItem & { addedAt: number } },
 *   albums: [{ id: 'a_1726900000000', name: 'Trip', createdAt: 1726900000000, items: MediaItem[] }],
 *   positions: { [assetId]: { item: MediaItem, position: secondsWatched, updatedAt: number } },
 *   seededFavorites: boolean
 * }
 */
export type FavoriteItem = MediaItem & { addedAt: number };

export type PlaybackPosition = { item: MediaItem; position: number; updatedAt: number };

export type CustomAlbum = {
  id: string;
  name: string;
  createdAt: number;
  items: MediaItem[];
};

type PersistedState = {
  favorites: Record<string, FavoriteItem>;
  albums: CustomAlbum[];
  positions: Record<string, PlaybackPosition>;
  seededFavorites: boolean;
};

type State = PersistedState & {
  hydrated: boolean;
  /** Bumped whenever the device library changes so lists know to reload. */
  libraryVersion: number;
};

const STORAGE_KEY = 'gallery-state-v1';

let state: State = {
  favorites: {},
  albums: [],
  positions: {},
  seededFavorites: false,
  hydrated: false,
  libraryVersion: 0,
};
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | undefined;

function setState(patch: Partial<State>, persist = true) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
  if (persist && state.hydrated) {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const { favorites, albums, positions, seededFavorites } = state;
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ favorites, albums, positions, seededFavorites })
      ).catch((error) => console.warn('Failed to save gallery state', error));
    }, 300);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState() {
  return state;
}

export function useGalleryStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export async function hydrate() {
  if (state.hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<PersistedState>) : {};
    setState(
      {
        favorites: saved.favorites ?? {},
        albums: saved.albums ?? [],
        positions: saved.positions ?? {},
        seededFavorites: saved.seededFavorites ?? false,
        hydrated: true,
      },
      false
    );
  } catch (error) {
    console.warn('Failed to load gallery state', error);
    setState({ hydrated: true }, false);
  }
}

export function bumpLibraryVersion() {
  setState({ libraryVersion: state.libraryVersion + 1 }, false);
}

// ---- Favorites ----

/** Imports favorites the user already marked in the system gallery, once. */
export function seedFavorites(items: MediaItem[]) {
  const favorites = { ...state.favorites };
  const now = Date.now();
  for (const item of items) favorites[item.id] ??= { ...item, addedAt: now };
  setState({ favorites, seededFavorites: true });
}

export function toggleFavorite(item: MediaItem) {
  const favorites = { ...state.favorites };
  if (favorites[item.id]) delete favorites[item.id];
  else favorites[item.id] = { ...item, addedAt: Date.now() };
  setState({ favorites });
}

// ---- Custom albums ----

export function createAlbum(name: string, items: MediaItem[] = []): CustomAlbum {
  const album: CustomAlbum = {
    id: `a_${Date.now()}`,
    name: name.trim() || 'Untitled album',
    createdAt: Date.now(),
    items: dedupe(items),
  };
  setState({ albums: [album, ...state.albums] });
  return album;
}

export function renameAlbum(id: string, name: string) {
  setState({
    albums: state.albums.map((a) => (a.id === id ? { ...a, name: name.trim() || a.name } : a)),
  });
}

export function deleteAlbum(id: string) {
  setState({ albums: state.albums.filter((a) => a.id !== id) });
}

export function addToAlbum(id: string, items: MediaItem[]) {
  setState({
    albums: state.albums.map((a) =>
      a.id === id ? { ...a, items: dedupe([...items, ...a.items]) } : a
    ),
  });
}

export function removeFromAlbum(id: string, itemIds: string[]) {
  const remove = new Set(itemIds);
  setState({
    albums: state.albums.map((a) =>
      a.id === id ? { ...a, items: a.items.filter((item) => !remove.has(item.id)) } : a
    ),
  });
}

/** Drops deleted assets from everything the app keeps track of. */
export function forgetMedia(ids: string[]) {
  const remove = new Set(ids);
  const favorites = { ...state.favorites };
  const positions = { ...state.positions };
  for (const id of ids) {
    delete favorites[id];
    delete positions[id];
  }
  setState({
    favorites,
    positions,
    albums: state.albums.map((a) => ({ ...a, items: a.items.filter((i) => !remove.has(i.id)) })),
    libraryVersion: state.libraryVersion + 1,
  });
}

// ---- Video resume positions ----

export function savePosition(item: MediaItem, seconds: number | null) {
  const positions = { ...state.positions };
  if (seconds === null) delete positions[item.id];
  else positions[item.id] = { item, position: seconds, updatedAt: Date.now() };
  setState({ positions });
}

function dedupe(items: MediaItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}
