"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LogIn, LogOut, Radio } from "lucide-react"
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">Live attendance feed</CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Radio className={cn("h-3 w-3", connected ? "text-emerald-500" : "text-muted-foreground")} />
          {connected ? "Live" : "Connecting…"}
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">
            No clock-in/clock-out events today yet…
          </p>
        ) : (
          <ul className="space-y-1">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                  {getInitials(event.employeeName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{event.employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.kind === "in" ? "Clocked in" : "Clocked out"} at {formatTime(event.time)}
                  </p>
                </div>
                {event.kind === "in" ? (
                  <LogIn className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <LogOut className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
