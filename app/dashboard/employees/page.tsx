"use client"

import { useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { SearchInput } from "@/components/ui/search-input"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase/client"
import { getInitials } from "@/lib/utils"
import { RequireRole } from "@/components/require-role"
import { ADMIN_ROLES, type Employee } from "@/lib/types"

function EmployeesPageContent() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoading(true)
      const { data } = await supabase
        .from("employees")
        .select("id, name, email, emp_id, job_title, agency_id, is_active, agency:agencies(id, name)")
        .order("name")
      setEmployees((data as unknown as Employee[]) ?? [])
      setIsLoading(false)
    }
    fetchEmployees()
  }, [])

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
    { key: "agency", header: "Agency", render: (row) => row.agency?.name ?? "—" },
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
      <PageHeader title="Employees" description="Everyone registered in the attendance app." />
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
