import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Full-screen photo with pinch-to-zoom, double-tap zoom and panning while zoomed.
 * Panning is disabled at 1x so horizontal swipes go to the pager.
 */
export function ZoomableImage({
  uri,
  width,
  height,
  zoomed,
  onZoomChange,
  onTap,
}: {
  uri: string;
  width: number;
  height: number;
  zoomed: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onTap: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // When the pager moves to another photo it clears `zoomed`; snap this one back to 1x.
  useEffect(() => {
    if (zoomed || savedScale.value === 1) return;
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  }, [zoomed, scale, savedScale, tx, ty, savedTx, savedTy]);

  const clampTranslation = (value: number, s: number, size: number) => {
    'worklet';
    const max = Math.max(0, (size * s - size) / 2);
    return Math.min(max, Math.max(-max, value));
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
    scheduleOnRN(onZoomChange, false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      tx.value = withTiming(clampTranslation(tx.value, scale.value, width));
      ty.value = withTiming(clampTranslation(ty.value, scale.value, height));
      savedTx.value = clampTranslation(tx.value, scale.value, width);
      savedTy.value = clampTranslation(ty.value, scale.value, height);
      scheduleOnRN(onZoomChange, true);
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .averageTouches(true)
    .onUpdate((e) => {
      tx.value = clampTranslation(savedTx.value + e.translationX, scale.value, width);
      ty.value = clampTranslation(savedTy.value + e.translationY, scale.value, height);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1) {
        reset();
        return;
      }
      const s = DOUBLE_TAP_SCALE;
      const nextX = clampTranslation((width / 2 - e.x) * (s - 1), s, width);
      const nextY = clampTranslation((height / 2 - e.y) * (s - 1), s, height);
      scale.value = withTiming(s);
      savedScale.value = s;
      tx.value = withTiming(nextX);
      ty.value = withTiming(nextY);
      savedTx.value = nextX;
      savedTy.value = nextY;
      scheduleOnRN(onZoomChange, true);
    });

  const singleTap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(onTap);
  });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, styles.container]}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={150}
            allowDownscaling={false}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
