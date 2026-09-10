export const SHIFT = {
  startHour: 8,
  startMinute: 30,
  graceMinutes: 5,
};

// The attendance QR token is no longer a baked-in constant — it rotates
// (admin-set interval or manual) and is fetched live from the server, cached
// via fetchAttendanceQrToken() in services/attendanceService.ts.

/** True if a clock-in at `clockInIso` is past the shift start + grace period. */
export function isLateClockIn(clockInIso: string): boolean {
  const clockIn = new Date(clockInIso);
  const cutoff = new Date(clockIn);
  cutoff.setHours(SHIFT.startHour, SHIFT.startMinute + SHIFT.graceMinutes, 0, 0);
  return clockIn > cutoff;
}
