"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

import { StyledQrCode } from "@/components/qr-code-display"
import { api } from "@/lib/api"
import type { AttendanceQrToken } from "@/lib/types"

import { watchQr } from "@/lib/qr-refresh"

import styles from "./kiosk.module.css"

// A handful of consecutive failed polls before we say anything — a single
// blip (dev-server restart, brief network hiccup) shouldn't alarm whoever's
// watching the screen; the code shown is still valid until it visibly changes.
const STALE_AFTER_MISSES = 3
// This is an unattended screen — nobody's going to walk over and hit refresh
// after a deploy. Polling only picks up new QR *data*; a full reload is the
// only way an open tab ever sees new *code* (layout/copy changes like this
// page's own styling). Frequent enough that a deploy shows up on its own
// within minutes, rare enough not to be disruptive.
const RELOAD_INTERVAL_MS = 10 * 60 * 1000

/** Public, login-free front-desk display. No dashboard chrome — this route is
 * outside the auth gate (see Dashboard/proxy.ts) so a kiosk screen can show
 * it without ever signing in. Polls the token and swaps it in place whenever
 * the admin-configured rotation interval causes it to change. */
export default function KioskQrCodePage() {
  const [qr, setQr] = useState<AttendanceQrToken | null>(null)
  const [misses, setMisses] = useState(0)
  const missesRef = useRef(0)

  useEffect(() => watchQr(api.qrDisplay, (data) => {
    setQr(data)
    missesRef.current = 0
    setMisses(0)
  }, () => {
    missesRef.current += 1
    setMisses(missesRef.current)
  }), [])

  useEffect(() => {
    const id = setInterval(() => window.location.reload(), RELOAD_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <main className={styles.screen}>
      <div className={`surface-ink ${styles.panel}`}>
        <div className="bg-grid-ink pointer-events-none absolute inset-0" />

        <div className={styles.brand}>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white">
            <Image src="/logo.png" alt="Clockit logo" width={26} height={26} className="size-6" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-white">
            Clock<span className="text-[#FF3B54]">it</span>
          </span>
        </div>

        <h1 className={styles.heading}>
          Scan to
          <br />
          clock in.
        </h1>

        <div className={styles.qr} role="img" aria-label={qr ? "Scan this QR code to clock in" : "Loading QR code"}>
          {qr ? (
            <StyledQrCode value={qr.token} size={640} className={styles.code} />
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-black/10" />
          )}
        </div>

        <p className={styles.instructions}>
          Open your phone’s camera, scan the code, sign in, and tap the red button.
        </p>

        <p className={styles.status} role="status">
          {misses >= STALE_AFTER_MISSES
            ? qr
              ? "Connection interrupted — showing the last known code."
              : "Connecting to the server — please wait."
            : qr ? "Ready to scan" : "Loading your code…"}
        </p>
      </div>
    </main>
  )
}
