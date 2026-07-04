"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading = false,
  className,
  valueClassName,
}: MetricCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 mb-1" />
            {subtitle && <Skeleton className="h-3 w-24" />}
          </>
        ) : (
          <>
            <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
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
