"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

import { StyledQrCode } from "@/components/qr-code-display"
import { api } from "@/lib/api"
import type { AttendanceQrToken } from "@/lib/types"

const POLL_INTERVAL_MS = 10_000
// A handful of consecutive failed polls before we say anything — a single
// blip (dev-server restart, brief network hiccup) shouldn't alarm whoever's
// watching the screen; the code shown is still valid until it visibly changes.
const STALE_AFTER_MISSES = 3

/** Public, login-free front-desk display. No dashboard chrome — this route is
 * outside the auth gate (see Dashboard/proxy.ts) so a kiosk screen can show
 * it without ever signing in. Polls the token and swaps it in place whenever
 * the admin-configured rotation interval causes it to change. */
export default function KioskQrCodePage() {
  const [qr, setQr] = useState<AttendanceQrToken | null>(null)
  const [misses, setMisses] = useState(0)
  const missesRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    const poll = () => {
      api
        .qrDisplay()
        .then((data) => {
          if (cancelled) return
          setQr(data)
          missesRef.current = 0
          setMisses(0)
        })
        .catch(() => {
          if (cancelled) return
          missesRef.current += 1
          setMisses(missesRef.current)
        })
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#0b0a09] p-8">
      <div className="surface-ink relative flex w-full max-w-[600px] flex-col items-center gap-6 overflow-hidden rounded-3xl p-12 text-white shadow-[0_30px_80px_rgba(0,0,0,.5)]">
        <div className="bg-grid-ink pointer-events-none absolute inset-0" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
            <Image src="/logo.png" alt="Clockit logo" width={22} height={22} className="size-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Clock<span className="text-[#FF3B54]">it</span>
          </span>
        </div>

        <p className="relative text-center text-4xl leading-[1.1] font-bold tracking-tight text-white">
          Scan to
          <br />
          clock in.
        </p>

        <div className="relative rounded-[28px] bg-white p-5 shadow-[0_18px_44px_rgba(0,0,0,.4)]">
          {qr ? (
            <StyledQrCode value={qr.token} size={380} />
          ) : (
            <div className="size-[380px] animate-pulse rounded-lg bg-black/10" />
          )}
        </div>

        <p className="relative max-w-[360px] text-center text-base leading-relaxed text-white/60">
          Open your camera, sign in, tap the red button. Five seconds.
        </p>

        <span className="btn-action relative rounded-full px-2.5 py-1 font-mono text-[9.5px] text-white">
          TESTING — INTERACTIVE DIGITAL ONLY
        </span>

        {misses >= STALE_AFTER_MISSES && (
          <p className="relative text-xs font-medium text-amber-300/90">
            Having trouble reaching the server — showing the last known code.
          </p>
        )}
      </div>
    </div>
  )
}
