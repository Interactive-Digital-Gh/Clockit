// API client for the Clockit backend. Replaces the direct Supabase access the
// app used to do. Auth is a bearer JWT kept in AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set EXPO_PUBLIC_API_URL in Mobile_App/.env (e.g. https://clockit-api.yourdomain
// in prod, or http://<your-laptop-LAN-IP>:8010 for local testing on the phone).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const TOKEN_KEY = '@attendance:token';
const REFRESH_KEY = '@attendance:refresh_token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function setToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}
export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setRefreshToken(token: string) {
  await AsyncStorage.setItem(REFRESH_KEY, token);
}
export async function clearToken() {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
}

// Access tokens expire after 12h; the refresh token (30 days) silently mints
// a new one on the first 401 so users don't get logged out mid-week. Shared
// promise so concurrent 401s trigger a single refresh.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;
    const { access_token } = await res.json();
    await setToken(access_token);
    return access_token;
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  if (!API_URL) {
    throw new ApiError('EXPO_PUBLIC_API_URL is not set — point it at the backend.', 0);
  }
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && !isRetry && token) {
    refreshInFlight = refreshInFlight ?? refreshAccessToken();
    const renewed = await refreshInFlight;
    refreshInFlight = null;
    if (renewed) return apiFetch<T>(path, options, true);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Response shapes (subset of the backend schemas) ------------------------
export interface ApiEmployee {
  id: string;
  name: string;
  email: string | null;
  emp_id: string | null;
  job_title: string | null;
  employment_type: string | null;
  date_join: string | null;
  agency_id: string | null;
  is_active: boolean;
  agency: { id: string; name: string } | null;
}

export interface ApiAgency {
  id: string;
  name: string;
  agency_code: string | null;
  address: string | null;
  network_config: {
    allowed_public_ips?: string[];
    allowed_subnets?: string[];
    description?: string;
  } | null;
}

export interface ApiAttendance {
  id: string;
  date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  status: string;
  total_hours: number | null;
  location_verified: boolean;
  verification_source: string;
}

export const api = {
  async devLoginEmployee(email: string, name?: string) {
    const { access_token, refresh_token } = await apiFetch<{
      access_token: string;
      refresh_token?: string;
    }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email, name, as_type: 'employee' }),
    });
    await setToken(access_token);
    if (refresh_token) await setRefreshToken(refresh_token);
    return access_token;
  },
  /** Exchange a Google ID token (from native Google Sign-In) for our JWT. */
  async googleLoginEmployee(idToken: string) {
    const { access_token, refresh_token } = await apiFetch<{
      access_token: string;
      refresh_token?: string;
    }>('/auth/google/employee', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
    await setToken(access_token);
    if (refresh_token) await setRefreshToken(refresh_token);
    return access_token;
  },
  /** Active attendance QR token — the scanner validates scans against this. */
  getAttendanceQr: () => apiFetch<{ token: string }>('/attendance/qr/current'),
  getMyEmployee: () => apiFetch<ApiEmployee>('/employees/me'),
  updateMe: (fields: { name?: string; job_title?: string }) =>
    apiFetch<ApiEmployee>('/employees/me', {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
  getMyAgency: () => apiFetch<ApiAgency>('/agencies/me'),
  todayAttendance: () => apiFetch<ApiAttendance | null>('/attendance/me/today'),
  history: (limit = 30) => apiFetch<ApiAttendance[]>(`/attendance/me/history?limit=${limit}`),
  clockIn: (
    localIp: string | null,
    location?: { latitude: number; longitude: number; accuracyM: number | null } | null,
  ) =>
    apiFetch<ApiAttendance>('/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({
        local_ip: localIp,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        location_accuracy_m: location?.accuracyM ?? null,
      }),
    }),
  clockOut: () => apiFetch<ApiAttendance>('/attendance/clock-out', { method: 'POST' }),
  registerPushToken: (token: string, platform: string) =>
    apiFetch<void>('/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),
  clearToken,
};
