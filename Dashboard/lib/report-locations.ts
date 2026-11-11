import type { AttendanceRecord, Employee, WorkSchedule } from "./types"

export const SCHEDULE_NOTE = "Planned locations use current schedules; historical schedules are not stored. Remote / unverified is not proof of remote work."
export type ReportRecord = AttendanceRecord & { planned?: string; actual?: string; schedule_check?: string; missing?: boolean }
export function plannedMode(schedule: WorkSchedule | null | undefined, date: string) {
  if (!schedule || date < schedule.starts_on) return undefined
  const day = new Date(`${date}T12:00:00Z`)
  const weekday = (day.getUTCDay() + 6) % 7
  const week = schedule.pattern === "monthly" ? Math.floor((day.getUTCDate() - 1) / 7)
    : Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${schedule.starts_on}T00:00:00Z`)) / 604800000) % schedule.weeks.length
  return schedule.weeks[week]?.[weekday]
}
export function prepareReportRows(records: AttendanceRecord[], employees?: Employee[], range?: { start: Date; end: Date }): ReportRecord[] {
  const roster = new Map(employees?.map((employee) => [employee.id, employee]))
  const rows = [...records] as ReportRecord[]
  if (employees && range) {
    const present = new Set(records.map((r) => `${r.employee_id}:${r.date}`))
    const day = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), 12)
    while (day <= range.end || day.toDateString() === range.end.toDateString()) {
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
      for (const employee of employees.filter((e) => e.is_active !== false)) {
        if (!present.has(`${employee.id}:${date}`)) rows.push({ id: `schedule:${employee.id}:${date}`, employee_id: employee.id, employee, date, clock_in_time: "", clock_out_time: null, status: "No clock-in", total_hours: null, missing: true })
      }
      day.setDate(day.getDate() + 1)
    }
  }
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  return rows.map((row) => {
    const mode = plannedMode(roster.get(row.employee_id)?.work_schedule ?? row.employee?.work_schedule, row.date)
    const sessions = row.sessions?.length ? row.sessions : [row]
    const onSite = sessions.some((s) => s.location_verified === true)
    const unverified = sessions.some((s) => s.location_verified !== true)
    const actual = row.missing ? "No clock-in" : row.location_verified === undefined && !row.sessions?.length ? "Unknown" : onSite && unverified ? "Mixed on-site / unverified" : onSite ? "On-site" : "Remote / unverified"
    const check = row.missing ? row.date > today ? "Not yet due" : mode === "off" ? "Not scheduled" : mode ? "No clock-in" : "Schedule not set"
      : mode === "office" && !onSite ? "Office expected; unverified" : mode === "remote" && onSite ? "Remote planned; on-site recorded" : mode === "off" ? "Off-duty clock-in" : !mode ? "Schedule not set" : "Recorded"
    return { ...row, planned: mode === "office" ? "Office" : mode === "remote" ? "Remote" : mode === "off" ? "Off duty" : "Not set", actual, schedule_check: check }
  }).sort((a, b) => a.date.localeCompare(b.date) || (a.employee?.name ?? "").localeCompare(b.employee?.name ?? ""))
}
