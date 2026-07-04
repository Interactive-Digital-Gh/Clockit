"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { RequireRole } from "@/components/require-role"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
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
    const fetchProfiles = async () => {
      setIsLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      const { data } = await supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at")
      setProfiles((data as Profile[]) ?? [])
      setIsLoading(false)
    }
    fetchProfiles()
  }, [])

  const handleRoleChange = async (id: string, role: Role) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id)
    if (error) {
      toast.error(error.message)
      return
    }
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)))
    toast.success("Role updated")
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
