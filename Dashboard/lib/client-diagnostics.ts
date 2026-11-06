// Deliberately exclude messages, query strings, credentials, and user identity.
export const diagnosticEvents = ["page_loaded", "navigation", "javascript_error", "unhandled_rejection", "resource_error", "render_error", "google_started", "google_success", "google_failed", "scan_ready", "api_failed"] as const
export type DiagnosticEvent = typeof diagnosticEvents[number]
export function diagnosticPage(path: string) {
  return ["/login", "/scan", "/kiosk/qr-code"].includes(path) ? path : "other"
}
let reference: string | undefined
let sent = 0
export function diagnosticReference() {
  if (!reference) reference = Math.random().toString(36).slice(2, 10)
  return reference
}
export function reportDiagnostic(event: DiagnosticEvent, error?: unknown, status?: number) {
  try {
    if (typeof window === "undefined" || sent >= 30) return
    sent++
    const name = error instanceof Error ? error.name : "unknown"
    const category = ["TypeError", "ReferenceError", "SyntaxError", "RangeError", "ChunkLoadError", "Error"].includes(name) ? name : "unknown"
    // Only bundled asset locations, never arbitrary stack text or URLs.
    const frames = error instanceof Error ? (error.stack?.match(/\/_next\/static\/[^\s)?:]+(?::\d+(?::\d+)?)?/g) ?? []).slice(0, 5) : []
    void fetch("/api/client-events", {
      method: "POST", credentials: "omit", keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, reference: diagnosticReference(), page: diagnosticPage(window.location.pathname), category, frames, status, build: process.env.NEXT_PUBLIC_BUILD_ID ?? "development" }),
    }).catch(() => {})
  } catch { /* Diagnostics must never interrupt sign-in. */ }
}
