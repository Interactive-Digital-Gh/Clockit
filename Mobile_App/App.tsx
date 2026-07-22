import 'react-native-url-polyfill/auto';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { runAutoClockOutCheck, loadUserFromStorage } from './src/tasks/autoClockOut';
import { runAutoClockInCheck } from './src/tasks/autoClockIn';
import { loadPrefs, syncScheduledNotifications } from './src/lib/notifications';

const AUTO_CLOCK_OUT_TASK = 'auto-clock-out';

// Define the background task outside the component so it registers at module
// load. Runs both checks every firing — they're mutually exclusive (one
// fires only when off-network past shift end, the other only when on-site
// within work hours), so there's no conflict in checking both each cycle.
TaskManager.defineTask(AUTO_CLOCK_OUT_TASK, async () => {
  const user = await loadUserFromStorage();
  if (!user) return BackgroundFetch.BackgroundFetchResult.NoData;

  const [didClockOut, clockedInRecord] = await Promise.all([
    runAutoClockOutCheck(user).catch(() => false),
    runAutoClockInCheck(user).catch(() => null),
  ]);
  return didClockOut || clockedInRecord
    ? BackgroundFetch.BackgroundFetchResult.NewData
    : BackgroundFetch.BackgroundFetchResult.NoData;
});

// Show notifications even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupBackgroundFetch() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // Reminders/summaries are local scheduled notifications — make the device's
  // schedule match the saved preferences on every launch.
  await syncScheduledNotifications(await loadPrefs()).catch(() => {});

  const isRegistered = await TaskManager.isTaskRegisteredAsync(AUTO_CLOCK_OUT_TASK);
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(AUTO_CLOCK_OUT_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  React.useEffect(() => {
    setupBackgroundFetch();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4338CA' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
