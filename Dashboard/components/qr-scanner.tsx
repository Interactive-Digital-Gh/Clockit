"use client"

import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { Camera, TriangleAlert } from "lucide-react"

export type ScanStatus = "starting" | "scanning" | "denied" | "unsupported"

interface QrScannerProps {
  /** Only runs the camera/scan loop while true — stop it when the dialog closes. */
  active: boolean
  /** Called with the decoded string on every detected QR code. May fire repeatedly — debounce in the parent. */
  onScan: (value: string) => void
}

// Camera-driven QR reader. Uses jsQR against raw canvas pixel data instead of
// the native BarcodeDetector API — BarcodeDetector has no Safari/iOS support,
// which rules it out given most usage here is mobile browsers.
export function QrScanner({ active, onScan }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<ScanStatus>("starting")

  // Latest-callback ref so the scan loop's effect doesn't need `onScan` in
  // its dependency array — an inline/unmemoized handler from the parent
  // would otherwise restart the camera on every render.
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!active) return
    let cancelled = false

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code?.data) onScanRef.current(code.data)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported")
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus("scanning")
        tick()
      } catch {
        if (!cancelled) setStatus("denied")
      }
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [active])

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {status === "scanning" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-2/3 w-2/3 rounded-lg border-2 border-white/80" />
        </div>
      )}

      {status !== "scanning" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
          {status === "starting" && (
            <>
              <Camera className="h-8 w-8 animate-pulse" />
              <p className="text-sm">Starting camera…</p>
            </>
          )}
          {status === "denied" && (
            <>
              <TriangleAlert className="h-8 w-8" />
              <p className="text-sm">
                Camera access was denied. Allow it in your browser settings, or use the manual
                Clock In button instead.
              </p>
            </>
          )}
          {status === "unsupported" && (
            <>
              <TriangleAlert className="h-8 w-8" />
              <p className="text-sm">
                This browser doesn&apos;t support camera scanning. Use the manual Clock In button
                instead.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
