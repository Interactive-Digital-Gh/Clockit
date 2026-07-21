import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Registers this device for admin broadcast alerts. Requires a physical
 * device and the notification permission already granted (App.tsx requests
 * it on launch for the local reminder notifications). Fails soft — a device
 * that never registers just doesn't receive broadcasts, same as anything
 * else that depends on notification permission.
 */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.registerPushToken(token, Platform.OS);
  } catch {
    // Best-effort — clock-in/out must never depend on this succeeding.
  }
}
