import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { library, type FolderSummary, type MediaPage } from '@/lib/media-library';

export { PAGE_SIZE } from '@/lib/media-library';

export type MediaKind = 'image' | 'video';
export type MediaFilter = 'all' | MediaKind;

/** A lightweight, serializable description of a photo or video in the device library. */
export type MediaItem = {
  /** Media library asset id. */
  id: string;
  /** URI that expo-image can display (content://, file:// or ph://). */
  uri: string;
  kind: MediaKind;
  filename: string | null;
  width: number | null;
  height: number | null;
  /** Duration in milliseconds (videos only). */
  duration: number | null;
  creationTime: number | null;
};

export type DeviceAlbum = FolderSummary & { count: number };

export function fetchMediaPage(
  filter: MediaFilter,
  albumId: string | undefined,
  cursor: string | null
): Promise<MediaPage> {
  return library.fetchPage(filter, albumId, cursor);
}

export function fetchSystemFavorites(): Promise<MediaItem[]> {
  return library.fetchFavorites();
}

/** Folders on the device (Camera, Screenshots, Downloads, WhatsApp Images, ...). */
export async function fetchDeviceAlbums(): Promise<DeviceAlbum[]> {
  const folders = await library.fetchFolders();
  return folders
    .map((f) => ({ ...f, count: f.photoCount + f.videoCount }))
    .sort((a, b) => b.count - a.count);
}

/** Resolves a local file URI for playing or sharing an asset. */
export function getPlayableUri(item: MediaItem): Promise<string> {
  return library.getFileUri(item);
}

export function deleteMedia(items: MediaItem[]): Promise<void> {
  return library.deleteAssets(items);
}

export function getMediaDetails(item: MediaItem) {
  return library.getDetails(item);
}

/**
 * Shares a photo or video. Library files live outside the app sandbox, so they are copied to the
 * cache directory first (expo-sharing only accepts local file:// URIs it can expose).
 */
export async function shareMedia(item: MediaItem): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const source = new File(await getPlayableUri(item));
  const name = item.filename ?? source.name ?? `shared-${Date.now()}`;
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  await source.copy(target);
  await Sharing.shareAsync(target.uri);
}

export function formatDuration(ms: number | null | undefined): string {
  const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`;
}

export function formatDate(timestamp: number | null | undefined, withTime = false): string {
  if (!timestamp) return 'Unknown date';
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

export function countLabel(photos: number, videos: number): string {
  const parts: string[] = [];
  if (photos) parts.push(`${photos} photo${photos === 1 ? '' : 's'}`);
  if (videos) parts.push(`${videos} video${videos === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'Empty';
}
