import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/** A draggable, tappable timeline with buffered progress and a time bubble while scrubbing. */
export function SeekBar({
  position,
  duration,
  buffered,
  color,
  formatTime,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: {
  position: number;
  duration: number;
  buffered: number;
  color: string;
  formatTime: (seconds: number) => string;
  onScrubStart: () => void;
  onScrub: (seconds: number) => void;
  onScrubEnd: (seconds: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [scrubbing, setScrubbing] = useState<number | null>(null);

  const toSeconds = (x: number) =>
    width > 0 && duration > 0 ? Math.min(duration, Math.max(0, (x / width) * duration)) : 0;

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .hitSlop({ top: 16, bottom: 16 })
    .onBegin((e) => {
      const t = toSeconds(e.x);
      setScrubbing(t);
      onScrubStart();
      onScrub(t);
    })
    .onUpdate((e) => {
      const t = toSeconds(e.x);
      setScrubbing(t);
      onScrub(t);
    })
    .onFinalize((e) => {
      const t = toSeconds(e.x);
      setScrubbing(null);
      onScrubEnd(t);
    });

  const shown = scrubbing ?? position;
  const progress = duration > 0 ? shown / duration : 0;
  const bufferedProgress = duration > 0 ? Math.min(1, buffered / duration) : 0;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.touchArea}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        accessibilityValue={{ text: `${formatTime(shown)} of ${formatTime(duration)}` }}>
        <View style={styles.track}>
          <View style={[styles.buffered, { width: `${bufferedProgress * 100}%` }]} />
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
        </View>
        <View
          style={[
            styles.thumb,
            scrubbing !== null && styles.thumbActive,
            { left: progress * width - (scrubbing !== null ? 10 : 7), backgroundColor: color },
          ]}
        />
        {scrubbing !== null && width > 0 ? (
          <View
            style={[
              styles.bubble,
              { left: Math.min(width - 60, Math.max(0, progress * width - 30)) },
            ]}>
            <Text style={styles.bubbleText}>{formatTime(scrubbing)}</Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  touchArea: { height: 28, justifyContent: 'center' },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  buffered: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  thumbActive: { width: 20, height: 20, borderRadius: 10 },
  bubble: {
    position: 'absolute',
    bottom: 30,
    width: 60,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  bubbleText: { color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
});
