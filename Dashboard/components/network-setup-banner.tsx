"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { TriangleAlert, ArrowRight } from "lucide-react"

import { api } from "@/lib/api"
import { useProfile } from "@/hooks/use-profile"
import { ADMIN_ROLES, type Agency } from "@/lib/types"

/** Dispatched by pages that create/update agencies so the banner re-checks. */
export const AGENCIES_CHANGED_EVENT = "clockit:agencies-changed"

function isUnconfigured(a: Agency): boolean {
  if (a.is_active === false) return false
  const cfg = a.network_config
  return !(cfg?.allowed_public_ips?.length || cfg?.allowed_subnets?.length)
}

/**
 * Persistent admin banner: on-site verification (the office-network check) is
 * the main trust signal for clock-ins, so unconfigured agencies get a
 * standing nudge with a link straight to the setup dialog.
 */
export function NetworkSetupBanner() {
  const { profile } = useProfile()
  const pathname = usePathname()
  const [unconfigured, setUnconfigured] = useState<Agency[]>([])

  const isAdmin = !!profile && ADMIN_ROLES.includes(profile.role)

  const refresh = useCallback(() => {
    if (!isAdmin) return
    api
      .agencies()
      .then((agencies) => setUnconfigured(agencies.filter(isUnconfigured)))
      .catch(() => {})
  }, [isAdmin])

  useEffect(() => {
    refresh()
  }, [refresh, pathname])

  useEffect(() => {
    window.addEventListener(AGENCIES_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(AGENCIES_CHANGED_EVENT, refresh)
  }, [refresh])

  if (!isAdmin || unconfigured.length === 0) return null

  const names = unconfigured.map((a) => a.name)
  const label =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${names.length - 1} other agencies`

  return (
    <div className="mx-4 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="flex-1 min-w-[16rem]">
        <b>{label}</b> {unconfigured.length === 1 ? "has" : "have"} no office network configured —
        on-site verification is off and every clock-in there shows as Remote.
      </span>
      <Link
        href={`/dashboard/agencies?configure=${unconfigured[0].id}`}
        className="inline-flex items-center gap-1 font-semibold text-amber-900 underline underline-offset-4 hover:text-amber-700 dark:text-amber-200"
      >
        Set it up
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
