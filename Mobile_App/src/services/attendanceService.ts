// Data layer for the mobile app. Talks to the Clockit FastAPI backend (was
// Supabase). Function signatures/types are unchanged so screens don't need to.
//
// The backend identifies the employee from the bearer token, so the
// `employeeId`/`agencyId` params below are accepted for signature compatibility
// but the "me" endpoints use the token's identity.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { googleSignIn } from '../lib/googleAuth';
import { ATTENDANCE_QR_PAYLOAD } from '../config/attendance';
import { getLocalIpAddress } from '../utils/networkCheck';
import { getDeviceLocation, getBackgroundLocationIfAvailable } from '../utils/locationCheck';

const QR_CACHE_KEY = '@attendance:qr_token';

/**
 * The QR token the scanner should accept. Fetched from the server (admins can
 * rotate it from the dashboard); falls back to the last cached value, then to
 * the built-in seed token, so scanning still works offline.
 */
export async function fetchAttendanceQrToken(): Promise<string> {
  try {
    const { token } = await api.getAttendanceQr();
    await AsyncStorage.setItem(QR_CACHE_KEY, token);
    return token;
  } catch {
    return (await AsyncStorage.getItem(QR_CACHE_KEY)) ?? ATTENDANCE_QR_PAYLOAD;
  }
}

export interface EmployeeRecord {
  id: string;
  name: string;
  email: string | null;
  emp_id: string | null;
  job_title: string | null;
  agency_id: string | null;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  status: string;
  total_hours: number | null;
  location_verified?: boolean;
  verification_source?: string;
}

/**
 * Google sign-in: runs the native flow, exchanges the Google ID token for our
 * JWT, and returns the employee record (created/claimed by email server-side).
 * Returns null if the user cancelled the Google flow.
 */
export async function googleSignInEmployee(): Promise<EmployeeRecord | null> {
  const identity = await googleSignIn();
  if (!identity) return null;
  await api.googleLoginEmployee(identity.idToken);
  const e = await api.getMyEmployee();
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    emp_id: e.emp_id,
    job_title: e.job_title,
    agency_id: e.agency_id,
  };
}

/**
 * Dev sign-in (email only — works while the API runs with DEV_MODE=true) and
 * returns the employee record. The backend creates/claims the employee row on
 * login. If a name is given and differs from the server's (e.g. the row was
 * auto-created at the login step before onboarding), it is written back.
 */
export async function findOrCreateEmployee(
  name: string,
  email: string,
): Promise<EmployeeRecord> {
  await api.devLoginEmployee(email, name);
  let e = await api.getMyEmployee();
  if (name.trim() && e.name !== name.trim()) {
    e = await api.updateMe({ name: name.trim() });
  }
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    emp_id: e.emp_id,
    job_title: e.job_title,
    agency_id: e.agency_id,
  };
}

/**
 * Finish onboarding for the already-signed-in employee: persist name and
 * department server-side. A saved job_title is what marks the account as
 * established, so later sign-ins skip the onboarding screen.
 */
export async function completeOnboarding(
  name: string,
  department: string,
): Promise<EmployeeRecord> {
  const e = await api.updateMe({ name: name.trim(), job_title: department });
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    emp_id: e.emp_id,
    job_title: e.job_title,
    agency_id: e.agency_id,
  };
}

/** Today's attendance row for the employee, or null if not yet clocked in. */
export async function fetchTodayAttendance(
  _employeeId: string,
): Promise<AttendanceRecord | null> {
  return api.todayAttendance();
}

/**
 * Clock in. Never blocked by the server — the reported LAN IP, GPS position
 * (plus the server-observed public IP) are used to tag the record on-site vs
 * remote.
 *
 * `background: true` (used by the auto clock-in task) reads GPS only if the
 * app already has "Always" permission, without ever prompting — a
 * foreground permission prompt firing from a headless background task would
 * be confusing UX at best. Manual clock-in (the default) still prompts as
 * normal, since that's an explicit foreground action.
 */
export async function clockInEmployee(
  _employeeId: string,
  background = false,
): Promise<AttendanceRecord> {
  const [localIp, location] = await Promise.all([
    getLocalIpAddress(),
    background ? getBackgroundLocationIfAvailable() : getDeviceLocation(),
  ]);
  return api.clockIn(localIp, location);
}

/** Close today's open clock-in. */
export async function clockOutEmployee(
  _employeeId: string,
): Promise<AttendanceRecord> {
  return api.clockOut();
}

/** Retained for compatibility; email-domain gating is handled server-side now. */
export async function fetchEmailDomains(): Promise<string[]> {
  return [];
}

/**
 * Allowed LAN subnets for the employee's agency (used by the auto clock-out
 * network check). Reads the employee's own agency.
 */
export async function fetchAgencyAllowedSubnets(_agencyId: string): Promise<string[]> {
  try {
    const agency = await api.getMyAgency();
    return agency.network_config?.allowed_subnets ?? [];
  } catch {
    return [];
  }
}

export interface AgencyGeofence {
  latitude: number;
  longitude: number;
  radiusM: number;
}

/** The employee's agency GPS geofence, if the admin has configured one. */
export async function fetchAgencyGeofence(_agencyId: string): Promise<AgencyGeofence | null> {
  try {
    const agency = await api.getMyAgency();
    if (agency.latitude == null || agency.longitude == null) return null;
    return {
      latitude: agency.latitude,
      longitude: agency.longitude,
      radiusM: agency.geofence_radius_m ?? 150,
    };
  } catch {
    return null;
  }
}

export interface EmployeeDetails {
  emp_id: string | null;
  name: string;
  email: string | null;
  job_title: string | null;
  employment_type: string | null;
  date_join: string | null;
  is_active: boolean;
}

export interface AgencyDetails {
  id: string;
  name: string;
  agency_code: string | null;
  address: string | null;
  network_config: { allowed_subnets: string[]; description?: string } | null;
}

/** Full employee profile for the Account Details screen. */
export async function fetchEmployeeDetails(_employeeId: string): Promise<EmployeeDetails> {
  const e = await api.getMyEmployee();
  return {
    emp_id: e.emp_id,
    name: e.name,
    email: e.email,
    job_title: e.job_title,
    employment_type: e.employment_type,
    date_join: e.date_join,
    is_active: e.is_active,
  };
}

/** Agency info for the Workplace screen. */
export async function fetchAgencyDetails(_agencyId: string): Promise<AgencyDetails> {
  const a = await api.getMyAgency();
  return {
    id: a.id,
    name: a.name,
    agency_code: a.agency_code,
    address: a.address,
    network_config: a.network_config
      ? {
          allowed_subnets: a.network_config.allowed_subnets ?? [],
          description: a.network_config.description,
        }
      : null,
  };
}

/** Recent attendance for the employee (default last 30). */
export async function fetchAttendanceHistory(
  _employeeId: string,
  limit = 30,
): Promise<AttendanceRecord[]> {
  return api.history(limit);
}
