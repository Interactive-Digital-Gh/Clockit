"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LogIn, LogOut } from "lucide-react"
import { api } from "@/lib/api"
import { formatTime, getInitials, cn } from "@/lib/utils"

interface FeedEvent {
  id: string
  employeeName: string
  kind: "in" | "out"
  time: string
}

const MAX_EVENTS = 20
const POLL_INTERVAL_MS = 15_000

function todayDate() {
  return new Date().toISOString().split("T")[0]
}

// The FastAPI backend has no realtime channel (Supabase did), so the feed polls
// today's attendance and derives clock-in/out events, newest first. Swap to
// SSE/WebSockets later if a true live stream is needed.
export function AttendanceFeed() {
  const [events, setEvents] = React.useState<FeedEvent[]>([])
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const records = await api.attendance({ on_date: todayDate() })
        if (cancelled) return

        const derived: FeedEvent[] = []
        for (const r of records) {
          const name = r.employee?.name ?? "Unknown"
          derived.push({ id: `${r.id}-in`, employeeName: name, kind: "in", time: r.clock_in_time })
          if (r.clock_out_time) {
            derived.push({ id: `${r.id}-out`, employeeName: name, kind: "out", time: r.clock_out_time })
          }
        }
        derived.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

        setEvents(derived.slice(0, MAX_EVENTS))
        setConnected(true)
      } catch {
        if (!cancelled) setConnected(false)
      }
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-3.5">
        <CardTitle className="text-sm font-bold tracking-tight">Live feed</CardTitle>
        <div
          className={cn(
            "flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase",
            connected ? "text-muted-foreground" : "text-muted-foreground/60"
          )}
        >
          <span className={cn("size-1.5 rounded-full", connected ? "bg-primary" : "bg-muted-foreground/40")} />
          {connected ? "Streaming" : "Connecting…"}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground italic">No clock-ins yet today…</p>
        ) : (
          <ul>
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                  {getInitials(event.employeeName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{event.employeeName}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {event.kind === "in" ? "In" : "Out"} · {formatTime(event.time)}
                  </p>
                </div>
                {event.kind === "in" ? (
                  <LogIn className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
