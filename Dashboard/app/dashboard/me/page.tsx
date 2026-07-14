"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarCheck, Clock, MapPin, TrendingUp } from "lucide-react"
import { startOfMonth, format } from "date-fns"

import { PageHeader } from "@/components/ui/page-header"
import { MetricsGrid } from "@/components/ui/metric-card"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { api } from "@/lib/api"
import { formatDate, formatTime, formatHours } from "@/lib/utils"
import { useProfile } from "@/hooks/use-profile"
import type { AttendanceRecord } from "@/lib/types"

export default function MyAttendancePage() {
  const { profile } = useProfile()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .myAttendance(90)
      .then((data) => {
        if (!cancelled) setRecords(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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

      <MetricsGrid metrics={metrics} isLoading={isLoading} />

      <DataTable
        data={records}
        columns={columns}
        emptyMessage="No attendance on record for your account yet. Clock in from the Clockit mobile app and it will show up here."
      />
    </div>
  )
}
