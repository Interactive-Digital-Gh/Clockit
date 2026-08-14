"use client"

import { use, useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"
import { formatTime } from "@/lib/utils"
import { getLocation } from "@/lib/geolocation"
import { useProfile } from "@/hooks/use-profile"
import type { AttendanceRecord } from "@/lib/types"

type Status = "loading" | "expired" | "ready" | "clocking-in" | "done" | "already-in"

/** Where the front-desk QR code actually sends you. Not public — this route
 * stays behind the normal auth gate (Dashboard/proxy.ts), so an
 * unauthenticated scan is bounced to /login?next=/scan?t=... and lands back
 * here right after signing in. Requires one tap to actually clock in — never
 * automatic on load. */
export default function ScanPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = use(searchParams)
  const { profile } = useProfile()
  const [status, setStatus] = useState<Status>("loading")
  const [today, setToday] = useState<AttendanceRecord | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const todayRecord = await api.myToday().catch(() => null)
      if (cancelled) return
      if (todayRecord && !todayRecord.clock_out_time) {
        setToday(todayRecord)
        setStatus("already-in")
        return
      }

      // If this link carries a code, check it's still the live one. Purely a
      // friendly heads-up — like the rest of the app, the scan itself isn't
      // enforced server-side, clocking in works either way.
      if (t) {
        const expected = await api.qrDisplay().catch(() => null)
        if (cancelled) return
        const expectedT = expected ? new URL(expected.token, window.location.origin).searchParams.get("t") : null
        if (expectedT && expectedT !== t) {
          setStatus("expired")
          return
        }
      }

      setStatus("ready")
    }

    run()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleClockIn = useCallback(async () => {
    setStatus("clocking-in")
    try {
      const location = await getLocation()
      const record = await api.myClockIn(location)
      setToday(record)
      setStatus("done")
      toast.success("Clocked in")
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Could not clock in — try again.")
      setStatus("ready")
    }
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#0b0a09] p-6">
      <div className="surface-ink relative flex w-full max-w-sm flex-col items-center gap-5 overflow-hidden rounded-3xl p-8 text-white shadow-[0_30px_80px_rgba(0,0,0,.5)]">
        <div className="bg-grid-ink pointer-events-none absolute inset-0" />

        <div className="relative flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white">
            <Image src="/logo.png" alt="Clockit logo" width={18} height={18} className="size-4.5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Clock<span className="text-[#FF3B54]">it</span>
          </span>
        </div>

        {status === "loading" && <p className="relative text-sm text-white/60">Checking…</p>}

        {status === "expired" && (
          <div className="relative flex flex-col items-center gap-2 text-center">
            <p className="text-lg font-semibold text-white">This code has expired</p>
            <p className="text-sm text-white/60">Ask the front desk for the current one.</p>
          </div>
        )}

        {(status === "already-in" || status === "done") && (
          <div className="relative flex flex-col items-center gap-2 text-center">
            <p className="text-lg font-semibold text-white">You&apos;re clocked in</p>
            {today?.clock_in_time && (
              <p className="text-sm text-white/60">since {formatTime(today.clock_in_time)}</p>
            )}
          </div>
        )}

        {(status === "ready" || status === "clocking-in") && (
          <div className="relative flex w-full flex-col items-center gap-4 text-center">
            <p className="text-sm text-white/60">
              Signed in as <span className="text-white">{profile?.email ?? "…"}</span>
            </p>
            <Button
              className="h-12 w-full text-base"
              onClick={handleClockIn}
              disabled={status === "clocking-in"}
            >
              {status === "clocking-in" ? "Clocking in…" : "Clock in"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
