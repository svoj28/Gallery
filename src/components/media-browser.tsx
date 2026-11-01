import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { MediaGrid } from '@/components/media-grid';
import { HeaderButton, ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmDelete, shareItem } from '@/lib/actions';
import type { MediaItem } from '@/lib/media';
import { openAddToAlbum, openMedia } from '@/lib/open-media';
import { getState, toggleFavorite } from '@/lib/store';

type MediaBrowserProps = {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  headerChildren?: ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  bottomInset?: number;
  /** Extra action for the selection bar, e.g. "Remove from album". */
  removeAction?: { label: string; run: (items: MediaItem[]) => void };
};

/** Header + photo grid + multi-select toolbar, shared by every list screen. */
export function MediaBrowser({
  title,
  subtitle,
  items,
  loading,
  refreshing,
  onRefresh,
  onEndReached,
  headerLeft,
  headerRight,
  headerChildren,
  emptyTitle,
  emptyMessage,
  bottomInset = 0,
  removeAction,
}: MediaBrowserProps) {
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const selectedItems = selected ? items.filter((i) => selected.has(i.id)) : [];

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelection = () => setSelected(null);

  const favoriteSelected = () => {
    const { favorites } = getState();
    const allFavorite = selectedItems.every((i) => i.id in favorites);
    for (const item of selectedItems) {
      if (allFavorite || !(item.id in favorites)) toggleFavorite(item);
    }
    exitSelection();
  };

  return (
    <ThemedView style={styles.flex}>
      <ScreenHeader
        title={selected ? `${selected.size} selected` : title}
        subtitle={selected ? 'Tap items to select' : subtitle}
        left={selected ? undefined : headerLeft}
        right={
          selected ? (
            <>
              <HeaderButton
                label={selected.size === items.length ? 'None' : 'All'}
                onPress={() =>
                  setSelected(
                    selected.size === items.length ? new Set() : new Set(items.map((i) => i.id))
                  )
                }
              />
              <HeaderButton label="Done" onPress={exitSelection} />
            </>
          ) : (
            <>
              {headerRight}
              {items.length > 0 ? (
                <HeaderButton label="Select" onPress={() => setSelected(new Set())} />
              ) : null}
            </>
          )
        }>
        {headerChildren}
      </ScreenHeader>

      <MediaGrid
        items={items}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        selectedIds={selected ?? undefined}
        onPressItem={(index) => (selected ? toggle(items[index].id) : openMedia(items, index))}
        onLongPressItem={(index) => toggle(items[index].id)}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
        bottomInset={bottomInset + (selected ? 80 : 0)}
      />

      {selected ? (
        <SelectionBar
          bottomInset={bottomInset}
          disabled={selectedItems.length === 0}
          actions={[
            {
              icon: 'share',
              label: 'Share',
              disabled: selectedItems.length !== 1,
              onPress: () => shareItem(selectedItems[0]),
            },
            { icon: 'heart', label: 'Favorite', onPress: favoriteSelected },
            {
              icon: 'addToAlbum',
              label: 'Album',
              onPress: () => {
                openAddToAlbum(selectedItems);
                exitSelection();
              },
            },
            ...(removeAction
              ? [
                  {
                    icon: 'remove' as const,
                    label: removeAction.label,
                    onPress: () => {
                      removeAction.run(selectedItems);
                      exitSelection();
                    },
                  },
                ]
              : []),
            {
              icon: 'trash',
              label: 'Delete',
              danger: true,
              onPress: () => confirmDelete(selectedItems, exitSelection),
            },
          ]}
        />
      ) : null}
    </ThemedView>
  );
}

type BarAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function SelectionBar({
  actions,
  disabled,
  bottomInset,
}: {
  actions: BarAction[];
  disabled: boolean;
  bottomInset: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { bottom: bottomInset + Spacing.two, backgroundColor: theme.backgroundElement },
      ]}>
      {actions.map((action) => {
        const isDisabled = disabled || action.disabled;
        const color = action.danger ? theme.danger : theme.tint;
        return (
          <Pressable
            key={action.label}
            disabled={isDisabled}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [
              styles.barButton,
              isDisabled && { opacity: 0.35 },
              pressed && { opacity: 0.6 },
            ]}>
            <Icon name={action.icon} size={22} color={color} />
            <ThemedText style={[styles.barLabel, { color }]}>{action.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  barButton: { alignItems: 'center', gap: 2, minWidth: 56, paddingVertical: 2 },
  barLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
});
