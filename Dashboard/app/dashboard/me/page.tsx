"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarCheck, Clock, Loader2, MapPin, TrendingUp } from "lucide-react"
import { startOfMonth, format } from "date-fns"

import { PageHeader } from "@/components/ui/page-header"
import { MetricsGrid } from "@/components/ui/metric-card"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api"
import { formatDate, formatTime, formatHours } from "@/lib/utils"
import { useProfile } from "@/hooks/use-profile"
import type { AttendanceRecord } from "@/lib/types"
import { toast } from "sonner"

interface ClockLocation {
  latitude?: number | null
  longitude?: number | null
  location_accuracy_m?: number | null
}

// Best-effort GPS read — never blocks clock-in. Resolves to nulls on denial,
// timeout, or an unsupported browser.
function getLocation(): Promise<ClockLocation> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({})
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location_accuracy_m: pos.coords.accuracy,
        }),
      () => resolve({}),
      { timeout: 5000, maximumAge: 60_000 },
    )
  })
}

export default function MyAttendancePage() {
  const { profile } = useProfile()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [working, setWorking] = useState(false)

  const refresh = useCallback(() => {
    return Promise.all([api.myToday(), api.myAttendance(90)]).then(([todayRecord, history]) => {
      setToday(todayRecord)
      setRecords(history)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([api.myToday(), api.myAttendance(90)])
      .then(([todayRecord, history]) => {
        if (cancelled) return
        setToday(todayRecord)
        setRecords(history)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isClockedIn = !!today && !today.clock_out_time

  const handleClockIn = async () => {
    setWorking(true)
    try {
      const location = await getLocation()
      await api.myClockIn(location)
      await refresh()
      toast.success("Clocked in")
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Could not clock in — try again.")
    } finally {
      setWorking(false)
    }
  }

  const handleClockOut = async () => {
    setWorking(true)
    try {
      await api.myClockOut()
      await refresh()
      toast.success("Clocked out")
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        toast.info("Already clocked out — refreshing.")
        await refresh()
      } else {
        toast.error(error instanceof ApiError ? error.message : "Could not clock out — try again.")
      }
    } finally {
      setWorking(false)
    }
  }

  const metrics = useMemo(() => {
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd")
    const thisMonth = records.filter((r) => r.date >= monthStart)
    const hours = thisMonth.reduce((sum, r) => sum + (r.total_hours ?? 0), 0)
    const late = thisMonth.filter((r) => r.status === "late").length
    const onTime = records.length
      ? Math.round((records.filter((r) => r.status !== "late").length / records.length) * 100)
      : 0
    const onSite = records.length
      ? Math.round((records.filter((r) => r.location_verified).length / records.length) * 100)
      : 0
    return [
      { title: "Hours this month", value: formatHours(hours), subtitle: `${thisMonth.length} days present`, icon: Clock },
      { title: "Late this month", value: late, subtitle: "After the shift cutoff", icon: CalendarCheck },
      { title: "On-time rate", value: `${onTime}%`, subtitle: "All records on file", icon: TrendingUp },
      { title: "On-site rate", value: `${onSite}%`, subtitle: "Verified office clock-ins", icon: MapPin },
    ]
  }, [records])

  const columns: ColumnDef<AttendanceRecord>[] = [
    { key: "date", header: "Date", render: (row) => formatDate(row.date) },
    { key: "clock_in", header: "Clock in", render: (row) => formatTime(row.clock_in_time) },
    { key: "clock_out", header: "Clock out", render: (row) => formatTime(row.clock_out_time) },
    {
      key: "location",
      header: "Location",
      render: (row) => (
        <span
          className={
            row.location_verified
              ? "px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-xs bg-emerald-50 text-emerald-700 border-emerald-200"
              : "px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-xs bg-amber-50 text-amber-700 border-amber-200"
          }
        >
          {row.location_verified ? "On-site" : "Remote"}
        </span>
      ),
    },
    { key: "hours", header: "Hours", align: "right", render: (row) => formatHours(row.total_hours) },
    { key: "status", header: "Status", align: "right", render: (row) => <StatusBadge status={row.status} variant="pill" /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="My attendance"
        description={
          profile?.full_name
            ? `Your own clock-ins and hours, ${profile.full_name.split(" ")[0]} — nobody else's.`
            : "Your own clock-ins and hours."
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              "Loading today's status…"
            ) : today ? (
              <>
                Clocked in at {formatTime(today.clock_in_time)}
                {today.clock_out_time && <> · out at {formatTime(today.clock_out_time)}</>}
                {today.total_hours != null && <> · {formatHours(today.total_hours)} today</>}
              </>
            ) : (
              "You haven't clocked in yet today."
            )}
          </div>
          <Button
            size="lg"
            className="sm:w-40"
            variant={isClockedIn ? "destructive" : "default"}
            disabled={isLoading || working}
            onClick={isClockedIn ? handleClockOut : handleClockIn}
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isClockedIn ? (
              "Clock Out"
            ) : (
              "Clock In"
            )}
          </Button>
        </CardContent>
      </Card>

      <MetricsGrid metrics={metrics} isLoading={isLoading} />

      <DataTable
        data={records}
        columns={columns}
        emptyMessage="No attendance on record for your account yet. Clock in above and it will show up here."
      />
    </div>
  )
}
