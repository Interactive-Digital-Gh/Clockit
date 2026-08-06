"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type SortOrder = "asc" | "desc"

export interface ColumnDef<T> {
  key: string
  header: string
  sortable?: boolean
  align?: "left" | "center" | "right"
  className?: string
  headerClassName?: string
  render: (row: T, index: number) => React.ReactNode
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  sortKey?: string
  sortOrder?: SortOrder
  onSort?: (key: string) => void
  emptyMessage?: string
  isLoading?: boolean
  className?: string
  rowClassName?: string | ((row: T, index: number) => string)
  onRowClick?: (row: T) => void
  pagination?: boolean
  pageSize?: number
  /** Rows this returns true for get an expand chevron; others get a blank cell. */
  expandable?: (row: T) => boolean
  /** Content shown in a full-width row beneath an expanded row. */
  renderExpanded?: (row: T) => React.ReactNode
}

function SortableHeader({
  children,
  isActive,
  order,
  onClick,
  align = "left",
}: {
  children: React.ReactNode
  isActive: boolean
  order: SortOrder
  onClick: () => void
  align?: "left" | "center" | "right"
}) {
  const Icon = !isActive ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center hover:text-foreground transition-colors uppercase",
        align === "right" && "ml-auto",
        align === "center" && "mx-auto"
      )}
    >
      {children}
      <Icon className="ml-2 h-4 w-4" />
    </button>
  )
}

export function DataTable<T>({
  data,
  columns,
  sortKey,
  sortOrder = "asc",
  onSort,
  emptyMessage = "No data available",
  isLoading = false,
  className,
  rowClassName,
  onRowClick,
  pagination = false,
  pageSize = 10,
  expandable,
  renderExpanded,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [expandedRows, setExpandedRows] = React.useState<Set<number>>(new Set())

  // Reset to page 1 when the dataset size changes (new filters/search/etc.) —
  // adjusted during render instead of an effect, per React's guidance for
  // resetting state in response to a prop change.
  const [prevDataLength, setPrevDataLength] = React.useState(data.length)
  if (data.length !== prevDataLength) {
    setPrevDataLength(data.length)
    setCurrentPage(1)
  }

  const toggleExpanded = (globalIndex: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(globalIndex)) next.delete(globalIndex)
      else next.add(globalIndex)
      return next
    })
  }

  const getAlignClass = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "center":
        return "text-center"
      case "right":
        return "text-right"
      default:
        return "text-left"
    }
  }

  const totalPages = Math.ceil(data.length / pageSize)
  const paginatedData = pagination ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize) : data
  const colCount = columns.length + (renderExpanded ? 1 : 0)

  return (
    <Card className={cn("bg-card border-border flex flex-col", className)}>
      <div className="overflow-x-auto flex-1">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr className="bg-muted/50">
              {renderExpanded && <th className="w-10 px-2" aria-hidden />}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-6 py-3 font-mono text-[10px] font-normal tracking-widest text-muted-foreground uppercase",
                    getAlignClass(column.align),
                    column.headerClassName
                  )}
                >
                  {column.sortable && onSort ? (
                    <SortableHeader
                      isActive={sortKey === column.key}
                      order={sortOrder}
                      onClick={() => onSort(column.key)}
                      align={column.align}
                    >
                      {column.header}
                    </SortableHeader>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-12 text-center text-muted-foreground italic">
                  Loading…
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-12 text-center text-muted-foreground italic">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const globalIndex = pagination ? (currentPage - 1) * pageSize + index : index
                const isExpandable = !!renderExpanded && !!expandable?.(row)
                const isExpanded = isExpandable && expandedRows.has(globalIndex)
                return (
                  <React.Fragment key={globalIndex}>
                    <tr
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        onRowClick && "cursor-pointer",
                        typeof rowClassName === "function" ? rowClassName(row, index) : rowClassName
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {renderExpanded && (
                        <td className="px-2 py-4">
                          {isExpandable && (
                            <button
                              type="button"
                              aria-label={isExpanded ? "Collapse row" : "Expand row"}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpanded(globalIndex)
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                            </button>
                          )}
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.key} className={cn("px-6 py-4 text-sm", getAlignClass(column.align), column.className)}>
                          {column.render(row, index)}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/30">
                        <td colSpan={colCount} className="px-6 py-4">
                          {renderExpanded!(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && data.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{" "}
            <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, data.length)}</span> of{" "}
            <span className="font-medium text-foreground">{data.length}</span> results
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function useTableSort<T extends string>(initialKey?: T, initialOrder: SortOrder = "desc") {
  const [sortKey, setSortKey] = React.useState<T | undefined>(initialKey)
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(initialOrder)

  const toggleSort = React.useCallback(
    (key: T) => {
      if (sortKey === key) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortOrder("desc")
      }
    },
    [sortKey]
  )

  return { sortKey, sortOrder, toggleSort }
}
