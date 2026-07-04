"use client"

import { Badge } from "@/components/ui/badge"
import { ATTENDANCE_STATUS, type AttendanceStatusKey, cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  className?: string
  variant?: "default" | "outline" | "pill"
}

export function StatusBadge({ status, className, variant = "default" }: StatusBadgeProps) {
  const config = ATTENDANCE_STATUS[status as AttendanceStatusKey] || {
    label: status,
    badgeClass: "bg-gray-50 text-gray-700 border-gray-200",
  }

  if (variant === "pill") {
    return (
      <span
        className={cn(
          "px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-xs transition-colors",
          config.badgeClass,
          className
        )}
      >
        {config.label}
      </span>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md font-bold px-2.5 py-0.5 shadow-xs transition-colors",
        config.badgeClass,
        className
      )}
    >
      {config.label}
    </Badge>
  )
}
