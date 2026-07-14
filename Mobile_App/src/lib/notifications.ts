// Local scheduled notifications — reminders and alerts generated on-device.
// No push server involved: the Notifications settings screen toggles map
// directly to notifications scheduled here. Rich, data-driven pushes (e.g.
// real weekly stats in the notification body) are a later, server-side story.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { SHIFT } from '../config/attendance';

export const PREFS_KEY = '@notif_prefs';

export interface NotifPrefs {
  clockInReminder: boolean;
  clockOutReminder: boolean;
  lateAlert: boolean;
  weeklySummary: boolean;
  monthlyReport: boolean;
}

export const DEFAULT_PREFS: NotifPrefs = {
  clockInReminder: true,
  clockOutReminder: true,
  lateAlert: false,
  weeklySummary: true,
  monthlyReport: false,
};

// Reminder times. Clock-in fires 15 minutes before the shift starts; the
// clock-out time mirrors the standard end of day (auto clock-out arms at 17:30).
const shiftStartMins = SHIFT.startHour * 60 + SHIFT.startMinute;
const clockInReminderMins = shiftStartMins - 15;
const CLOCK_IN_REMINDER = { hour: Math.floor(clockInReminderMins / 60), minute: clockInReminderMins % 60 };
const CLOCK_OUT_REMINDER = { hour: 17, minute: 0 };
const SUMMARY_TIME = { hour: 9, minute: 0 };

// Expo weekly triggers: weekday 1 = Sunday, so Monday–Friday is 2–6.
const WORKDAYS = [2, 3, 4, 5, 6];

const cutoffMins = shiftStartMins + SHIFT.graceMinutes;
const CUTOFF_LABEL = `${((cutoffMins / 60) | 0) % 12 || 12}:${String(cutoffMins % 60).padStart(2, '0')} AM`;

export async function loadPrefs(): Promise<NotifPrefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

/** Persist prefs and bring the scheduled notifications in line with them. */
export async function savePrefs(prefs: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await syncScheduledNotifications(prefs);
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('attendance', {
    name: 'Attendance',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Cancel-and-reschedule all notifications this module owns so they match the
 * given prefs. Safe to call repeatedly (identifiers are stable).
 */
export async function syncScheduledNotifications(prefs: NotifPrefs): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await ensureAndroidChannel();

  const ids = [
    ...WORKDAYS.map((w) => `clock-in-reminder-w${w}`),
    ...WORKDAYS.map((w) => `clock-out-reminder-w${w}`),
    'weekly-summary',
    'monthly-report',
  ];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  const jobs: Promise<string>[] = [];

  if (prefs.clockInReminder) {
    for (const weekday of WORKDAYS) {
      jobs.push(
        Notifications.scheduleNotificationAsync({
          identifier: `clock-in-reminder-w${weekday}`,
          content: {
            title: 'Time to clock in',
            body: `Your shift starts at ${SHIFT.startHour}:${String(SHIFT.startMinute).padStart(2, '0')} — scan the QR code when you arrive.`,
            sound: true,
          },
          trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday, ...CLOCK_IN_REMINDER },
        }),
      );
    }
  }

  if (prefs.clockOutReminder) {
    for (const weekday of WORKDAYS) {
      jobs.push(
        Notifications.scheduleNotificationAsync({
          identifier: `clock-out-reminder-w${weekday}`,
          content: {
            title: 'Wrapping up?',
            body: "Don't forget to clock out before you leave the office.",
            sound: true,
          },
          trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday, ...CLOCK_OUT_REMINDER },
        }),
      );
    }
  }

  if (prefs.weeklySummary) {
    jobs.push(
      Notifications.scheduleNotificationAsync({
        identifier: 'weekly-summary',
        content: {
          title: 'Your week in Clockit',
          body: 'Last week’s hours and attendance are ready — open the app to see your trends.',
          sound: true,
        },
        trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday: 2, ...SUMMARY_TIME },
      }),
    );
  }

  if (prefs.monthlyReport) {
    jobs.push(
      Notifications.scheduleNotificationAsync({
        identifier: 'monthly-report',
        content: {
          title: 'Monthly attendance report',
          body: 'Your full attendance record for last month is ready in Clockit.',
          sound: true,
        },
        trigger: { type: SchedulableTriggerInputTypes.MONTHLY, day: 1, ...SUMMARY_TIME },
      }),
    );
  }

  await Promise.all(jobs);
}

/** Immediate alert after a late clock-in, if the user opted in. */
export async function notifyLateClockIn(clockInIso: string): Promise<void> {
  const prefs = await loadPrefs();
  if (!prefs.lateAlert) return;
  const t = new Date(clockInIso);
  const time = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Late clock-in recorded',
      body: `You clocked in at ${time}, after the ${CUTOFF_LABEL} cutoff.`,
      sound: true,
    },
    trigger: null,
  });
}
