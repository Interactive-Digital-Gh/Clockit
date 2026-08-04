"use client"

import { useEffect, useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { RequireRole } from "@/components/require-role"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { api, ApiError } from "@/lib/api"
import { formatDate, getInitials } from "@/lib/utils"
import { toast } from "sonner"
import { USER_MANAGER_ROLES, type Profile, type Role } from "@/lib/types"

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Administrator",
  it: "IT Administrator",
  hr: "HR Manager",
  front_desk: "Front Desk",
  employee: "Employee",
}

function SetPasswordButton({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await api.setProfilePassword(profile.id, password)
      toast.success(`Password set for ${profile.email}`)
      setPassword("")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to set password")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Set password for ${profile.email}`} />}>
        <KeyRound className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Sets a password sign-in for <b>{profile.email}</b>, independent of Google. They can
              use it at /login instead of (or alongside) Google sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor={`password-${profile.id}`}>New password</Label>
            <Input
              id={`password-${profile.id}`}
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || password.length < 8}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
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
      key: "sign_in",
      header: "Signs in via",
      render: (row) =>
        row.has_google || row.has_password ? (
          <div className="flex flex-wrap gap-1.5">
            {row.has_google && <Badge variant="outline">Google</Badge>}
            {row.has_password && <Badge variant="outline">Password</Badge>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Not yet signed in</span>
        ),
    },
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
    {
      key: "password",
      header: "",
      align: "right",
      render: (row) => <SetPasswordButton profile={row} />,
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
