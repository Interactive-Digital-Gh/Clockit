"use client"

import { ShieldAlert } from "lucide-react"
import { useProfile } from "@/hooks/use-profile"
import type { Role } from "@/lib/types"

export function RequireRole({ allowed, children }: { allowed: Role[]; children: React.ReactNode }) {
  const { profile, isLoading } = useProfile()

  if (isLoading) return null

  if (!profile || !allowed.includes(profile.role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">You don&apos;t have access to this page</p>
          <p className="text-sm text-muted-foreground">Contact an admin if you think this is a mistake.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
