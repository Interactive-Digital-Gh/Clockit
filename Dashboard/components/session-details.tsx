"use client"

import { Badge } from "@/components/ui/badge"
import { formatTime, formatHours, cn } from "@/lib/utils"
import type { AttendanceSession } from "@/lib/types"

// Shared with the top-level day-summary location badge — one source of truth
// for the tooltip copy per verification source.
export const LOCATION_TITLE: Record<string, string> = {
  office_ip: "Verified — request came from the office network",
  office_gps: "Verified — device GPS was within the office geofence",
  office_subnet: "Verified — device reported an office WiFi subnet",
  off_site: "Remote — clocked in off the office network",
}

export function LocationBadge({
  locationVerified,
  verificationSource,
}: {
  locationVerified?: boolean
  verificationSource?: string
}) {
  const source = verificationSource ?? "off_site"
  return (
    <Badge
      variant="outline"
      title={LOCATION_TITLE[source]}
      className={cn(
        locationVerified
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      )}
    >
      {locationVerified ? "On-site" : "Remote"}
    </Badge>
  )
}

function sessionDurationHours(session: AttendanceSession): number | null {
  if (!session.clock_out_time) return null
  const ms = new Date(session.clock_out_time).getTime() - new Date(session.clock_in_time).getTime()
  return ms / 1000 / 3600
}

/** Per-session breakdown for a multi-session day — clock-in/out time, duration, and
 * on-site/remote badge for each individual session, oldest first. */
export function SessionDetails({ sessions }: { sessions: AttendanceSession[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No session detail available.</p>
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.clock_in_time).getTime() - new Date(b.clock_in_time).getTime()
  )

  return (
    <div className="grid gap-2">
      {sorted.map((session, i) => (
        <div
          key={session.id}
          className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <span className="font-medium text-foreground">Session {i + 1}</span>
          <span className="text-muted-foreground">
            {formatTime(session.clock_in_time)}
            {" – "}
            {session.clock_out_time ? formatTime(session.clock_out_time) : "still clocked in"}
          </span>
          <span className="text-muted-foreground">{formatHours(sessionDurationHours(session))}</span>
          <LocationBadge
            locationVerified={session.location_verified}
            verificationSource={session.verification_source}
          />
        </div>
      ))}
    </div>
  )
}
