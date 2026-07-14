"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { RequireRole } from "@/components/require-role"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, ApiError } from "@/lib/api"
import { formatDate, getInitials } from "@/lib/utils"
import { toast } from "sonner"
import { USER_MANAGER_ROLES, type Profile, type Role } from "@/lib/types"

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Administrator",
  it: "IT Administrator",
  hr: "HR Manager",
  front_desk: "Front Desk",
}

function UsersPageContent() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.me(), api.profiles()])
      .then(([me, data]) => {
        if (cancelled) return
        setCurrentUserId(me.id)
        setProfiles(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleRoleChange = async (id: string, role: Role) => {
    const previous = profiles
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)))
    try {
      await api.updateProfileRole(id, role)
      toast.success("Role updated")
    } catch (error) {
      setProfiles(previous) // revert on failure
      toast.error(error instanceof ApiError ? error.message : "Failed to update role")
    }
  }

  const columns: ColumnDef<Profile>[] = [
    {
      key: "user",
      header: "User",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
            {getInitials(row.full_name ?? row.email)}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.full_name ?? "—"}</span>
            <span className="text-xs text-muted-foreground">{row.email}</span>
          </div>
        </div>
      ),
    },
    { key: "created_at", header: "Joined", render: (row) => formatDate(row.created_at) },
    {
      key: "role",
      header: "Role",
      align: "right",
      render: (row) => (
        <Select
          value={row.role}
          onValueChange={(value) => handleRoleChange(row.id, value as Role)}
          disabled={row.id === currentUserId}
        >
          <SelectTrigger className="w-44 ml-auto">
            <SelectValue>{(value: Role) => ROLE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Dashboard admin accounts and their access level. New sign-ups start as Front Desk until promoted here."
      />
      <DataTable data={profiles} columns={columns} isLoading={isLoading} emptyMessage="No users found." />
    </div>
  )
}

export default function UsersPage() {
  return (
    <RequireRole allowed={USER_MANAGER_ROLES}>
      <UsersPageContent />
    </RequireRole>
  )
}
