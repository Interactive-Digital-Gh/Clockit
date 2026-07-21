"use client"

import { useEffect, useState } from "react"
import { Send, Clock, Loader2, X, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RequireRole } from "@/components/require-role"
import { api, ApiError } from "@/lib/api"
import { formatDate, DATE_FORMATS } from "@/lib/utils"
import { ADMIN_ROLES, type AdminNotification } from "@/lib/types"

export default function NotificationsPage() {
  return (
    <RequireRole allowed={ADMIN_ROLES}>
      <NotificationsPageContent />
    </RequireRole>
  )
}

function localDatetimeNowFloor(): string {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return now.toISOString().slice(0, 16)
}

function NotificationsPageContent() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [mode, setMode] = useState<"now" | "later">("now")
  const [scheduledFor, setScheduledFor] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api
      .notifications()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && (mode === "now" || scheduledFor.trim().length > 0)

  const handleSend = async () => {
    setSending(true)
    try {
      const created = await api.sendNotification({
        title: title.trim(),
        body: body.trim(),
        scheduled_for: mode === "later" ? new Date(scheduledFor).toISOString() : null,
      })
      toast.success(
        created.status === "sent"
          ? `Sent to ${created.recipient_count ?? 0} device${created.recipient_count === 1 ? "" : "s"}`
          : `Scheduled for ${formatDate(created.scheduled_for, DATE_FORMATS.DATETIME)}`,
      )
      setTitle("")
      setBody("")
      setMode("now")
      setScheduledFor("")
      setConfirmOpen(false)
      setNotifications((prev) => [created, ...prev])
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to send notification")
    } finally {
      setSending(false)
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.cancelNotification(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: "canceled" as const } : n)))
      toast.success("Notification canceled")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to cancel")
    }
  }

  const columns: ColumnDef<AdminNotification>[] = [
    {
      key: "title",
      header: "Alert",
      render: (row) => (
        <div className="max-w-sm">
          <p className="font-medium text-foreground">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">{row.body}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={row.status === "sent" ? "default" : row.status === "canceled" ? "outline" : "secondary"}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "when",
      header: "When",
      render: (row) =>
        row.status === "sent" && row.sent_at ? (
          <span className="text-xs">Sent {formatDate(row.sent_at, DATE_FORMATS.DATETIME)}</span>
        ) : row.scheduled_for ? (
          <span className="text-xs">Scheduled {formatDate(row.scheduled_for, DATE_FORMATS.DATETIME)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "recipients",
      header: "Recipients",
      render: (row) => <span className="text-xs">{row.recipient_count ?? "—"}</span>,
    },
    {
      key: "created_by",
      header: "Sent by",
      render: (row) => <span className="text-xs text-muted-foreground">{row.created_by}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        row.status === "scheduled" ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => handleCancel(row.id)}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Broadcast alerts to every employee's device — send immediately or schedule for later."
      />

      <Card className="max-w-2xl">
        <CardContent className="space-y-4 py-6">
          <div className="grid gap-2">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Office closed tomorrow"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notif-body">Message</Label>
            <textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Give the details employees need."
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <div className="grid gap-2">
            <Label>When</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "now" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("now")}
                className="gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                Send now
              </Button>
              <Button
                type="button"
                variant={mode === "later" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("later")}
                className="gap-2"
              >
                <Clock className="h-3.5 w-3.5" />
                Schedule for later
              </Button>
            </div>
            {mode === "later" && (
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={localDatetimeNowFloor()}
                className="mt-1 h-8 w-fit rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            )}
          </div>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger render={<Button className="gap-2" disabled={!canSubmit} />}>
              {mode === "now" ? <Send className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {mode === "now" ? "Send to everyone" : "Schedule alert"}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TriangleAlert className="h-5 w-5 text-amber-600" />
                  {mode === "now" ? "Send this to every employee now?" : "Schedule this alert?"}
                </DialogTitle>
                <DialogDescription className="pt-2">
                  {mode === "now"
                    ? "This goes out immediately to every registered device. It can't be recalled once sent."
                    : `This is sent automatically at ${scheduledFor ? new Date(scheduledFor).toLocaleString() : "the scheduled time"}. You can cancel it any time before then.`}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{title || "(no title)"}</p>
                <p className="text-sm text-muted-foreground">{body || "(no message)"}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button onClick={handleSend} disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {mode === "now" ? "Sending…" : "Scheduling…"}
                    </>
                  ) : mode === "now" ? (
                    "Yes, send now"
                  ) : (
                    "Yes, schedule it"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">History</h2>
        <DataTable
          data={notifications}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No notifications sent yet."
        />
      </div>
    </div>
  )
}
