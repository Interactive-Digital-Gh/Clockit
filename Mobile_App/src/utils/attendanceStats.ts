import { AttendanceRecord } from '../services/attendanceService';
import { COLORS } from '../constants/colors';

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface DisplayRecord {
  id: string;
  mon: string;
  day: string;
  weekday: string;
  clockIn: string;
  clockOut: string;
  hours: string;
  status: string;
  statusColor: string;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function toDisplayRecord(r: AttendanceRecord): DisplayRecord {
  const d = new Date(`${r.date}T00:00:00`);
  const isLate = r.status?.toLowerCase() === 'late';
  const isAbsent = r.status?.toLowerCase() === 'absent';

  return {
    id: r.id,
    mon: MONTH_ABBR[d.getMonth()],
    day: String(d.getDate()),
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    clockIn: fmtTime(r.clock_in_time),
    clockOut: fmtTime(r.clock_out_time),
    hours: r.total_hours != null ? `${r.total_hours.toFixed(1)}h` : '—',
    status: isAbsent ? 'Absent' : isLate ? 'Late' : 'On time',
    statusColor: isAbsent ? COLORS.red : isLate ? COLORS.orange : COLORS.green,
  };
}

/** Monday of the current week, at midnight. */
export function startOfWeek(from = new Date()): Date {
  const date = new Date(from);
  const day = date.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), 1);
}

export function isOnOrAfter(dateStr: string, from: Date): boolean {
  return new Date(`${dateStr}T00:00:00`) >= from;
}

export function sumHours(records: AttendanceRecord[]): number {
  return records.reduce((total, r) => total + (r.total_hours ?? 0), 0);
}

/** Percentage of records not marked late, rounded. Null if there's no data yet. */
export function onTimeRate(records: AttendanceRecord[]): number | null {
  if (records.length === 0) return null;
  const onTime = records.filter((r) => r.status?.toLowerCase() !== 'late').length;
  return Math.round((onTime / records.length) * 100);
}
