"use client"

import { useEffect, useRef, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
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
  const canvasWrapRef = useRef<HTMLDivElement>(null)

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
    const canvas = canvasWrapRef.current?.querySelector("canvas")
    if (!canvas) return
    const link = document.createElement("a")
    link.download = "attendance-qr-code.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance QR code"
        description="Print it and post it at the entrance so employees can scan it to clock in."
      />

      <Card className="max-w-2xl">
        <CardContent className="flex flex-col items-center gap-6 py-10 sm:flex-row sm:items-start sm:gap-10">
          <div className="rounded-xl border bg-white p-4 shadow-xs">
            {isLoading || !qr ? (
              <Skeleton className="h-[220px] w-[220px]" />
            ) : (
              <div ref={canvasWrapRef}>
                {/* Rendered large for crisp PNG downloads, displayed at 220px */}
                <QRCodeCanvas
                  value={qr.token}
                  size={1024}
                  level="H"
                  marginSize={2}
                  fgColor="#312E81"
                  style={{ width: 220, height: 220 }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-4 self-stretch">
            <div>
              <p className="text-sm font-medium text-foreground">Current code</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {qr?.token ?? "…"}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {qr?.created_at && (
                <p>
                  Active since <span className="text-foreground">{formatDate(qr.created_at)}</span>
                  {qr.rotated_by && qr.rotated_by !== "seed" && <> · rotated by {qr.rotated_by}</>}
                </p>
              )}
            </div>

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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
