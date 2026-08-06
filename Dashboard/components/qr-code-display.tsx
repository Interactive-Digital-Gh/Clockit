"use client"

import { useEffect, useRef } from "react"
import QRCodeStyling from "qr-code-styling"

// Shared styling so the admin preview and the printable sign use the exact
// same visual code — ink-colored rounded modules, level-H error correction
// (30% tolerance) so the centered logo never breaks scannability.
function buildQrCode(value: string, size: number) {
  return new QRCodeStyling({
    width: size,
    height: size,
    type: "svg",
    data: value,
    margin: 8,
    qrOptions: { errorCorrectionLevel: "H" },
    imageOptions: { hideBackgroundDots: true, imageSize: 0.32, margin: 6, crossOrigin: "anonymous" },
    dotsOptions: { type: "rounded", color: "#141210" },
    cornersSquareOptions: { type: "extra-rounded", color: "#141210" },
    cornersDotOptions: { type: "dot", color: "#141210" },
    backgroundOptions: { color: "#ffffff" },
    image: "/logo.png",
  })
}

interface QrCodeCanvasProps {
  value: string
  size?: number
  className?: string
}

/** Renders the styled, scannable QR code — ink rounded modules + centered logo. */
export function StyledQrCode({ value, size = 220, className }: QrCodeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const qrRef = useRef<QRCodeStyling | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const qr = buildQrCode(value, size)
    qrRef.current = qr
    containerRef.current.innerHTML = ""
    qr.append(containerRef.current)
    return () => {
      qrRef.current = null
    }
  }, [value, size])

  return <div ref={containerRef} className={className} data-qr-container />
}

/** Triggers a PNG download of the same code, rendered at print resolution. */
export function downloadQrCode(value: string, filename = "attendance-qr-code.png") {
  const qr = buildQrCode(value, 1024)
  qr.download({ name: filename.replace(/\.png$/, ""), extension: "png" })
}
