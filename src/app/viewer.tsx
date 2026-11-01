import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { ZoomableImage } from '@/components/zoomable-image';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmDelete, shareItem } from '@/lib/actions';
import {
  formatDate,
  formatDuration,
  getMediaDetails,
  type MediaItem,
} from '@/lib/media';
import { getViewerList, openAddToAlbum, openMedia } from '@/lib/open-media';
import { toggleFavorite, useGalleryStore } from '@/lib/store';

export default function ViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [items, setItems] = useState(getViewerList);
  const [index, setIndex] = useState(() =>
    Math.max(0, getViewerList().findIndex((i) => i.id === id))
  );
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const listRef = useRef<FlatList<MediaItem>>(null);
  const indexRef = useRef(index);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const current = items[index] as MediaItem | undefined;
  const favorite = useGalleryStore((s) => (current ? current.id in s.favorites : false));

  useEffect(() => {
    if (!current) router.back();
  }, [current]);

  // Keep the same photo on screen after rotating.
  useEffect(() => {
    listRef.current?.scrollToIndex({ index: indexRef.current, animated: false });
  }, [width]);

  if (!current) return <View style={styles.root} />;

  const deleteCurrent = () =>
    confirmDelete([current], () => {
      const next = items.filter((i) => i.id !== current.id);
      setItems(next);
      setIndex(Math.min(index, next.length - 1));
      setShowInfo(false);
    });

  const actions: { icon: IconName; label: string; onPress: () => void; color?: string }[] = [
    { icon: 'share', label: 'Share', onPress: () => shareItem(current) },
    {
      icon: favorite ? 'heartFill' : 'heart',
      label: favorite ? 'Unfavorite' : 'Favorite',
      onPress: () => toggleFavorite(current),
      color: favorite ? theme.favorite : '#fff',
    },
    { icon: 'addToAlbum', label: 'Add to album', onPress: () => openAddToAlbum([current]) },
    {
      icon: 'info',
      label: 'Info',
      onPress: () => setShowInfo((v) => !v),
      color: showInfo ? theme.tint : '#fff',
    },
    { icon: 'trash', label: 'Delete', onPress: deleteCurrent },
  ];

  return (
    <View style={styles.root}>
      <StatusBar hidden={!chrome} style="light" />
      <FlatList
        ref={listRef}
        data={items}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        keyExtractor={(item) => item.id}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        extraData={{ zoomed, index, width }}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          if (next !== index) {
            setIndex(next);
            setZoomed(false);
            setShowInfo(false);
          }
        }}
        renderItem={({ item, index: i }) =>
          item.kind === 'image' ? (
            <ZoomableImage
              uri={item.uri}
              width={width}
              height={height}
              zoomed={zoomed && i === index}
              onZoomChange={setZoomed}
              onTap={() => setChrome((c) => !c)}
            />
          ) : (
            <Pressable
              style={{ width, height }}
              onPress={() => openMedia(items, i)}
              accessibilityRole="button"
              accessibilityLabel="Play video">
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
              <View style={styles.playOverlay}>
                <View style={styles.playCircle}>
                  <Icon name="play" size={36} color="#fff" />
                </View>
                <Text style={styles.playDuration}>{formatDuration(item.duration)}</Text>
              </View>
            </Pressable>
          )
        }
      />

      {chrome ? (
        <>
          <View style={[styles.topBar, { paddingTop: insets.top + Spacing.one }]}>
            <RoundButton icon="back" label="Back" onPress={() => router.back()} />
            <View style={styles.titleBlock}>
              <Text style={styles.title} numberOfLines={1}>
                {formatDate(current.creationTime)}
              </Text>
              <Text style={styles.subtitle}>
                {index + 1} of {items.length}
              </Text>
            </View>
            <View style={styles.spacer} />
          </View>

          {showInfo ? <InfoPanel item={current} bottom={insets.bottom + 76} /> : null}

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.two }]}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.5 }]}>
                <Icon name={a.icon} size={24} color={a.color ?? '#fff'} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, pressed && { opacity: 0.5 }]}>
      <Icon name={icon} size={20} color="#fff" />
    </Pressable>
  );
}

type Details = Awaited<ReturnType<typeof getMediaDetails>>;

function InfoPanel({ item, bottom }: { item: MediaItem; bottom: number }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMediaDetails(item)
      .then((d) => !cancelled && setDetails(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const w = details?.width ?? item.width;
  const h = details?.height ?? item.height;
  const rows: [string, string][] = [
    ['Name', details?.filename ?? item.filename ?? '—'],
    ['Taken', formatDate(details?.creationTime ?? item.creationTime, true)],
    ['Size', w && h ? `${w} × ${h} · ${((w * h) / 1_000_000).toFixed(1)} MP` : '—'],
  ];
  if (item.kind === 'video') rows.push(['Length', formatDuration(item.duration)]);
  if (details?.location)
    rows.push([
      'Location',
      `${details.location.latitude.toFixed(4)}, ${details.location.longitude.toFixed(4)}`,
    ]);
  if (details?.albums.length) rows.push(['Folder', details.albums.join(', ')]);

  return (
    <View style={[styles.info, { bottom }]}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue} numberOfLines={2}>
            {value}
          </Text>
        </View>
      ))}
      {!details && !failed ? <ActivityIndicator color="#fff" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  titleBlock: { flex: 1, alignItems: 'center' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  spacer: { width: 40 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  action: { padding: Spacing.two },
  playOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8 },
  playCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  playDuration: { color: '#fff', fontWeight: '700' },
  info: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: 16,
    backgroundColor: 'rgba(30,30,32,0.92)',
  },
  infoRow: { flexDirection: 'row', gap: Spacing.three },
  infoLabel: { width: 72, color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  infoValue: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
});
