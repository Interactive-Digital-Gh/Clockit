import type { AttendanceQrToken } from "@/lib/types"

const CHECK_INTERVAL_MS = 30_000
const RETRY_INTERVAL_MS = 5_000

/** Server-relative expiry avoids relying on the screen's clock. Also checks
 * periodically for manual rotation/settings changes. Old APIs fall back to 30s. */
export function qrRefreshDelay(data: AttendanceQrToken, requestElapsedMs = 0) {
  const seconds = data.expires_in_seconds
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? Math.min(CHECK_INTERVAL_MS, Math.max(250, seconds * 1000 - requestElapsedMs + 100))
    : CHECK_INTERVAL_MS
}

export function watchQr(
  load: () => Promise<AttendanceQrToken>,
  onData: (data: AttendanceQrToken) => void,
  onError: () => void,
) {
  let cancelled = false
  let pending = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  const refresh = async () => {
    if (cancelled || pending) return
    clearTimeout(timer)
    pending = true
    const started = performance.now()
    let delay: number
    try {
      const data = await load()
      failures = 0
      if (cancelled) return
      onData(data)
      delay = qrRefreshDelay(data, performance.now() - started)
    } catch {
      if (cancelled) return
      onError()
      delay = Math.min(CHECK_INTERVAL_MS, RETRY_INTERVAL_MS * 2 ** Math.min(failures++, 3))
    } finally { pending = false }
    if (!cancelled) timer = setTimeout(refresh, delay)
  }
  const resume = () => { if (document.visibilityState === "visible") void refresh() }
  document.addEventListener("visibilitychange", resume)
  window.addEventListener("online", resume)
  void refresh()
  return () => {
    cancelled = true
    clearTimeout(timer)
    document.removeEventListener("visibilitychange", resume)
    window.removeEventListener("online", resume)
  }
}
