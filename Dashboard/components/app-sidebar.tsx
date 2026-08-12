"use client"

import * as React from "react"
import { LayoutDashboardIcon, FileText, FileChartLine, UsersRound, Building2, UserCircle2, LogOut, MoreVertical, CalendarClock, QrCode, BellRing } from "lucide-react"
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
import { cn, getInitials } from "@/lib/utils"
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
    <Sidebar
      collapsible="icon"
      {...props}
      variant="sidebar"
      className="surface-ink-sidebar relative overflow-hidden border-r border-white/10 text-white"
    >
      <div className="bg-grid-ink pointer-events-none absolute inset-0" />

      <SidebarHeader className="relative z-10 p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={cn("flex items-center gap-2.5 px-5 py-6", isCollapsed && "px-0 justify-center")}>
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white">
                <Image src="/logo.png" alt="Clockit logo" width={18} height={18} className="size-4.5" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[15px] font-bold tracking-tight text-white">
                    Clock<span className="text-[#FF3B54]">it</span>
                  </span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="relative z-10 gap-0 overflow-x-hidden px-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className={cn("py-2", isCollapsed && "px-0")}>
            {!isCollapsed && (
              <SidebarGroupLabel className="mb-1 px-3 font-mono text-[10px] tracking-wider text-white/40 uppercase">
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
                        render={<Link href={item.href} className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2.5")} />}
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          "relative h-9.5 rounded-xl bg-transparent text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/80",
                          "data-active:bg-white data-active:text-[#141210] data-active:font-semibold data-active:hover:bg-white data-active:hover:text-[#141210]",
                          isCollapsed ? "justify-center px-0" : "px-3"
                        )}
                      >
                        {!isCollapsed && (
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              isActive ? "bg-primary" : "bg-transparent"
                            )}
                          />
                        )}
                        <item.icon className="size-4 shrink-0" />
                        {!isCollapsed && (
                          <span className={cn("text-[13px]", isActive ? "font-semibold" : "font-medium")}>
                            {item.label}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="relative z-10 mt-auto border-t border-white/10 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className={cn(
                      "h-12 w-full rounded-md transition-colors hover:bg-white/[0.06]",
                      isCollapsed ? "justify-center px-0" : "px-2"
                    )}
                  />
                }
              >
                {
                  <div className={cn("flex w-full items-center", isCollapsed ? "justify-center" : "gap-2.5")}>
                    <div
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white",
                        isCollapsed ? "size-7 text-[10px]" : "size-8 text-[11px]"
                      )}
                    >
                      {getInitials(profile?.full_name || profile?.email || "?")}
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-col overflow-hidden text-left">
                        <span className="truncate text-sm leading-tight font-semibold text-white">
                          {profile?.full_name || "Admin"}
                        </span>
                        <span className="-mt-0.5 truncate font-mono text-[10px] tracking-wider text-white/40 uppercase">
                          {ROLE_LABELS[profile?.role ?? "front_desk"]}
                        </span>
                      </div>
                    )}
                    {!isCollapsed && <MoreVertical className="ml-auto size-3.5 shrink-0 text-white/40" />}
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
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
                    Account · {ROLE_LABELS[profile?.role ?? "front_desk"]}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer space-x-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
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
