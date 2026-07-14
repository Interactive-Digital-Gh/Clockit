"use client"

import { useEffect, useState } from "react"
import { UsersRound, Building2, LogIn, Clock } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { MetricsGrid } from "@/components/ui/metric-card"
import { AttendanceFeed } from "@/components/attendance-feed"
import { api } from "@/lib/api"

export default function OverviewPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [employeeCount, setEmployeeCount] = useState(0)
  const [agencyCount, setAgencyCount] = useState(0)
  const [clockedInToday, setClockedInToday] = useState(0)
  const [lateToday, setLateToday] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .overview()
      .then((m) => {
        if (cancelled) return
        setEmployeeCount(m.employees)
        setAgencyCount(m.agencies)
        setClockedInToday(m.clocked_in_today)
        setLateToday(m.late_today)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="A snapshot of employees, agencies, and today's attendance." />
      <MetricsGrid
        isLoading={isLoading}
        metrics={[
          { title: "Total employees", value: employeeCount, icon: UsersRound },
          { title: "Agencies", value: agencyCount, icon: Building2 },
          { title: "Clocked in today", value: clockedInToday, subtitle: "Still on the clock", icon: LogIn },
          { title: "Late today", value: lateToday, subtitle: "After the shift cutoff", icon: Clock },
        ]}
      />
      <AttendanceFeed />
    </div>
  )
}
