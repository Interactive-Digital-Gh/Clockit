import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { checkCompanyNetwork } from '../utils/networkCheck';
import { distanceMeters, getBackgroundLocationIfAvailable } from '../utils/locationCheck';
import { fetchAgencyAllowedSubnets, fetchAgencyGeofence, clockInEmployee, AttendanceRecord } from '../services/attendanceService';
import { UserProfile } from '../context/AppContext';

const ON_SITE_KEY = '@autoClockIn:onSiteSince';
const SUPPRESS_KEY = '@autoClockIn:suppressedUntil';

// Only auto clock-in within plausible work hours — avoids a stray office
// WiFi ping at 2am (e.g. a visit for something unrelated) triggering it.
const WINDOW_START_HOUR = 6;
const WINDOW_END_HOUR = 20;

// How long the employee must be continuously on-site before we act — short,
// since a missed arrival costs more here than the reverse does for clock-out.
const GRACE_MS = 3 * 60 * 1000;

function withinWorkWindow(): boolean {
  const hour = new Date().getHours();
  return hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR;
}

async function notifyClockIn() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Automatically clocked in',
      body: "Welcome back — we noticed you're at the office and clocked you in.",
      sound: true,
    },
    trigger: null,
  });
}

/**
 * Suppresses auto clock-in for the rest of today. Call this on a MANUAL
 * clock-out — if someone deliberately ends their day early but is still
 * sitting on the office network, auto clock-in should not immediately
 * undo that choice. Automatic (network-loss) clock-outs do NOT suppress —
 * leaving and coming back is exactly the case this feature is for.
 */
export async function suppressAutoClockInForToday(): Promise<void> {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  await AsyncStorage.setItem(SUPPRESS_KEY, String(midnight.getTime()));
}

async function isSuppressed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SUPPRESS_KEY);
  if (!raw) return false;
  if (Date.now() < Number(raw)) return true;
  await AsyncStorage.removeItem(SUPPRESS_KEY);
  return false;
}

/**
 * Core check — call from both the foreground interval and the background
 * task, same pattern as runAutoClockOutCheck. WiFi/subnet is the primary
 * on-site signal; GPS only supplements it, and only if the app already has
 * background ("Always") location permission — never prompts for it here.
 * Returns the clocked-in record if this call triggered a fresh clock-in.
 */
export async function runAutoClockInCheck(user: UserProfile): Promise<AttendanceRecord | null> {
  if (!withinWorkWindow() || !user.agencyId || (await isSuppressed())) {
    await AsyncStorage.removeItem(ON_SITE_KEY);
    return null;
  }

  const allowedSubnets = await fetchAgencyAllowedSubnets(user.agencyId).catch(() => [] as string[]);
  const networkStatus = await checkCompanyNetwork(allowedSubnets);
  let onSite = networkStatus === 'allowed';

  if (!onSite) {
    const geofence = await fetchAgencyGeofence(user.agencyId).catch(() => null);
    const location = geofence ? await getBackgroundLocationIfAvailable() : null;
    if (geofence && location) {
      const distance = distanceMeters(geofence.latitude, geofence.longitude, location.latitude, location.longitude);
      onSite = distance <= geofence.radiusM;
    }
  }

  if (!onSite) {
    await AsyncStorage.removeItem(ON_SITE_KEY);
    return null;
  }

  const raw = await AsyncStorage.getItem(ON_SITE_KEY);
  const now = Date.now();

  if (!raw) {
    await AsyncStorage.setItem(ON_SITE_KEY, String(now));
    return null;
  }

  const onSiteSince = Number(raw);
  if (now - onSiteSince < GRACE_MS) return null;

  // Clock-in is idempotent server-side — safe even if another path already
  // clocked the employee in between our checks.
  const record = await clockInEmployee(user.id, true);
  await AsyncStorage.removeItem(ON_SITE_KEY);
  if (!record.clock_out_time) await notifyClockIn();
  return record;
}
