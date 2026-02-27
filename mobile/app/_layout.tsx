/**
 * Root layout — initializes DB, network monitor, notifications
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { initDatabase } from '../src/db/client';
import { startNetworkMonitor } from '../src/offline/network-monitor';
import { loadSyncState } from '../src/offline/sync-engine';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    async function bootstrap() {
      try {
        await initDatabase();
        startNetworkMonitor();
        await loadSyncState();
      } catch (e) {
        console.error('Bootstrap error:', e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    bootstrap();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0a0a0f" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#111118' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#0a0a0f' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="bundle/[slug]" options={{ title: 'Bundle Player', presentation: 'modal' }} />
          <Stack.Screen name="doc/[slug]" options={{ title: 'Document' }} />
          <Stack.Screen name="ai-chat" options={{ title: 'AI Chat', presentation: 'modal' }} />
          <Stack.Screen name="sync" options={{ title: 'Sync Status' }} />
          <Stack.Screen name="classroom" options={{ title: 'Classroom' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
