// Mirrors the shapes in Mobile_App/src/services/attendanceService.ts —
// this dashboard reads the exact same Supabase project/tables.

export interface Agency {
  id: string
  name: string
  agency_code: string | null
  address: string | null
  is_active: boolean | null
  network_config: {
    allowed_public_ips?: string[]
    allowed_subnets?: string[]
    description?: string
  } | null
  latitude: number | null
  longitude: number | null
  geofence_radius_m: number | null
}

export interface Employee {
  id: string
  name: string
  email: string | null
  emp_id: string | null
  job_title: string | null
  agency_id: string | null
  is_active: boolean | null
  agency?: Pick<Agency, "id" | "name"> | null
}

export interface AttendanceRecord {
  id: string
  date: string
  clock_in_time: string
  clock_out_time: string | null
  status: string
  total_hours: number | null
  employee_id: string
  location_verified?: boolean
  verification_source?: "office_ip" | "office_gps" | "office_subnet" | "off_site"
  clock_in_public_ip?: string | null
  clock_in_local_ip?: string | null
  clock_in_latitude?: number | null
  clock_in_longitude?: number | null
  employee?: Pick<Employee, "id" | "name" | "email" | "agency"> | null
}

export type Role = "super_admin" | "it" | "hr" | "front_desk" | "employee"

export interface AttendanceQrToken {
  token: string
  created_at: string | null
  rotated_by: string | null
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string | null
}

export type NotificationStatus = "scheduled" | "sent" | "canceled"

export interface AdminNotification {
  id: string
  title: string
  body: string
  created_by: string
  status: NotificationStatus
  scheduled_for: string | null
  sent_at: string | null
  recipient_count: number | null
  created_at: string
}

export const ADMIN_ROLES: Role[] = ["super_admin", "it", "hr"]
export const USER_MANAGER_ROLES: Role[] = ["super_admin", "it"]
// Roles that may browse other people's attendance. "employee" gets only the
// personal My-attendance view.
export const VIEW_ALL_ROLES: Role[] = ["super_admin", "it", "hr", "front_desk"]
