"use client"

import { useEffect, useMemo, useState } from "react"
import { TriangleAlert } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { SearchInput } from "@/components/ui/search-input"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, ApiError } from "@/lib/api"
import { getInitials } from "@/lib/utils"
import { RequireRole } from "@/components/require-role"
import { ADMIN_ROLES, type Agency, type Employee } from "@/lib/types"
import { toast } from "sonner"

const UNASSIGNED = "unassigned"

function EmployeesPageContent() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    Promise.all([api.employees(), api.agencies()])
      .then(([emps, agencyList]) => {
        if (cancelled) return
        setEmployees(emps)
        setAgencies(agencyList)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAgencyChange = async (id: string, agencyId: string) => {
    const previous = employees
    const nextAgencyId = agencyId === UNASSIGNED ? null : agencyId
    const nextAgency = agencies.find((a) => a.id === nextAgencyId) ?? null
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, agency_id: nextAgencyId, agency: nextAgency } : e))
    )
    try {
      await api.updateEmployee(id, { agency_id: nextAgencyId })
      toast.success("Agency updated")
    } catch (error) {
      setEmployees(previous) // revert on failure
      toast.error(error instanceof ApiError ? error.message : "Failed to update agency")
    }
  }

  const unassignedCount = useMemo(() => employees.filter((e) => !e.agency_id).length, [employees])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q)
    )
  }, [employees, search])

  const columns: ColumnDef<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
            {getInitials(row.name)}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.email ?? "—"}</span>
          </div>
        </div>
      ),
    },
    { key: "emp_id", header: "Employee ID", render: (row) => row.emp_id ?? "—" },
    { key: "job_title", header: "Job title", render: (row) => row.job_title ?? "—" },
    {
      key: "agency",
      header: "Agency",
      render: (row) => (
        <Select value={row.agency_id ?? UNASSIGNED} onValueChange={(value) => value && handleAgencyChange(row.id, value)}>
          <SelectTrigger className={row.agency_id ? "w-44" : "w-44 border-amber-300 text-amber-700"}>
            <SelectValue>
              {() => (row.agency_id ? agencies.find((a) => a.id === row.agency_id)?.name ?? "—" : "Unassigned")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {agencies.map((agency) => (
              <SelectItem key={agency.id} value={agency.id}>
                {agency.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      align: "right",
      render: (row) =>
        row.is_active ? (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            Inactive
          </Badge>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Employees" description="Everyone registered in Clockit." />
      {unassignedCount > 0 && (
        <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
          {unassignedCount} {unassignedCount === 1 ? "employee has" : "employees have"}{" "}
          no agency assigned — their clock-ins can&apos;t be verified as on-site until you assign
          one.
        </p>
      )}
      <SearchInput
        inputId="employee-search"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No employees found."
        pagination
        pageSize={15}
      />
    </div>
  )
}

export default function EmployeesPage() {
  return (
    <RequireRole allowed={ADMIN_ROLES}>
      <EmployeesPageContent />
    </RequireRole>
  )
}
