import { Image } from 'expo-image';
import { memo, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, type MediaItem } from '@/lib/media';
import { useGalleryStore } from '@/lib/store';

const GAP = 2;

type MediaGridProps = {
  items: MediaItem[];
  onPressItem: (index: number) => void;
  onLongPressItem?: (index: number) => void;
  /** When set, the grid is in selection mode and taps toggle selection. */
  selectedIds?: Set<string>;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
  header?: ReactElement;
  emptyTitle?: string;
  emptyMessage?: string;
  bottomInset?: number;
};

export function MediaGrid({
  items,
  onPressItem,
  onLongPressItem,
  selectedIds,
  onEndReached,
  refreshing = false,
  onRefresh,
  loading = false,
  header,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  bottomInset = 0,
}: MediaGridProps) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const numColumns = width < 500 ? 4 : Math.floor(width / 130);
  const size = (width - GAP * (numColumns - 1)) / numColumns;

  return (
    <FlatList
      key={numColumns}
      data={items}
      numColumns={numColumns}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={numColumns > 1 ? { gap: GAP } : undefined}
      contentContainerStyle={{ gap: GAP, paddingBottom: bottomInset + Spacing.four, flexGrow: 1 }}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => (
        <MediaTile
          item={item}
          size={size}
          selected={selectedIds?.has(item.id)}
          selecting={!!selectedIds}
          onPress={() => onPressItem(index)}
          onLongPress={onLongPressItem ? () => onLongPressItem(index) : undefined}
        />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={1.5}
      initialNumToRender={numColumns * 8}
      maxToRenderPerBatch={numColumns * 8}
      windowSize={11}
      removeClippedSubviews
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
      ListEmptyComponent={
        loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={theme.textSecondary} />
          </View>
        ) : (
          <View style={styles.empty}>
            <ThemedText type="smallBold">{emptyTitle}</ThemedText>
            {emptyMessage ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
                {emptyMessage}
              </ThemedText>
            ) : null}
          </View>
        )
      }
    />
  );
}

type MediaTileProps = {
  item: MediaItem;
  size: number;
  selected?: boolean;
  selecting: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

const MediaTile = memo(function MediaTile({
  item,
  size,
  selected,
  selecting,
  onPress,
  onLongPress,
}: MediaTileProps) {
  const theme = useTheme();
  const favorite = useGalleryStore((s) => item.id in s.favorites);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="imagebutton"
      accessibilityLabel={`${item.kind === 'video' ? 'Video' : 'Photo'} ${item.filename ?? ''}`}
      accessibilityState={selecting ? { selected: !!selected } : undefined}
      style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed]}>
      <Image
        source={{ uri: item.uri }}
        recyclingKey={item.id}
        style={[styles.image, { backgroundColor: theme.backgroundElement }]}
        contentFit="cover"
        transition={120}
      />

      {item.kind === 'video' && (
        <View style={styles.videoBadge}>
          <Icon name="play" size={10} color="#fff" />
          <Text style={styles.badgeText}>{formatDuration(item.duration)}</Text>
        </View>
      )}

      {favorite && (
        <View style={styles.favoriteBadge}>
          <Icon name="heartFill" size={13} color="#fff" />
        </View>
      )}

      {selecting && (
        <View style={[styles.selectOverlay, selected && styles.selectedOverlay]}>
          <View style={styles.checkWrap}>
            <Icon
              name={selected ? 'check' : 'unchecked'}
              size={22}
              color={selected ? theme.tint : '#fff'}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  image: { flex: 1 },
  pressed: { opacity: 0.75 },
  videoBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  favoriteBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    padding: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  selectOverlay: { ...StyleSheet.absoluteFill, alignItems: 'flex-end', padding: 5 },
  selectedOverlay: { backgroundColor: 'rgba(255,255,255,0.25)' },
  checkWrap: { borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.25)' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.two,
    minHeight: 300,
  },
  emptyMessage: { textAlign: 'center' },
});
