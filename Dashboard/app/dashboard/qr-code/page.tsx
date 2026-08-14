"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Download, RefreshCw, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { StyledQrCode, downloadQrCode } from "@/components/qr-code-display"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, ApiError } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import { ADMIN_ROLES, type AttendanceQrSettings, type AttendanceQrToken } from "@/lib/types"

type RotationMode = "manual" | "auto"

export default function QrCodePage() {
  return (
    <RequireRole allowed={ADMIN_ROLES}>
      <QrCodePageContent />
    </RequireRole>
  )
}

function QrCodePageContent() {
  const [qr, setQr] = useState<AttendanceQrToken | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRotating, setIsRotating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [rotationMode, setRotationMode] = useState<RotationMode>("manual")
  const [rotationMinutes, setRotationMinutes] = useState("15")
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .attendanceQr()
      .then((data) => {
        if (!cancelled) setQr(data)
      })
      .catch((error: unknown) => {
        toast.error(error instanceof ApiError ? error.message : "Could not load the QR code")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    api
      .qrSettings()
      .then((settings: AttendanceQrSettings) => {
        if (cancelled) return
        if (settings.rotation_minutes != null) {
          setRotationMode("auto")
          setRotationMinutes(String(settings.rotation_minutes))
        }
      })
      .catch(() => {
        // Non-fatal — the settings card just falls back to "manual" if this fails.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleRotate = async () => {
    setIsRotating(true)
    try {
      const next = await api.rotateAttendanceQr()
      setQr(next)
      setConfirmOpen(false)
      toast.success("QR code rotated — print and post the new code")
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Rotation failed")
    } finally {
      setIsRotating(false)
    }
  }

  const handleDownload = () => {
    if (!qr) return
    downloadQrCode(qr.token)
  }

  const handleSaveSettings = async () => {
    const minutes = rotationMode === "auto" ? Number(rotationMinutes) : null
    if (rotationMode === "auto" && (!Number.isInteger(minutes) || minutes! < 1 || minutes! > 1440)) {
      toast.error("Enter a whole number of minutes between 1 and 1440")
      return
    }
    setIsSavingSettings(true)
    try {
      await api.updateQrSettings(minutes)
      toast.success(
        minutes == null
          ? "Auto-rotation turned off — the code only changes when you rotate it manually"
          : `The code will now rotate automatically every ${minutes} minute${minutes === 1 ? "" : "s"}`
      )
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the rotation setting")
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance QR code"
        description="Print it and post it at the entrance so employees can scan it to clock in."
      />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="surface-ink relative mx-auto flex w-full max-w-[300px] flex-col items-center gap-3 overflow-hidden rounded-2xl p-5 text-white shadow-[0_14px_34px_rgba(20,18,16,.2)]">
          <div className="bg-grid-ink pointer-events-none absolute inset-0" />
          <div className="relative flex w-full items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white">
              <Image src="/logo.png" alt="Clockit logo" width={15} height={15} className="size-3.5" />
            </div>
            <span className="text-[13px] font-bold tracking-tight text-white">
              Clock<span className="text-[#FF3B54]">it</span>
            </span>
            <span className="ml-auto font-mono text-[10px] tracking-wider text-white/50 uppercase">HQ</span>
          </div>

          <p className="relative text-center text-[22px] leading-[1.1] font-bold tracking-tight text-white">
            Scan to
            <br />
            clock in.
          </p>

          <div className="relative rounded-[22px] bg-white p-3 shadow-[0_12px_30px_rgba(0,0,0,.35)]">
            {isLoading || !qr ? (
              <Skeleton className="size-[180px] rounded-lg bg-black/10" />
            ) : (
              <StyledQrCode value={qr.token} size={180} />
            )}
          </div>

          <div className="relative flex flex-col items-center gap-2">
            <p className="max-w-[200px] text-center text-[11.5px] leading-[1.45] text-white/60">
              Open your camera, sign in, tap the red button. Five seconds.
            </p>
            <span className="btn-action rounded-full px-2.5 py-1 font-mono text-[9.5px] text-white">
              NO APP NEEDED
            </span>
          </div>

          <span className="relative mt-1 font-mono text-[9px] tracking-wide text-white/40">
            CLOCKIT.INTERACTIVEDIGITAL.COM.GH
          </span>
        </div>

        <div className="flex flex-col gap-5">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-medium text-foreground">Current code</p>
              <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{qr?.token ?? "…"}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              {qr?.created_at && (
                <p>
                  Active since <span className="text-foreground">{formatDate(qr.created_at)}</span>
                  {qr.rotated_by && qr.rotated_by !== "seed" && <> · rotated by {qr.rotated_by}</>}
                </p>
              )}
            </div>
            <p className="rounded-xl bg-muted p-3 text-[13px] text-muted-foreground">
              Level-H error correction — the centered logo covers well under the 30% tolerance, so the
              code stays reliably scannable even printed small.
            </p>

            <div className="mt-auto flex flex-wrap gap-3 pt-2">
              <Button variant="outline" onClick={handleDownload} disabled={!qr}>
                <Download className="mr-2 h-4 w-4" />
                Download PNG
              </Button>

              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogTrigger render={<Button variant="destructive" disabled={!qr} />}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Rotate QR code
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <TriangleAlert className="h-5 w-5 text-destructive" />
                      Rotate the attendance QR code?
                    </DialogTitle>
                    <DialogDescription className="space-y-2 pt-2">
                      This cannot be undone. The current code stops working <b>immediately</b>, so
                      printed copies become invalid until you print and post the new one — no
                      update needed on employees&apos; end, their phones pick it up automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isRotating}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleRotate} disabled={isRotating}>
                      {isRotating ? "Rotating…" : "Yes, rotate it"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Rotation</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Set how often the code changes on its own, or leave it on manual and rotate it
                yourself with the button above.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Rotation mode</Label>
                <Select value={rotationMode} onValueChange={(value) => setRotationMode(value as RotationMode)}>
                  <SelectTrigger className="w-44">
                    <SelectValue>{(value: RotationMode) => (value === "auto" ? "Auto-rotate" : "Manual only")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual only</SelectItem>
                    <SelectItem value="auto">Auto-rotate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {rotationMode === "auto" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Every (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    value={rotationMinutes}
                    onChange={(e) => setRotationMinutes(e.target.value)}
                    className="w-28"
                  />
                </div>
              )}

              <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                {isSavingSettings ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Front-desk kiosk display</p>
            <p className="text-[13px] text-muted-foreground">
              A no-login, full-screen version of this code lives at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/kiosk/qr-code</code> — open it
              on the screen at the entrance and it stays live on its own.
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
