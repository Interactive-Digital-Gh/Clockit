"use client"

import { usePathname } from "next/navigation"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/attendance": "Attendance",
  "/dashboard/reports": "Reports",
  "/dashboard/employees": "Employees",
  "/dashboard/agencies": "Agencies",
  "/dashboard/users": "Users",
}

export function DashboardBreadcrumb() {
  const pathname = usePathname()
  const label = PAGE_LABELS[pathname] ?? "Overview"

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
