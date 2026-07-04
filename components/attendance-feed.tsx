"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LogIn, LogOut, Radio } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { formatTime, getInitials, cn } from "@/lib/utils"

interface FeedEvent {
  id: string
  employeeName: string
  kind: "in" | "out"
  time: string
}

const MAX_EVENTS = 20

export function AttendanceFeed() {
  const [events, setEvents] = React.useState<FeedEvent[]>([])
  const [connected, setConnected] = React.useState(false)
  const namesRef = React.useRef<Map<string, string>>(new Map())

  React.useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setup = async () => {
      const { data } = await supabase.from("employees").select("id, name")
      if (cancelled) return
      namesRef.current = new Map((data ?? []).map((e) => [e.id, e.name]))

      // Unique name per mount — React Strict Mode's dev-only double-invoke
      // (mount → cleanup → mount) can otherwise race with the previous
      // channel's async removal and throw "cannot add postgres_changes
      // callbacks after subscribe()" on a still-shared channel object.
      channel = supabase
        .channel(`attendance-feed-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "attendance_records" },
          (payload) => {
            const row = payload.new as { id: string; employee_id: string; clock_in_time: string }
            pushEvent({
              id: `${row.id}-in`,
              employeeName: namesRef.current.get(row.employee_id) ?? "Unknown",
              kind: "in",
              time: row.clock_in_time,
            })
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "attendance_records" },
          (payload) => {
            const row = payload.new as { id: string; employee_id: string; clock_out_time: string | null }
            const previous = payload.old as { clock_out_time: string | null }
            if (row.clock_out_time && !previous?.clock_out_time) {
              pushEvent({
                id: `${row.id}-out`,
                employeeName: namesRef.current.get(row.employee_id) ?? "Unknown",
                kind: "out",
                time: row.clock_out_time,
              })
            }
          }
        )
        .subscribe((status) => {
          if (!cancelled) setConnected(status === "SUBSCRIBED")
        })
    }

    const pushEvent = (event: FeedEvent) => {
      if (!cancelled) setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS))
    }

    setup()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
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
            Waiting for clock-in/clock-out events…
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
