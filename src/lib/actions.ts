import { Alert, Platform } from 'react-native';

import { deleteMedia, shareMedia, type MediaItem } from '@/lib/media';
import { forgetMedia } from '@/lib/store';

/**
 * Deletes media from the device. Android 11+ and iOS show their own system confirmation,
 * so we only ask ourselves on older Android versions.
 */
export function confirmDelete(items: MediaItem[], onDeleted?: () => void) {
  if (items.length === 0) return;
  const ids = items.map((i) => i.id);
  const run = async () => {
    try {
      await deleteMedia(items);
      forgetMedia(ids);
      onDeleted?.();
    } catch (error) {
      // Most commonly the user tapped "Cancel" in the system dialog.
      console.info('Delete cancelled or failed', error);
    }
  };

  const needsOwnPrompt = Platform.OS === 'android' && Number(Platform.Version) < 30;
  if (!needsOwnPrompt) {
    run();
    return;
  }
  const noun = items.length === 1 ? 'this item' : `${items.length} items`;
  Alert.alert(`Delete ${noun}?`, 'It will be removed from your device. This can’t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: run },
  ]);
}

export async function shareItem(item: MediaItem) {
  try {
    await shareMedia(item);
  } catch (error) {
    Alert.alert('Couldn’t share', error instanceof Error ? error.message : String(error));
  }
}
