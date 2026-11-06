"use client"
import { useEffect, useRef } from "react"
import { diagnosticReference, reportDiagnostic } from "@/lib/client-diagnostics"

export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  const reference = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    reportDiagnostic("render_error", error)
    if (reference.current) reference.current.textContent = diagnosticReference()
  }, [error])
  return <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-2xl font-bold">The page couldn’t load</h1>
    <p>Please reload and try again. If this continues, share the reference below with your administrator.</p>
    <p>Reference: <span ref={reference}>…</span></p>
    <button className="rounded-lg bg-primary px-5 py-3 text-primary-foreground" onClick={() => window.location.reload()}>Reload page</button>
  </main>
}
