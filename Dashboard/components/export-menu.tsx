"use client"

import { Download, ChevronDown, FileSpreadsheet, File, FileText } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportAttendanceReport } from "@/lib/export-utils"
import type { AttendanceRecord } from "@/lib/types"

interface ExportMenuProps {
  records: AttendanceRecord[]
  dateRange?: { start: Date; end: Date }
  filenamePrefix?: string
}

export function ExportMenu({ records, dateRange, filenamePrefix = "attendance_report" }: ExportMenuProps) {
  const handleExport = (exportFormat: "csv" | "excel" | "pdf") => {
    if (records.length === 0) {
      toast.error("No data to export", { description: "Adjust your filters to include some records." })
      return
    }

    const ext = exportFormat === "excel" ? "xlsx" : exportFormat
    const dateSuffix = dateRange
      ? `${dateRange.start.toISOString().split("T")[0]}_to_${dateRange.end.toISOString().split("T")[0]}`
      : new Date().toISOString().split("T")[0]

    try {
      exportAttendanceReport(records, {
        format: exportFormat,
        filename: `${filenamePrefix}_${dateSuffix}.${ext}`,
        dateRange,
      })
      toast.success("Report exported", { description: `Your ${exportFormat.toUpperCase()} file has been downloaded.` })
    } catch (error) {
      toast.error("Export failed", { description: error instanceof Error ? error.message : "Please try again." })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="gap-2" />}>
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-4 w-4 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <span>Export as Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
          <File className="h-4 w-4 text-red-600" />
          <span>Export as PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>Export as CSV</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
