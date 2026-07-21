// API client for the Clockit FastAPI backend. Replaces the direct Supabase
// access the dashboard used to do. Auth is a bearer JWT stored in a cookie so
// both client fetches (below) and the proxy/middleware can read it.

import type { Agency, AttendanceQrToken, AttendanceRecord, Employee, Profile, Role } from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010"

export const TOKEN_COOKIE = "clockit_token"
const TOKEN_MAX_AGE = 60 * 60 * 12 // 12h, matches backend access token

export function setToken(token: string) {
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE}; samesite=lax`
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function clearToken() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    clearToken()
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login"
    }
    throw new ApiError("Session expired — please sign in again.", 401)
  }

  if (!res.ok) {
    const detail = await res
      .json()
      .then((d) => (typeof d?.detail === "string" ? d.detail : null))
      .catch(() => null)
    throw new ApiError(detail ?? res.statusText, res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// --- Response shapes not already in lib/types --------------------------------
export interface OverviewMetrics {
  employees: number
  agencies: number
  clocked_in_today: number
  late_today: number
}

export interface AttendanceQuery {
  date_from?: string // YYYY-MM-DD
  date_to?: string
  on_date?: string
  agency_id?: string
  status?: "present" | "late"
  limit?: number
}

// --- API -----------------------------------------------------------------
export const api = {
  // Auth
  async devLogin(email: string, asType: "admin" | "employee" = "admin") {
    const { access_token } = await apiFetch<{ access_token: string }>("/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ email, as_type: asType }),
    })
    setToken(access_token)
    return access_token
  },
  /** Exchange a Google ID token (from Google Identity Services) for our JWT. */
  async googleLogin(idToken: string) {
    const { access_token } = await apiFetch<{ access_token: string }>("/auth/google/admin", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    })
    setToken(access_token)
    return access_token
  },
  logout() {
    clearToken()
  },
  me: () => apiFetch<Profile>("/profiles/me"),
  /** The signed-in user's own attendance (any role). */
  myAttendance: (limit = 60) => apiFetch<AttendanceRecord[]>(`/attendance/my?limit=${limit}`),

  // Attendance QR management (admin roles)
  attendanceQr: () => apiFetch<AttendanceQrToken>("/attendance/qr"),
  rotateAttendanceQr: () => apiFetch<AttendanceQrToken>("/attendance/qr/rotate", { method: "POST" }),

  // Data
  overview: () => apiFetch<OverviewMetrics>("/reports/overview"),
  employees: () => apiFetch<Employee[]>("/employees"),
  agencies: () => apiFetch<Agency[]>("/agencies"),
  profiles: () => apiFetch<Profile[]>("/profiles"),

  attendance(query: AttendanceQuery = {}) {
    const params = new URLSearchParams()
    if (query.date_from) params.set("date_from", query.date_from)
    if (query.date_to) params.set("date_to", query.date_to)
    if (query.on_date) params.set("on_date", query.on_date)
    if (query.agency_id) params.set("agency_id", query.agency_id)
    if (query.status) params.set("status", query.status)
    params.set("limit", String(query.limit ?? 5000))
    return apiFetch<AttendanceRecord[]>(`/attendance?${params.toString()}`)
  },

  createAgency: (body: { name: string; agency_code?: string; address?: string }) =>
    apiFetch<Agency>("/agencies", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAgency: (id: string, body: { name?: string; agency_code?: string | null; address?: string | null }) =>
    apiFetch<Agency>(`/agencies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAgency: (id: string) => apiFetch<undefined>(`/agencies/${id}`, { method: "DELETE" }),
  updateAgencyNetworkConfig: (id: string, network_config: Agency["network_config"]) =>
    apiFetch<Agency>(`/agencies/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ network_config }),
    }),
  updateAgencyLocation: (
    id: string,
    body: { latitude: number | null; longitude: number | null; geofence_radius_m: number | null },
  ) =>
    apiFetch<Agency>(`/agencies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  updateProfileRole: (id: string, role: Role) =>
    apiFetch<Profile>(`/profiles/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
}
