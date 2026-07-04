"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { SearchInput } from "@/components/ui/search-input"
import { DataTable, useTableSort, type ColumnDef } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ExportMenu } from "@/components/export-menu"
import { supabase } from "@/lib/supabase/client"
import { formatDate, formatTime, formatHours, cn } from "@/lib/utils"
import type { AttendanceRecord, Agency } from "@/lib/types"

type SortKey = "name" | "clockInTime" | "status" | "totalHours"
type StatusFilter = "all" | "present" | "late"

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  present: "On time",
  late: "Late",
}

function rangeStartDefault(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d
}

export default function AttendancePage() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: rangeStartDefault(),
    end: new Date(),
  })
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [agencyFilter, setAgencyFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { sortKey, sortOrder, toggleSort } = useTableSort<SortKey>("clockInTime", "desc")

  useEffect(() => {
    supabase
      .from("agencies")
      .select("id, name, agency_code, address, is_active, network_config")
      .order("name")
      .then(({ data }) => setAgencies((data as Agency[]) ?? []))
  }, [])

  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true)
      const { data } = await supabase
        .from("attendance_records")
        .select(
          "id, date, clock_in_time, clock_out_time, status, total_hours, employee_id, employee:employees(id, name, email, agency_id, agency:agencies(id, name))"
        )
        .gte("date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("date", format(dateRange.end, "yyyy-MM-dd"))
        .order("date", { ascending: false })
        .order("clock_in_time", { ascending: false })
      setRecords((data as unknown as AttendanceRecord[]) ?? [])
      setIsLoading(false)
    }
    fetchAttendance()
  }, [dateRange.start, dateRange.end])

  const filtered = useMemo(() => {
    let rows = records
    if (agencyFilter !== "all") rows = rows.filter((r) => r.employee?.agency?.id === agencyFilter)
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter((r) => (r.employee?.name ?? "").toLowerCase().includes(q))

    const sorted = [...rows]
    sorted.sort((a, b) => {
      let aVal: string | number, bVal: string | number
      switch (sortKey) {
        case "name":
          aVal = a.employee?.name ?? ""
          bVal = b.employee?.name ?? ""
          break
        case "clockInTime":
          aVal = a.clock_in_time ? new Date(a.clock_in_time).getTime() : 0
          bVal = b.clock_in_time ? new Date(b.clock_in_time).getTime() : 0
          break
        case "totalHours":
          aVal = a.total_hours ?? 0
          bVal = b.total_hours ?? 0
          break
        case "status":
          aVal = a.status
          bVal = b.status
          break
        default:
          return 0
      }
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1
      return 0
    })
    return sorted
  }, [records, agencyFilter, statusFilter, search, sortKey, sortOrder])

  const columns: ColumnDef<AttendanceRecord>[] = [
    { key: "date", header: "Date", render: (row) => formatDate(row.date) },
    { key: "name", header: "Employee", sortable: true, render: (row) => row.employee?.name ?? "—" },
    { key: "agency", header: "Agency", render: (row) => row.employee?.agency?.name ?? "—" },
    { key: "clockInTime", header: "Clock in", sortable: true, render: (row) => formatTime(row.clock_in_time) },
    { key: "clock_out", header: "Clock out", render: (row) => formatTime(row.clock_out_time) },
    { key: "totalHours", header: "Hours", sortable: true, align: "right", render: (row) => formatHours(row.total_hours) },
    { key: "status", header: "Status", sortable: true, align: "right", render: (row) => <StatusBadge status={row.status} variant="pill" /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Clock-in and clock-out records across all employees.">
        <ExportMenu records={filtered} dateRange={dateRange} filenamePrefix="attendance" />
      </PageHeader>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput
          inputId="attendance-search"
          placeholder="Search by employee name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className={cn("w-[150px] justify-start text-left font-normal")}
              />
            }
          >
            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
            {format(dateRange.start, "MMM d, yyyy")}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange.start}
              onSelect={(date) => date && setDateRange((prev) => ({ ...prev, start: date }))}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className={cn("w-[150px] justify-start text-left font-normal")}
              />
            }
          >
            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
            {format(dateRange.end, "MMM d, yyyy")}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange.end}
              onSelect={(date) => date && setDateRange((prev) => ({ ...prev, end: date }))}
            />
          </PopoverContent>
        </Popover>

        <Select value={agencyFilter} onValueChange={(value) => value && setAgencyFilter(value)}>
          <SelectTrigger className="w-44">
            <SelectValue>{() => (agencyFilter === "all" ? "All agencies" : agencies.find((a) => a.id === agencyFilter)?.name ?? "All agencies")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agencies</SelectItem>
            {agencies.map((agency) => (
              <SelectItem key={agency.id} value={agency.id}>
                {agency.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue>{(value: StatusFilter) => STATUS_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="present">On time</SelectItem>
            <SelectItem value="late">Late</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={(key) => toggleSort(key as SortKey)}
        isLoading={isLoading}
        emptyMessage="No attendance records matching your criteria."
        pagination
        pageSize={20}
      />
    </div>
  )
}
