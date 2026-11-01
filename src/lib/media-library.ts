/* eslint-disable @typescript-eslint/no-require-imports */
import { requireOptionalNativeModule } from 'expo';
import type * as NextLibrary from 'expo-media-library';
import type { PermissionResponse } from 'expo-media-library';
import type * as LegacyLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';

import type { MediaFilter, MediaItem } from '@/lib/media';

/**
 * expo-media-library ships two native modules: the new class-based API (`ExpoMediaLibraryNext`)
 * and the legacy API (`ExpoMediaLibrary`). Which ones exist depends on the binary the app runs in:
 * a development build has both, Expo Go may only have the legacy one, and web has neither.
 * Importing a missing module throws, so the implementation is picked at runtime and loaded lazily.
 */
export type LibraryKind = 'next' | 'legacy' | 'none';

export type MediaPage = { items: MediaItem[]; cursor: string | null };

export type FolderSummary = {
  id: string;
  title: string;
  photoCount: number;
  videoCount: number;
  cover: MediaItem | null;
};

export type MediaDetails = {
  filename: string | null;
  width: number | null;
  height: number | null;
  creationTime: number | null;
  location: { latitude: number; longitude: number } | null;
  albums: string[];
};

type Library = {
  usePermissions: () => [
    PermissionResponse | null,
    () => Promise<PermissionResponse>,
    ...(() => Promise<PermissionResponse>)[],
  ];
  addListener: (listener: () => void) => { remove: () => void };
  presentPermissionsPicker: () => Promise<void>;
  fetchPage: (filter: MediaFilter, albumId: string | undefined, cursor: string | null) => Promise<MediaPage>;
  fetchFavorites: () => Promise<MediaItem[]>;
  fetchFolders: () => Promise<FolderSummary[]>;
  getFileUri: (item: MediaItem) => Promise<string>;
  deleteAssets: (items: MediaItem[]) => Promise<void>;
  getDetails: (item: MediaItem) => Promise<MediaDetails>;
};

export const PAGE_SIZE = 150;
const GRANULAR: ('photo' | 'video')[] = ['photo', 'video'];

function detectKind(): LibraryKind {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'none';
  if (requireOptionalNativeModule('ExpoMediaLibraryNext')) return 'next';
  if (requireOptionalNativeModule('ExpoMediaLibrary')) return 'legacy';
  return 'none';
}

// ---- New class-based API (development builds) ----

function createNextLibrary(): Library {
  const ML = require('expo-media-library') as typeof NextLibrary;
  const { Album, Asset, AssetField, MediaType, Query } = ML;

  const toItem = (meta: NextLibrary.AssetMetadata): MediaItem => ({
    // The id is a content:// (Android) or ph:// (iOS) URI that images can load directly.
    id: meta.id,
    uri: meta.id,
    kind: meta.mediaType === MediaType.VIDEO ? 'video' : 'image',
    filename: meta.filename,
    width: meta.width,
    height: meta.height,
    duration: meta.duration,
    creationTime: meta.creationTime,
  });

  const query = (filter: MediaFilter, albumId?: string) => {
    let q = new Query();
    if (filter === 'image') q = q.eq(AssetField.MEDIA_TYPE, MediaType.IMAGE);
    else if (filter === 'video') q = q.eq(AssetField.MEDIA_TYPE, MediaType.VIDEO);
    else q = q.within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO]);
    if (albumId) q = q.album(new Album(albumId));
    return q.orderBy({ key: AssetField.CREATION_TIME, ascending: false });
  };

  return {
    usePermissions: () => ML.usePermissions({ granularPermissions: GRANULAR }),
    addListener: (listener) => ML.addListener(listener),
    presentPermissionsPicker: () => ML.presentPermissionsPicker(),

    async fetchPage(filter, albumId, cursor) {
      const offset = cursor ? Number(cursor) : 0;
      const metas = await query(filter, albumId).offset(offset).limit(PAGE_SIZE).exeForMetadata();
      return {
        items: metas.map(toItem),
        cursor: metas.length < PAGE_SIZE ? null : String(offset + metas.length),
      };
    },

    async fetchFavorites() {
      const metas = await new Query()
        .eq(AssetField.IS_FAVORITE, true)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .exeForMetadata();
      return metas
        .filter((m) => m.mediaType === MediaType.IMAGE || m.mediaType === MediaType.VIDEO)
        .map(toItem);
    },

    async fetchFolders() {
      const albums = await Album.getAll();
      const results = await Promise.all(
        albums.map(async (album): Promise<FolderSummary | null> => {
          try {
            const [title, metas] = await Promise.all([
              album.getTitle(),
              query('all', album.id).exeForMetadata(),
            ]);
            if (metas.length === 0) return null;
            const videoCount = metas.filter((m) => m.mediaType === MediaType.VIDEO).length;
            return {
              id: album.id,
              title,
              videoCount,
              photoCount: metas.length - videoCount,
              cover: toItem(metas[0]),
            };
          } catch {
            return null;
          }
        })
      );
      return results.filter((a): a is FolderSummary => a !== null);
    },

    getFileUri: (item) => new Asset(item.id).getUri(),

    deleteAssets: (items) => Asset.delete(items.map((i) => new Asset(i.id))),

    async getDetails(item) {
      const asset = new Asset(item.id);
      const info = await asset.getInfo();
      const location = await asset.getLocation().catch(() => null);
      const albums = await asset
        .getAlbums()
        .then((list) => Promise.all(list.map((a) => a.getTitle())))
        .catch(() => [] as string[]);
      return {
        filename: info.filename,
        width: info.width,
        height: info.height,
        creationTime: info.creationTime,
        location,
        albums,
      };
    },
  };
}

