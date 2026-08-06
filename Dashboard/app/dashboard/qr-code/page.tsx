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
import { api, ApiError } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import { ADMIN_ROLES, type AttendanceQrToken } from "@/lib/types"

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
      </div>
    </div>
  )
}
