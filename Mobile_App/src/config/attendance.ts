export const SHIFT = {
  startHour: 8,
  startMinute: 30,
  graceMinutes: 5,
};

/**
 * Payload of the official attendance QR code (attendance-qr-code.png at the
 * repo root — regenerate it if this ever changes). Scanning it is one of the
 * three clock-in verifications: QR scan, office-network check, manual tap.
 */
export const ATTENDANCE_QR_PAYLOAD = 'clockit:attendance:interactive-digital:v1';

/** True if a clock-in at `clockInIso` is past the shift start + grace period. */
export function isLateClockIn(clockInIso: string): boolean {
  const clockIn = new Date(clockInIso);
  const cutoff = new Date(clockIn);
  cutoff.setHours(SHIFT.startHour, SHIFT.startMinute + SHIFT.graceMinutes, 0, 0);
  return clockIn > cutoff;
}
