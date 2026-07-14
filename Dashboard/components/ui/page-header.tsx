"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

interface PageHeaderAction {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  href?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
}

interface PageHeaderWithActionsProps extends Omit<PageHeaderProps, "children"> {
  actions?: PageHeaderAction[]
}

export function PageHeaderWithActions({
  title,
  description,
  actions = [],
  className,
}: PageHeaderWithActionsProps) {
  return (
    <PageHeader title={title} description={description} className={className}>
      {actions.map((action, index) => (
        <Button key={index} variant={action.variant} onClick={action.onClick} className="gap-2">
          {action.icon && <action.icon className="h-4 w-4" />}
          {action.label}
        </Button>
      ))}
    </PageHeader>
  )
}
