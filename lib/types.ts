// Mirrors the shapes in attendance-app/src/services/attendanceService.ts —
// this dashboard reads the exact same Supabase project/tables.

export interface Agency {
  id: string
  name: string
  agency_code: string | null
  address: string | null
  is_active: boolean | null
  network_config: { allowed_subnets?: string[]; allowed_ssids?: string[]; description?: string } | null
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
  employee?: Pick<Employee, "id" | "name" | "email" | "agency"> | null
}

export type Role = "super_admin" | "it" | "hr" | "front_desk"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string | null
}

export const ADMIN_ROLES: Role[] = ["super_admin", "it", "hr"]
export const USER_MANAGER_ROLES: Role[] = ["super_admin", "it"]
