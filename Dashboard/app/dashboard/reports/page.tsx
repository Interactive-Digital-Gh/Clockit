"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isWeekend,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns"
import { Users, UserCheck, Clock, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ExportMenu } from "@/components/export-menu"
import { RequireRole } from "@/components/require-role"
import { api } from "@/lib/api"
import { formatHours, cn } from "@/lib/utils"
import { VIEW_ALL_ROLES, type AttendanceRecord, type Employee } from "@/lib/types"

type Timeframe = "week" | "month" | "year"

interface Bucket {
  label: string
  date: string
  onTime: number
  late: number
  absent: number
}

function periodRange(timeframe: Timeframe, anchor: Date): { start: Date; end: Date } {
  if (timeframe === "week") return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) }
  if (timeframe === "month") return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
  return { start: startOfYear(anchor), end: endOfYear(anchor) }
}

/** Working days (Mon–Fri) in the range that have already happened — the only
 *  days an employee can meaningfully be "absent" on. */
function workingDaysElapsed(start: Date, end: Date): number {
  const today = new Date()
  if (start > today) return 0
  return eachDayOfInterval({ start, end: end < today ? end : today }).filter((d) => !isWeekend(d)).length
}

export default function ReportsPage() {
  return (
    <RequireRole allowed={VIEW_ALL_ROLES}>
      <ReportsPageContent />
    </RequireRole>
  )
}

