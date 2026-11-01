import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { NameDialog } from '@/components/name-dialog';
import { HeaderButton, ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countLabel } from '@/lib/media';
import { takePendingAlbumItems } from '@/lib/open-media';
import { addToAlbum, createAlbum, useGalleryStore } from '@/lib/store';

/** Sheet for putting the selected photos/videos into one of the user's albums. */
export default function AddToAlbumScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [items] = useState(takePendingAlbumItems);
  const albums = useGalleryStore((s) => s.albums);
  const [creating, setCreating] = useState(false);

  const noun = items.length === 1 ? '1 item' : `${items.length} items`;

  return (
    <ThemedView style={styles.flex}>
      <ScreenHeader
        title="Add to album"
        subtitle={noun}
        right={<HeaderButton label="Cancel" onPress={() => router.back()} />}
      />
      <FlatList
        data={albums}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four }}
        ListHeaderComponent={
          <Row
            onPress={() => setCreating(true)}
            thumb={
              <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="add" size={26} color={theme.tint} />
              </View>
            }
            title="New album…"
            titleColor={theme.tint}
          />
        }
        renderItem={({ item: album }) => {
          const ids = new Set(album.items.map((i) => i.id));
          const allInside = items.every((i) => ids.has(i.id));
          const videos = album.items.filter((i) => i.kind === 'video').length;
          return (
            <Row
              onPress={() => {
                addToAlbum(album.id, items);
                router.back();
              }}
              disabled={allInside}
              thumb={
                <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                  {album.items[0] ? (
                    <Image
                      source={{ uri: album.items[0].uri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <Icon name="album" size={24} color={theme.textSecondary} />
                  )}
                </View>
              }
              title={album.name}
              subtitle={
                allInside ? 'Already added' : countLabel(album.items.length - videos, videos)
              }
            />
          );
        }}
      />

      <NameDialog
        visible={creating}
        title="New album"
        confirmLabel="Create"
        onCancel={() => setCreating(false)}
        onSubmit={(name) => {
          setCreating(false);
          createAlbum(name, items);
          router.back();
        }}
      />
    </ThemedView>
  );
}

function Row({
  thumb,
  title,
  subtitle,
  titleColor,
  onPress,
  disabled,
}: {
  thumb: ReactNode;
  title: string;
  subtitle?: string;
  titleColor?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, (pressed || disabled) && { opacity: 0.5 }]}>
      {thumb}
      <View style={styles.flex}>
        <ThemedText type="smallBold" style={titleColor ? { color: titleColor } : undefined}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
