"use client"

import * as React from "react"
import { LayoutDashboardIcon, FileText, FileChartLine, UsersRound, Building2, UserCircle2, LogOut, UserCircle, MoreVertical, CalendarClock, QrCode, BellRing } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useProfile } from "@/hooks/use-profile"
import { ADMIN_ROLES, USER_MANAGER_ROLES, VIEW_ALL_ROLES, type Role } from "@/lib/types"

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Administrator",
  it: "IT Administrator",
  hr: "HR Manager",
  front_desk: "Front Desk",
  employee: "Employee",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const { profile } = useProfile()

  const navGroups = React.useMemo(() => {
    const groups = []
    if (profile && ADMIN_ROLES.includes(profile.role)) {
      groups.push({ label: "Dashboard", items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon }] })
    }
    // Everyone gets their own attendance; only viewing roles get everyone's.
    groups.push({
      label: "Personal",
      items: [{ href: "/dashboard/me", label: "My attendance", icon: CalendarClock }],
    })
    if (profile && VIEW_ALL_ROLES.includes(profile.role)) {
      groups.push({
        label: "Tracking",
        items: [
          { href: "/dashboard/attendance", label: "Attendance", icon: FileText },
          { href: "/dashboard/reports", label: "Reports", icon: FileChartLine },
        ],
      })
    }
    const managementItems = []
    if (profile && ADMIN_ROLES.includes(profile.role)) {
      managementItems.push({ href: "/dashboard/employees", label: "Employees", icon: UsersRound })
      managementItems.push({ href: "/dashboard/agencies", label: "Agencies", icon: Building2 })
      managementItems.push({ href: "/dashboard/qr-code", label: "QR code", icon: QrCode })
      managementItems.push({ href: "/dashboard/notifications", label: "Notifications", icon: BellRing })
    }
    if (profile && USER_MANAGER_ROLES.includes(profile.role)) {
      managementItems.push({ href: "/dashboard/users", label: "Users", icon: UserCircle2 })
    }
    if (managementItems.length > 0) groups.push({ label: "Management", items: managementItems })
    return groups
  }, [profile])

  const handleLogout = () => {
    api.logout()
    router.push("/login")
    router.refresh()
  }

  return (
    <Sidebar collapsible="icon" {...props} variant="sidebar" className="border-r bg-sidebar">
      <SidebarHeader className="p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={cn("flex items-center gap-3 px-5 py-6", isCollapsed && "px-0 justify-center")}>
              <div
                className={cn(
                  "flex items-center justify-center rounded-lg bg-primary/10 shrink-0",
                  isCollapsed ? "size-7" : "size-8"
                )}
              >
                <Image
                  src="/logo.png"
                  alt="Clockit logo"
                  width={22}
                  height={22}
                  className={cn(isCollapsed ? "size-4.5" : "size-5.5")}
                />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-semibold tracking-tight text-foreground leading-tight text-primary">
                    Clockit
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mt-1">
                    Interactive Digital
                  </span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 gap-0 overflow-x-hidden">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className={cn("py-2", isCollapsed && "px-0")}>
            {!isCollapsed && (
              <SidebarGroupLabel className="px-3 text-[11px] font-medium text-muted-foreground/60 mb-1">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")} />}
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          "h-9",
                          isCollapsed ? "px-0 justify-center" : "px-3",
                          !isActive && "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {!isCollapsed && <span className="text-sm">{item.label}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2 mt-auto border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className={cn("h-12 w-full transition-colors rounded-md", isCollapsed ? "px-0 justify-center" : "px-2 hover:bg-muted/50")}
                  />
                }
              >
                {
                  <div className={cn("flex items-center w-full", isCollapsed ? "justify-center" : "gap-2.5")}>
                    <div
                      className={cn(
                        "flex items-center justify-center rounded-full border border-border bg-muted shrink-0",
                        isCollapsed ? "size-7" : "size-8"
                      )}
                    >
                      <UserCircle className={cn("text-muted-foreground", isCollapsed ? "size-4" : "size-5")} />
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-col text-left overflow-hidden">
                        <span className="text-sm font-semibold text-foreground truncate leading-tight">
                          {profile?.full_name || "Admin"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate -mt-0.5">
                          {profile?.email || "admin@company.com"}
                        </span>
                      </div>
                    )}
                    {!isCollapsed && <MoreVertical className="ml-auto size-3.5 text-muted-foreground/50 shrink-0" />}
                  </div>
                }
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-[200px] shadow-lg"
                side={isCollapsed ? "right" : "bottom"}
                align={isCollapsed ? "start" : "end"}
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal text-xs text-muted-foreground px-2 py-1.5">
                    Account · {ROLE_LABELS[profile?.role ?? "front_desk"]}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 space-x-2"
                >
                  <LogOut className="size-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