function ReportsPageContent() {
  const [timeframe, setTimeframe] = useState<Timeframe>("week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { start, end } = useMemo(() => periodRange(timeframe, currentDate), [timeframe, currentDate])

  useEffect(() => {
    let cancelled = false
    api.employees().then((data) => {
      if (!cancelled) setEmployees(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    api
      .attendance({ date_from: format(start, "yyyy-MM-dd"), date_to: format(end, "yyyy-MM-dd") })
      .then((data) => {
        if (!cancelled) setRecords(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [start, end])

  const totalEmployees = employees.length

  const buckets = useMemo<Bucket[]>(() => {
    const result: Bucket[] = []
    let curr = start
    while (curr <= end) {
      let onTime: number
      let late: number
      let absent: number

      if (timeframe === "year") {
        const monthStart = curr
        const monthEnd = endOfMonth(curr)
        const inMonth = records.filter((r) => r.date >= format(monthStart, "yyyy-MM-dd") && r.date <= format(monthEnd, "yyyy-MM-dd"))
        onTime = inMonth.filter((r) => r.status !== "late").length
        late = inMonth.filter((r) => r.status === "late").length
        absent = Math.max(totalEmployees * workingDaysElapsed(monthStart, monthEnd) - onTime - late, 0)
      } else {
        const dateKey = format(curr, "yyyy-MM-dd")
        const dayRecords = records.filter((r) => r.date === dateKey)
        onTime = dayRecords.filter((r) => r.status !== "late").length
        late = dayRecords.filter((r) => r.status === "late").length
        const expected = workingDaysElapsed(curr, curr) > 0 ? totalEmployees : 0
        absent = Math.max(expected - onTime - late, 0)
      }

      result.push({
        label: format(curr, timeframe === "year" ? "MMM" : timeframe === "month" ? "d" : "EEE"),
        date: format(curr, "yyyy-MM-dd"),
        onTime,
        late,
        absent,
      })

      curr = timeframe === "year" ? addMonths(curr, 1) : addDays(curr, 1)
    }
    return result
  }, [start, end, timeframe, records, totalEmployees])

  const metrics = useMemo(() => {
    const totalOnTime = buckets.reduce((sum, b) => sum + b.onTime, 0)
    const totalLate = buckets.reduce((sum, b) => sum + b.late, 0)
    const totalAbsent = buckets.reduce((sum, b) => sum + b.absent, 0)
    const totalSlots = totalOnTime + totalLate + totalAbsent
    const avgAttendance = totalSlots > 0 ? Math.round(((totalOnTime + totalLate) / totalSlots) * 1000) / 10 : 0
    return { avgAttendance, totalOnTime, totalLate, totalAbsent, totalSlots }
  }, [buckets])

  const statusDistribution = useMemo(() => {
    const total = metrics.totalSlots || 1
    return [
      { name: "On Time", value: Math.round((metrics.totalOnTime / total) * 100), color: "bg-green-500" },
      { name: "Late", value: Math.round((metrics.totalLate / total) * 100), color: "bg-yellow-500" },
      { name: "Absent", value: Math.round((metrics.totalAbsent / total) * 100), color: "bg-red-500" },
    ]
  }, [metrics])

  const agencyAttendance = useMemo(() => {
    const daysInRange = workingDaysElapsed(start, end)
    const byAgency = new Map<string, { name: string; empCount: number; present: number }>()
    for (const emp of employees) {
      const key = emp.agency?.id ?? "unassigned"
      const name = emp.agency?.name ?? "Unassigned"
      const entry = byAgency.get(key) ?? { name, empCount: 0, present: 0 }
      entry.empCount += 1
      byAgency.set(key, entry)
    }
    for (const r of records) {
      const key = r.employee?.agency?.id ?? "unassigned"
      const entry = byAgency.get(key)
      if (entry) entry.present += 1
    }
    return Array.from(byAgency.values())
      .filter((a) => a.empCount > 0)
      .map((a) => ({
        agency: a.name,
        attendance: a.empCount * daysInRange > 0 ? Math.round((a.present / (a.empCount * daysInRange)) * 100) : 0,
      }))
  }, [employees, records, start, end])

  const hoursPerEmployee = useMemo(() => {
    const byEmployee = new Map<string, number>()
    for (const r of records) {
      const name = r.employee?.name ?? "Unknown"
      byEmployee.set(name, (byEmployee.get(name) ?? 0) + (r.total_hours ?? 0))
    }
    return Array.from(byEmployee.entries())
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10)
  }, [records])

  const navigate = (direction: "prev" | "next") => {
    if (timeframe === "week") {
      setCurrentDate((prev) => (direction === "prev" ? subDays(prev, 7) : addDays(prev, 7)))
    } else if (timeframe === "month") {
      setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)))
    } else {
      setCurrentDate((prev) => (direction === "prev" ? subYears(prev, 1) : addYears(prev, 1)))
    }
  }

  const goToToday = () => setCurrentDate(new Date())

  const periodLabel = useMemo(() => {
    if (timeframe === "week") return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
    if (timeframe === "month") return format(currentDate, "MMMM yyyy")
    return format(currentDate, "yyyy")
  }, [currentDate, timeframe, start, end])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground">
              {timeframe === "week" && "Weekly trends for "}
              {timeframe === "month" && "Monthly trends for "}
              {timeframe === "year" && "Yearly trends for "}
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger render={<Button variant="link" className="h-auto p-0 font-medium text-foreground underline-offset-4 hover:underline" />}>
                  {periodLabel}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        setCurrentDate(date)
                        setIsCalendarOpen(false)
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ExportMenu records={records} dateRange={{ start, end }} filenamePrefix="attendance_analytics" />

          <div className="flex items-center border rounded-md p-1 bg-muted/40">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate("prev")} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className={cn("h-8 px-2 text-xs font-semibold", isSameDay(currentDate, new Date()) && "bg-background shadow-xs hover:bg-background")}
            >
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => navigate("next")} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={timeframe} onValueChange={(value) => value && setTimeframe(value as Timeframe)}>
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgAttendance}%</div>
            <p className="text-xs text-muted-foreground">
              {timeframe === "week" && "Weekly average"}
              {timeframe === "month" && "Monthly average"}
              {timeframe === "year" && "Yearly average"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Across all agencies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This {timeframe === "week" ? "Week" : timeframe === "month" ? "Month" : "Year"} Late
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalLate}</div>
            <p className="text-xs text-muted-foreground">Late arrivals this {timeframe}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This {timeframe === "week" ? "Week" : timeframe === "month" ? "Month" : "Year"} Absent
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAbsent}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalSlots > 0 ? ((metrics.totalAbsent / metrics.totalSlots) * 100).toFixed(1) : "0.0"}% absence rate
            </p>
          </CardContent>
        </Card>
      </div>

      <AttendanceLineChart timeframe={timeframe} buckets={buckets} periodLabel={periodLabel} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Overall attendance status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 items-center pb-0 pt-8">
            <ChartContainer
              config={{
                onTime: { label: "On Time", color: "hsl(142, 76%, 36%)" },
                late: { label: "Late", color: "hsl(48, 96%, 53%)" },
                absent: { label: "Absent", color: "hsl(0, 84%, 60%)" },
              }}
              className="mx-auto aspect-square h-[250px] w-full"
            >
              <RadialBarChart
                data={[
                  {
                    status: "attendance",
                    onTime: statusDistribution[0].value,
                    late: statusDistribution[1].value,
                    absent: statusDistribution[2].value,
                  },
                ]}
                endAngle={180}
                cx="50%"
                cy="70%"
                innerRadius={110}
                outerRadius={160}
              >
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 16} className="fill-foreground text-2xl font-bold">
                              {metrics.avgAttendance}%
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 4} className="fill-muted-foreground">
                              Attendance
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </PolarRadiusAxis>
                <RadialBar dataKey="onTime" stackId="a" cornerRadius={5} fill="hsl(142, 76%, 36%)" className="stroke-transparent stroke-2" />
                <RadialBar dataKey="late" stackId="a" cornerRadius={5} fill="hsl(48, 96%, 53%)" className="stroke-transparent stroke-2" />
                <RadialBar dataKey="absent" stackId="a" cornerRadius={5} fill="hsl(0, 84%, 60%)" className="stroke-transparent stroke-2" />
              </RadialBarChart>
            </ChartContainer>
          </CardContent>
          <CardContent className="pt-4">
            <div className="flex justify-center gap-4 text-sm flex-wrap">
              {statusDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color} shadow-sm`}></div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">({item.value}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="items-center pb-4">
            <CardTitle>Agency Attendance</CardTitle>
            <CardDescription>Attendance rate by agency</CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            <ChartContainer
              config={{ attendance: { label: "Attendance", color: "hsl(221, 83%, 53%)" } }}
              className="mx-auto aspect-square h-[250px]"
            >
              <RadarChart data={agencyAttendance} margin={{ top: 10, bottom: 10, left: 30, right: 30 }} outerRadius={80}>
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <PolarAngleAxis dataKey="agency" tick={{ fontSize: 11 }} />
                <PolarGrid />
                <Radar dataKey="attendance" fill="hsl(221, 83%, 53%)" fillOpacity={0.6} stroke="hsl(221, 83%, 53%)" strokeWidth={2} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {!isLoading && records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total hours by employee (top 10)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursPerEmployee} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" fontSize={12} tickLine={false} />
                <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} width={120} />
                <Tooltip formatter={(value) => formatHours(Number(value))} />
                <Bar dataKey="hours" fill="oklch(0.488 0.243 264.376)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const lineChartConfig = {
  onTime: { label: "On Time", color: "hsl(142, 76%, 36%)" },
  late: { label: "Late", color: "hsl(48, 96%, 53%)" },
  total: { label: "Total Attendance", color: "hsl(221, 83%, 53%)" },
} satisfies ChartConfig

function AttendanceLineChart({
  timeframe,
  buckets,
  periodLabel,
}: {
  timeframe: Timeframe
  buckets: Bucket[]
  periodLabel: string
}) {
  const [activeChart, setActiveChart] = useState<keyof typeof lineChartConfig>("total")

  const totals = useMemo(
    () => ({
      onTime: buckets.reduce((sum, b) => sum + b.onTime, 0),
      late: buckets.reduce((sum, b) => sum + b.late, 0),
      total: buckets.reduce((sum, b) => sum + b.onTime + b.late, 0),
    }),
    [buckets]
  )

  const chartData = buckets.map((b) => ({ label: b.label, onTime: b.onTime, late: b.late, total: b.onTime + b.late }))

  return (
    <Card className="flex flex-col gap-0 p-0 overflow-hidden">
      <CardHeader className="flex flex-col items-stretch border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>
            {timeframe === "week" && "Weekly Attendance Breakdown"}
            {timeframe === "month" && "Monthly Attendance Breakdown"}
            {timeframe === "year" && "Yearly Attendance Breakdown"}
          </CardTitle>
          <CardDescription>
            Trend analysis for <span className="font-medium text-foreground">{periodLabel}</span>
          </CardDescription>
        </div>
        <div className="flex">
          {(["onTime", "late", "total"] as const).map((key) => (
            <button
              key={key}
              data-active={activeChart === key}
              className="relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6"
              onClick={() => setActiveChart(key)}
            >
              <span className="text-xs text-muted-foreground whitespace-nowrap">{lineChartConfig[key].label}</span>
              <span className="text-lg font-bold leading-none sm:text-3xl">{totals[key].toLocaleString()}</span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer config={lineChartConfig} className="aspect-auto h-[250px] w-full">
          <LineChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
            <YAxis hide padding={{ top: 30 }} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="onTime"
              type="monotone"
              stroke={lineChartConfig.onTime.color}
              strokeWidth={2}
              dot={true}
              strokeOpacity={activeChart === "onTime" ? 1 : 0.5}
            />
            <Line
              dataKey="late"
              type="monotone"
              stroke={lineChartConfig.late.color}
              strokeWidth={2}
              dot={true}
              strokeOpacity={activeChart === "late" ? 1 : 0.5}
            />
            <Line
              dataKey="total"
              type="monotone"
              stroke={lineChartConfig.total.color}
              strokeWidth={2}
              dot={true}
              strokeOpacity={activeChart === "total" ? 1 : 0.5}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
