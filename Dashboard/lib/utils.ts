import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function capitalize(str: string | null | undefined): string {
  if (!str) return ""
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return ""
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`
}

export const DATE_FORMATS = {
  DISPLAY: "MMM d, yyyy",
  DISPLAY_FULL: "MMMM dd, yyyy",
  API: "yyyy-MM-dd",
  TIME: "h:mm a",
  TIME_24: "HH:mm",
  DATETIME: "MMM d, yyyy h:mm a",
} as const

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value
}

export function formatDate(value: string | Date | null | undefined, pattern: string = DATE_FORMATS.DISPLAY): string {
  if (!value) return "—"
  const date = toDate(value)
  return isValid(date) ? format(date, pattern) : "—"
}

export function formatTime(value: string | Date | null | undefined, use24Hour = false): string {
  if (!value) return "—"
  const date = toDate(value)
  return isValid(date) ? format(date, use24Hour ? DATE_FORMATS.TIME_24 : DATE_FORMATS.TIME) : "—"
}

export function formatHours(hours: number | null | undefined, decimals = 1): string {
  if (hours == null) return "—"
  return `${hours.toFixed(decimals)}h`
}

/** Attendance status vocabulary the mobile app actually writes — see Mobile_App/src/config/attendance.ts */
export const ATTENDANCE_STATUS = {
  present: { label: "On time", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  late: { label: "Late", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
} as const

export type AttendanceStatusKey = keyof typeof ATTENDANCE_STATUS
