"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  isLoading?: boolean
  className?: string
  valueClassName?: string
  /** "hero" renders the dark ink treatment used for the single featured stat on a page. */
  tone?: "default" | "hero"
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading = false,
  className,
  valueClassName,
  tone = "default",
}: MetricCardProps) {
  const isHero = tone === "hero"

  return (
    <Card
      className={cn(
        "relative overflow-hidden py-4.5",
        isHero && "surface-ink border-none text-white",
        className
      )}
    >
      {isHero && <div className="bg-grid-ink pointer-events-none absolute inset-0" />}
      <CardContent className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase",
              isHero ? "text-[#FF8B98]" : "text-muted-foreground"
            )}
          >
            {isHero && (
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#FF3B54] opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[#FF3B54]" />
              </span>
            )}
            {title}
          </div>
          <Icon className={cn("h-4 w-4", isHero ? "text-white/40" : "text-muted-foreground/60")} />
        </div>
        {isLoading ? (
          <>
            <Skeleton className="h-9 w-16" />
            {subtitle && <Skeleton className="h-3 w-24" />}
          </>
        ) : (
          <>
            <div
              className={cn(
                "font-mono text-[34px] leading-none tracking-tight",
                isHero ? "text-white" : "text-foreground",
                valueClassName
              )}
            >
              {value}
            </div>
            {subtitle && (
              <p className={cn("text-[11.5px]", isHero ? "text-white/50" : "text-muted-foreground")}>
                {subtitle}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface MetricCardConfig {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  valueClassName?: string
  tone?: "default" | "hero"
}

interface MetricsGridProps {
  metrics: MetricCardConfig[]
  isLoading?: boolean
  className?: string
}

export function MetricsGrid({ metrics, isLoading = false, className }: MetricsGridProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} isLoading={isLoading} />
      ))}
    </div>
  )
}
