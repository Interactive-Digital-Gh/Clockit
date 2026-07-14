import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { checkCompanyNetwork } from '../utils/networkCheck';
import { fetchAgencyAllowedSubnets, clockOutEmployee } from '../services/attendanceService';
import { UserProfile } from '../context/AppContext';

const OFF_NETWORK_KEY = '@autoClockOut:offNetworkSince';

// Auto clock-out triggers at 17:30 after 20 mins off the company network
const THRESHOLD_HOUR = 17;
const THRESHOLD_MIN = 30;
const GRACE_MS = 20 * 60 * 1000;

function isPastThreshold(): boolean {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= THRESHOLD_HOUR * 60 + THRESHOLD_MIN;
}

async function notifyClockOut() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Automatically clocked out',
      body: 'You were clocked out at 5:30 PM after leaving the office network.',
      sound: true,
    },
    trigger: null, // deliver immediately
  });
}

/**
 * Core check — call this from both foreground interval and background task.
 * Returns true if the employee was auto-clocked out.
 */
export async function runAutoClockOutCheck(user: UserProfile): Promise<boolean> {
  if (!isPastThreshold()) {
    await AsyncStorage.removeItem(OFF_NETWORK_KEY);
    return false;
  }

  const allowedSubnets = user.agencyId
    ? await fetchAgencyAllowedSubnets(user.agencyId).catch(() => [] as string[])
    : [];

  const networkStatus = await checkCompanyNetwork(allowedSubnets);

  if (networkStatus === 'allowed') {
    // Back on network — reset the off-network timer
    await AsyncStorage.removeItem(OFF_NETWORK_KEY);
    return false;
  }

  // Off network — start or check the grace period timer
  const raw = await AsyncStorage.getItem(OFF_NETWORK_KEY);
  const now = Date.now();

  if (!raw) {
    await AsyncStorage.setItem(OFF_NETWORK_KEY, String(now));
    return false;
  }

  const offSince = Number(raw);
  if (now - offSince < GRACE_MS) return false;

  // Grace period expired — clock out
  await clockOutEmployee(user.id);
  await AsyncStorage.removeItem(OFF_NETWORK_KEY);
  await notifyClockOut();
  return true;
}

/** Call when the user manually clocks out so the timer is cleared. */
export async function clearAutoClockOutTimer() {
  await AsyncStorage.removeItem(OFF_NETWORK_KEY);
}

/** Read user profile from AsyncStorage — used by the background task. */
export async function loadUserFromStorage(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem('@attendance:user');
  return raw ? JSON.parse(raw) : null;
}
