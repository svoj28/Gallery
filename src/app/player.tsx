import { useEvent, useEventListener } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { isPictureInPictureSupported, useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { SeekBar } from '@/components/seek-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shareItem } from '@/lib/actions';
import { formatDuration, getPlayableUri, type MediaItem } from '@/lib/media';
import { getViewerList } from '@/lib/open-media';
import { getState, savePosition, toggleFavorite, useGalleryStore } from '@/lib/store';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SEEK_STEP = 10;
const HIDE_CONTROLS_AFTER_MS = 3000;

const formatTime = (seconds: number) => formatDuration(seconds * 1000);

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useTheme();

  const [list] = useState(getViewerList);
  const [index, setIndex] = useState(() =>
    Math.max(0, getViewerList().findIndex((i) => i.id === id))
  );
  const item = list[index] as MediaItem | undefined;
  const favorite = useGalleryStore((s) => (item ? item.id in s.favorites : false));

  const viewRef = useRef<VideoView>(null);
  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 0.25;
  });

  const [position, setPosition] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [duration, setDuration] = useState((item?.duration ?? 0) / 1000);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [loop, setLoop] = useState(false);
  const [speedMenu, setSpeedMenu] = useState(false);
  const [ended, setEnded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ side: 'left' | 'right'; at: number } | null>(null);

  const scrubbing = useRef(false);
  const wasPlaying = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(duration);
  const lastSaved = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { playbackRate } = useEvent(player, 'playbackRateChange', {
    playbackRate: player.playbackRate,
  });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /** Remembers where the user stopped so they can resume later. */
  const persistProgress = (video: MediaItem) => {
    const t = positionRef.current;
    const total = durationRef.current;
    if (total > 0 && total - t <= 5) savePosition(video, null);
    else if (t > 3) savePosition(video, t);
  };

  // Load the current video whenever we move to another one.
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    const saved = getState().positions[item.id];
    const total = (item.duration ?? 0) / 1000;
    pendingSeek.current =
      saved && saved.position > 3 && (total === 0 || total - saved.position > 5)
        ? saved.position
        : null;

    getPlayableUri(item)
      .then((uri) =>
        cancelled
          ? undefined
          : player.replaceAsync({ uri, metadata: { title: item.filename ?? undefined } })
      )
      .then(() => {
        if (!cancelled) player.play();
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
      persistProgress(item);
    };
    // persistProgress only reads refs, so it doesn't need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, player]);

  useEffect(() => {
    if (!item) router.back();
  }, [item]);

  useEventListener(player, 'statusChange', ({ status: next }) => {
    if (next === 'readyToPlay' && pendingSeek.current !== null) {
      const t = pendingSeek.current;
      pendingSeek.current = null;
      player.currentTime = t;
      setPosition(t);
      setResumedAt(t);
    }
  });

  useEventListener(player, 'sourceLoad', ({ duration: loaded }) => {
    if (loaded > 0) {
      durationRef.current = loaded;
      setDuration(loaded);
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime, bufferedPosition }) => {
    positionRef.current = currentTime;
    if (!scrubbing.current) setPosition(currentTime);
    setBuffered(bufferedPosition);
    if (item && Math.abs(currentTime - lastSaved.current) >= 5) {
      lastSaved.current = currentTime;
      persistProgress(item);
    }
  });

  useEventListener(player, 'playToEnd', () => {
    if (!item || loop) return;
    savePosition(item, null);
    positionRef.current = 0;
    if (index < list.length - 1) goTo(index + 1);
    else {
      setEnded(true);
      showControls(false);
    }
  });

  // Hide the "resumed" hint after a few seconds.
  useEffect(() => {
    if (resumedAt === null) return;
    const t = setTimeout(() => setResumedAt(null), 4000);
    return () => clearTimeout(t);
  }, [resumedAt]);

  useEffect(() => {
    if (!seekFlash) return;
    const t = setTimeout(() => setSeekFlash(null), 650);
    return () => clearTimeout(t);
  }, [seekFlash]);

  // Controls stay up while paused and fade away a few seconds after playback resumes.
  useEffect(() => {
    if (isPlaying) scheduleHide();
    else {
      clearTimeout(hideTimer.current);
      setControlsVisible(true);
    }
    return () => clearTimeout(hideTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  function scheduleHide() {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (isPlayingRef.current && !scrubbing.current) {
        setControlsVisible(false);
        setSpeedMenu(false);
      }
    }, HIDE_CONTROLS_AFTER_MS);
  }

  function showControls(autoHide = true) {
    setControlsVisible(true);
    if (autoHide) scheduleHide();
  }

  function goTo(next: number) {
    if (!item || next < 0 || next >= list.length) return;
    persistProgress(item);
    positionRef.current = 0;
    lastSaved.current = 0;
    setIndex(next);
    setPosition(0);
    setBuffered(0);
    setDuration((list[next].duration ?? 0) / 1000);
    durationRef.current = (list[next].duration ?? 0) / 1000;
    setEnded(false);
    setLoadError(null);
    setResumedAt(null);
    showControls();
  }

  const seekBy = (delta: number) => {
    const target = Math.min(durationRef.current || Infinity, Math.max(0, positionRef.current + delta));
    player.currentTime = target;
    positionRef.current = target;
    setPosition(target);
    setEnded(false);
  };

  const togglePlay = () => {
    if (ended) {
      player.replay();
      setEnded(false);
    } else if (isPlaying) player.pause();
    else player.play();
    showControls();
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd((e) => {
      if (locked) return;
      const side = e.x < width / 2 ? 'left' : 'right';
      seekBy(side === 'left' ? -SEEK_STEP : SEEK_STEP);
      setSeekFlash({ side, at: Date.now() });
    });

  const singleTap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      setSpeedMenu(false);
      if (controlsVisible) setControlsVisible(false);
      else showControls();
    });

  const surfaceGesture = Gesture.Exclusive(doubleTap, singleTap);

  if (!item) return <View style={styles.root} />;

  const showOverlay = controlsVisible && !locked;
  const loading = !loadError && (status === 'loading' || status === 'idle');

  const tools: { icon: IconName; label: string; onPress: () => void; active?: boolean }[] = [
    {
      icon: 'speed',
      label: `${playbackRate}x`,
      onPress: () => setSpeedMenu((v) => !v),
      active: playbackRate !== 1,
    },
    {
      icon: 'loop',
      label: 'Loop',
      onPress: () => {
        player.loop = !loop;
        setLoop(!loop);
      },
      active: loop,
    },
    {
      icon: muted ? 'mute' : 'volume',
      label: muted ? 'Muted' : 'Sound',
      onPress: () => {
        player.muted = !muted;
      },
      active: muted,
    },
    {
      icon: 'fit',
      label: fit === 'contain' ? 'Fit' : 'Fill',
      onPress: () => setFit((f) => (f === 'contain' ? 'cover' : 'contain')),
      active: fit === 'cover',
    },
    ...(isPictureInPictureSupported()
      ? [
          {
            icon: 'pip' as const,
            label: 'PiP',
            onPress: () => viewRef.current?.startPictureInPicture().catch(() => {}),
          },
        ]
      : []),
    {
      icon: 'fullscreen',
      label: 'Full',
      onPress: () => viewRef.current?.enterFullscreen().catch(() => {}),
    },
    { icon: 'lock', label: 'Lock', onPress: () => setLocked(true) },
  ];

  return (
    <View style={styles.root}>
      <StatusBar hidden={!showOverlay} style="light" />

      <GestureDetector gesture={surfaceGesture}>
        <View style={StyleSheet.absoluteFill}>
          <VideoView
            ref={viewRef}
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit={fit}
            nativeControls={false}
            allowsPictureInPicture
            fullscreenOptions={{ enable: true }}
          />
        </View>
      </GestureDetector>

      {seekFlash ? (
        <View
          pointerEvents="none"
          style={[styles.seekFlash, seekFlash.side === 'left' ? { left: '10%' } : { right: '10%' }]}>
          <Icon name={seekFlash.side === 'left' ? 'back10' : 'forward10'} size={30} color="#fff" />
          <Text style={styles.seekFlashText}>
            {seekFlash.side === 'left' ? `−${SEEK_STEP}s` : `+${SEEK_STEP}s`}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}

      {loadError || status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Can’t play this video</Text>
          <Text style={styles.errorText}>{loadError ?? 'The file may be damaged or unsupported.'}</Text>
          <Pressable onPress={() => router.back()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go back</Text>
          </Pressable>
        </View>
      ) : null}

      {locked && controlsVisible ? (
        <View style={[styles.lockedBar, { top: insets.top + Spacing.two }]}>
          <Pressable
            onPress={() => {
              setLocked(false);
              showControls();
            }}
            accessibilityRole="button"
            accessibilityLabel="Unlock controls"
            style={styles.unlockButton}>
            <Icon name="unlock" size={18} color="#fff" />
            <Text style={styles.unlockText}>Tap to unlock</Text>
          </Pressable>
        </View>
      ) : null}

      {showOverlay ? (
        <>
          {/* Top bar */}
          <View
            style={[
              styles.topBar,
              {
                paddingTop: insets.top + Spacing.one,
                paddingLeft: insets.left + Spacing.three,
                paddingRight: insets.right + Spacing.three,
              },
            ]}>
            <RoundButton icon="back" label="Close player" onPress={() => router.back()} />
            <View style={styles.titleBlock}>
              <Text style={styles.title} numberOfLines={1}>
                {item.filename ?? 'Video'}
              </Text>
              {list.length > 1 ? (
                <Text style={styles.subtitle}>
                  {index + 1} of {list.length}
                </Text>
              ) : null}
            </View>
            <RoundButton
              icon={favorite ? 'heartFill' : 'heart'}
              label={favorite ? 'Remove from favorites' : 'Add to favorites'}
              color={favorite ? theme.favorite : '#fff'}
              onPress={() => toggleFavorite(item)}
            />
            <RoundButton icon="share" label="Share" onPress={() => shareItem(item)} />
          </View>

          {/* Center transport controls */}
          <View pointerEvents="box-none" style={styles.center}>
            <View style={styles.transport}>
              <RoundButton
                icon="previous"
                label="Previous video"
                size={26}
                disabled={index === 0}
                onPress={() => goTo(index - 1)}
              />
              <RoundButton
                icon="back10"
                label={`Back ${SEEK_STEP} seconds`}
                size={28}
                onPress={() => {
                  seekBy(-SEEK_STEP);
                  showControls();
                }}
              />
              <Pressable
                onPress={togglePlay}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.7 }]}>
                <Icon name={isPlaying && !ended ? 'pause' : 'play'} size={38} color="#fff" />
              </Pressable>
              <RoundButton
                icon="forward10"
                label={`Forward ${SEEK_STEP} seconds`}
                size={28}
                onPress={() => {
                  seekBy(SEEK_STEP);
                  showControls();
                }}
              />
              <RoundButton
                icon="next"
                label="Next video"
                size={26}
                disabled={index >= list.length - 1}
                onPress={() => goTo(index + 1)}
              />
            </View>
            {ended ? <Text style={styles.endedText}>Tap play to watch again</Text> : null}
          </View>

          {/* Bottom: timeline + tools */}
          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: insets.bottom + Spacing.two,
                paddingLeft: insets.left + Spacing.three,
                paddingRight: insets.right + Spacing.three,
              },
            ]}>
            {resumedAt !== null ? (
              <View style={styles.resumeToast}>
                <Text style={styles.resumeText}>Resumed at {formatTime(resumedAt)}</Text>
                <Pressable
                  onPress={() => {
                    player.currentTime = 0;
                    setPosition(0);
                    setResumedAt(null);
                  }}
                  hitSlop={8}>
                  <Text style={[styles.resumeText, { color: theme.tint }]}>Start over</Text>
                </Pressable>
              </View>
            ) : null}

            {speedMenu ? (
              <View style={styles.speedMenu}>
                {SPEEDS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => {
                      player.playbackRate = s;
                      setSpeedMenu(false);
                      showControls();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: s === playbackRate }}
                    style={[styles.speedOption, s === playbackRate && { backgroundColor: theme.tint }]}>
                    <Text style={styles.speedText}>{s === 1 ? 'Normal' : `${s}x`}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatTime(position)}</Text>
              <Text style={styles.time}>
                {duration > 0 ? `-${formatTime(Math.max(0, duration - position))}` : '--:--'}
              </Text>
            </View>
            <SeekBar
              position={position}
              duration={duration}
              buffered={buffered}
              color={theme.tint}
              formatTime={formatTime}
              onScrubStart={() => {
                scrubbing.current = true;
                wasPlaying.current = isPlayingRef.current;
                player.pause();
                clearTimeout(hideTimer.current);
              }}
              onScrub={(t) => {
                player.currentTime = t;
              }}
              onScrubEnd={(t) => {
                player.currentTime = t;
                positionRef.current = t;
                setPosition(t);
                setEnded(false);
                scrubbing.current = false;
                if (wasPlaying.current) player.play();
                showControls();
              }}
            />
            <View style={styles.tools}>
              {tools.map((tool) => (
                <Pressable
                  key={tool.icon}
                  onPress={() => {
                    tool.onPress();
                    showControls();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={tool.label}
                  accessibilityState={{ selected: !!tool.active }}
                  style={({ pressed }) => [styles.tool, pressed && { opacity: 0.5 }]}>
                  <Icon name={tool.icon} size={20} color={tool.active ? theme.tint : '#fff'} />
                  <Text style={[styles.toolText, tool.active && { color: theme.tint }]}>
                    {tool.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  size = 20,
  color = '#fff',
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
}) {
  const box = size + 22;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.round,
        { width: box, height: box, borderRadius: box / 2 },
        disabled && { opacity: 0.3 },
        pressed && { opacity: 0.5 },
      ]}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  titleBlock: { flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  transport: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  endedText: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.three,
    gap: Spacing.one,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: '#fff', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tools: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.one },
  tool: { alignItems: 'center', gap: 2, minWidth: 44, paddingVertical: Spacing.one },
  toolText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  speedMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 14,
    backgroundColor: 'rgba(40,40,44,0.95)',
    marginBottom: Spacing.two,
  },
  speedOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedText: { color: '#fff', fontWeight: '700' },
  resumeToast: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    backgroundColor: 'rgba(40,40,44,0.95)',
    marginBottom: Spacing.two,
  },
  resumeText: { color: '#fff', fontWeight: '600' },
  seekFlash: {
    position: 'absolute',
    top: '42%',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  seekFlashText: { color: '#fff', fontWeight: '700', marginTop: 2 },
  lockedBar: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  unlockText: { color: '#fff', fontWeight: '600' },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  errorText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingHorizontal: Spacing.five },
  errorButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  errorButtonText: { color: '#fff', fontWeight: '700' },
});
