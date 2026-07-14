// API client for the Clockit backend. Replaces the direct Supabase access the
// app used to do. Auth is a bearer JWT kept in AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set EXPO_PUBLIC_API_URL in Mobile_App/.env (e.g. https://clockit-api.yourdomain
// in prod, or http://<your-laptop-LAN-IP>:8010 for local testing on the phone).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const TOKEN_KEY = '@attendance:token';

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
export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    allowed_ssids?: string[];
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
    const { access_token } = await apiFetch<{ access_token: string }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email, name, as_type: 'employee' }),
    });
    await setToken(access_token);
    return access_token;
  },
  /** Exchange a Google ID token (from native Google Sign-In) for our JWT. */
  async googleLoginEmployee(idToken: string) {
    const { access_token } = await apiFetch<{ access_token: string }>('/auth/google/employee', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
    await setToken(access_token);
    return access_token;
  },
  getMyEmployee: () => apiFetch<ApiEmployee>('/employees/me'),
  updateMyName: (name: string) =>
    apiFetch<ApiEmployee>('/employees/me', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  getMyAgency: () => apiFetch<ApiAgency>('/agencies/me'),
  todayAttendance: () => apiFetch<ApiAttendance | null>('/attendance/me/today'),
  history: (limit = 30) => apiFetch<ApiAttendance[]>(`/attendance/me/history?limit=${limit}`),
  clockIn: (localIp: string | null) =>
    apiFetch<ApiAttendance>('/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({ local_ip: localIp }),
    }),
  clockOut: () => apiFetch<ApiAttendance>('/attendance/clock-out', { method: 'POST' }),
  clearToken,
};
