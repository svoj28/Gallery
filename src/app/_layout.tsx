import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { hydrate } from '@/lib/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false, orientation: 'portrait' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="album/[id]" />
          <Stack.Screen
            name="viewer"
            options={{ animation: 'fade', orientation: 'all', contentStyle: styles.black }}
          />
          <Stack.Screen
            name="player"
            options={{ animation: 'fade', orientation: 'all', contentStyle: styles.black }}
          />
          <Stack.Screen name="add-to-album" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pick-media" options={{ presentation: 'modal' }} />
        </Stack>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  black: { backgroundColor: '#000' },
});
