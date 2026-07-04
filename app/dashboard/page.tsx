"use client"

import { useEffect, useState } from "react"
import { UsersRound, Building2, LogIn, Clock } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { MetricsGrid } from "@/components/ui/metric-card"
import { AttendanceFeed } from "@/components/attendance-feed"
import { supabase } from "@/lib/supabase/client"

function todayDate() {
  return new Date().toISOString().split("T")[0]
}

export default function OverviewPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [employeeCount, setEmployeeCount] = useState(0)
  const [agencyCount, setAgencyCount] = useState(0)
  const [clockedInToday, setClockedInToday] = useState(0)
  const [lateToday, setLateToday] = useState(0)

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true)
      const today = todayDate()

      const [{ count: employees }, { count: agencies }, { count: clockedIn }, { count: late }] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("agencies").select("*", { count: "exact", head: true }),
        supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("date", today)
          .is("clock_out_time", null),
        supabase.from("attendance_records").select("*", { count: "exact", head: true }).eq("date", today).eq("status", "late"),
      ])

      setEmployeeCount(employees ?? 0)
      setAgencyCount(agencies ?? 0)
      setClockedInToday(clockedIn ?? 0)
      setLateToday(late ?? 0)
      setIsLoading(false)
    }
    fetchMetrics()
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