// ---- Legacy API (Expo Go) ----

function createLegacyLibrary(): Library {
  const ML = require('expo-media-library/legacy') as typeof LegacyLibrary;

  const toItem = (asset: LegacyLibrary.Asset): MediaItem => ({
    id: asset.id,
    uri: asset.uri,
    kind: asset.mediaType === 'video' ? 'video' : 'image',
    filename: asset.filename,
    width: asset.width,
    height: asset.height,
    // The legacy API reports seconds; the app works in milliseconds.
    duration: asset.mediaType === 'video' ? asset.duration * 1000 : null,
    creationTime: asset.creationTime || null,
  });

  const mediaType = (filter: MediaFilter): LegacyLibrary.MediaTypeValue[] =>
    filter === 'image' ? ['photo'] : filter === 'video' ? ['video'] : ['photo', 'video'];

  const page = (filter: MediaFilter, albumId: string | undefined, first: number, after?: string) =>
    ML.getAssetsAsync({
      first,
      after,
      album: albumId,
      mediaType: mediaType(filter),
      sortBy: [['creationTime', false]],
    });

  return {
    usePermissions: () => ML.usePermissions({ granularPermissions: GRANULAR }),
    addListener: (listener) => ML.addListener(listener),
    presentPermissionsPicker: () => ML.presentPermissionsPickerAsync(),

    async fetchPage(filter, albumId, cursor) {
      const result = await page(filter, albumId, PAGE_SIZE, cursor ?? undefined);
      return {
        items: result.assets.map(toItem),
        cursor: result.hasNextPage ? result.endCursor : null,
      };
    },

    // The legacy API can't filter by favorite, so there is nothing to import.
    fetchFavorites: async () => [],

    async fetchFolders() {
      const albums = await ML.getAlbumsAsync({ includeSmartAlbums: true });
      const results = await Promise.all(
        albums.map(async (album): Promise<FolderSummary | null> => {
          try {
            const [photos, videos, latest] = await Promise.all([
              page('image', album.id, 1),
              page('video', album.id, 1),
              page('all', album.id, 1),
            ]);
            if (photos.totalCount + videos.totalCount === 0) return null;
            return {
              id: album.id,
              title: album.title,
              photoCount: photos.totalCount,
              videoCount: videos.totalCount,
              cover: latest.assets[0] ? toItem(latest.assets[0]) : null,
            };
          } catch {
            return null;
          }
        })
      );
      return results.filter((a): a is FolderSummary => a !== null);
    },

    async getFileUri(item) {
      const info = await ML.getAssetInfoAsync(item.id);
      return info.localUri ?? info.uri;
    },

    async deleteAssets(items) {
      const deleted = await ML.deleteAssetsAsync(items.map((i) => i.id));
      if (!deleted) throw new Error('Delete was cancelled');
    },

    async getDetails(item) {
      const info = await ML.getAssetInfoAsync(item.id);
      return {
        filename: info.filename,
        width: info.width,
        height: info.height,
        creationTime: info.creationTime || null,
        location: info.location ?? null,
        albums: [],
      };
    },
  };
}

// ---- No media library (web, or a binary built without expo-media-library) ----

function createMissingLibrary(): Library {
  const unavailable = () => Promise.reject(new Error('The media library is not available here'));
  return {
    usePermissions: () => [null, unavailable],
    addListener: () => ({ remove() {} }),
    presentPermissionsPicker: unavailable,
    fetchPage: unavailable,
    fetchFavorites: unavailable,
    fetchFolders: unavailable,
    getFileUri: unavailable,
    deleteAssets: unavailable,
    getDetails: unavailable,
  };
}

export const libraryKind = detectKind();

export const library: Library =
  libraryKind === 'next'
    ? createNextLibrary()
    : libraryKind === 'legacy'
      ? createLegacyLibrary()
      : createMissingLibrary();
