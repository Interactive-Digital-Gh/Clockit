import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import { autoTable } from "jspdf-autotable"
import { format } from "date-fns"

import type { AttendanceRecord } from "./types"
import { formatDate, formatTime, formatHours, ATTENDANCE_STATUS, type AttendanceStatusKey } from "./utils"

export type ExportFileFormat = "csv" | "excel" | "pdf"

export interface ExportOptions {
  format: ExportFileFormat
  filename?: string
  dateRange?: { start: Date; end: Date }
}

function statusLabel(status: string): string {
  return ATTENDANCE_STATUS[status as AttendanceStatusKey]?.label ?? status
}

function defaultFilename(ext: string): string {
  return `attendance_report_${format(new Date(), "yyyy-MM-dd")}.${ext}`
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function toCsv(records: AttendanceRecord[]): string {
  const header = ["Date", "Employee", "Email", "Agency", "Clock in", "Clock out", "Status", "Total hours"]
  const lines = records.map((r) =>
    [
      r.date,
      r.employee?.name ?? "",
      r.employee?.email ?? "",
      r.employee?.agency?.name ?? "",
      formatTime(r.clock_in_time),
      formatTime(r.clock_out_time),
      statusLabel(r.status),
      r.total_hours ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  )
  return [header.join(","), ...lines].join("\n")
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Shared per-employee summary (used by Excel + PDF)
// ---------------------------------------------------------------------------

interface EmployeeSummary {
  name: string
  email: string
  agency: string
  daysPresent: number
  daysLate: number
  totalHours: number
}

function summarizeByEmployee(records: AttendanceRecord[]): EmployeeSummary[] {
  const map = new Map<string, EmployeeSummary>()
  for (const r of records) {
    const entry = map.get(r.employee_id) ?? {
      name: r.employee?.name ?? "Unknown",
      email: r.employee?.email ?? "",
      agency: r.employee?.agency?.name ?? "",
      daysPresent: 0,
      daysLate: 0,
      totalHours: 0,
    }
    if (r.status === "late") entry.daysLate += 1
    else entry.daysPresent += 1
    entry.totalHours += r.total_hours ?? 0
    map.set(r.employee_id, entry)
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

export function exportToExcel(records: AttendanceRecord[], options: Partial<ExportOptions> = {}): void {
  const filename = options.filename ?? defaultFilename("xlsx")
  const workbook = XLSX.utils.book_new()

  const recordRows = [
    ["Date", "Employee", "Email", "Agency", "Clock in", "Clock out", "Status", "Total hours"],
    ...records.map((r) => [
      r.date,
      r.employee?.name ?? "",
      r.employee?.email ?? "",
      r.employee?.agency?.name ?? "",
      formatTime(r.clock_in_time),
      formatTime(r.clock_out_time),
      statusLabel(r.status),
      r.total_hours ?? "",
    ]),
  ]
  const recordSheet = XLSX.utils.aoa_to_sheet(recordRows)
  recordSheet["!cols"] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 26 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(workbook, recordSheet, "Attendance Records")

  const summary = summarizeByEmployee(records)
  const summaryRows = [
    ["Employee", "Email", "Agency", "Days present", "Days late", "Total hours"],
    ...summary.map((s) => [s.name, s.email, s.agency, s.daysPresent, s.daysLate, Math.round(s.totalHours * 10) / 10]),
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")

  XLSX.writeFile(workbook, filename)
}

// ---------------------------------------------------------------------------
// PDF export
// ---------------------------------------------------------------------------

type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

export function exportToPDF(records: AttendanceRecord[], options: Partial<ExportOptions> = {}): void {
  const filename = options.filename ?? defaultFilename("pdf")
  const pdf = new jsPDF("portrait", "mm", "a4") as DocWithAutoTable
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  let yPos = 18

  pdf.setFontSize(16)
  pdf.setFont("helvetica", "bold")
  pdf.text("ATTENDANCE REPORT", pageWidth / 2, yPos, { align: "center" })
  yPos += 8

  if (options.dateRange) {
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    const dateStr = `${format(options.dateRange.start, "MMM d, yyyy")} – ${format(options.dateRange.end, "MMM d, yyyy")}`
    pdf.text(dateStr, pageWidth / 2, yPos, { align: "center" })
    yPos += 10
  } else {
    yPos += 6
  }

  const present = records.filter((r) => r.status !== "late").length
  const late = records.filter((r) => r.status === "late").length
  const totalHours = records.reduce((sum, r) => sum + (r.total_hours ?? 0), 0)

  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.text("Summary", 14, yPos)
  yPos += 6

  autoTable(pdf, {
    startY: yPos,
    head: [["Total records", "On time", "Late", "Total hours"]],
    body: [[String(records.length), String(present), String(late), formatHours(totalHours)]],
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, halign: "center" },
    margin: { left: 14, right: 14 },
  })

  yPos = (pdf.lastAutoTable?.finalY ?? yPos) + 10

  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.text("Attendance Records", 14, yPos)
  yPos += 6

  const tableData = records.map((r) => [
    formatDate(r.date),
    r.employee?.name ?? "—",
    r.employee?.agency?.name ?? "—",
    formatTime(r.clock_in_time),
    formatTime(r.clock_out_time),
    formatHours(r.total_hours),
    statusLabel(r.status),
  ])

  autoTable(pdf, {
    startY: yPos,
    head: [["Date", "Employee", "Agency", "Clock in", "Clock out", "Hours", "Status"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const pageCount = pdf.getNumberOfPages()
      const currentPage = pdf.getCurrentPageInfo().pageNumber
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "normal")
      pdf.text(`Page ${currentPage} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" })
    },
  })

  pdf.save(filename)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function exportAttendanceReport(records: AttendanceRecord[], options: ExportOptions): void {
  if (!records || records.length === 0) {
    throw new Error("No records to export")
  }

  switch (options.format) {
    case "csv":
      downloadCsv(toCsv(records), options.filename ?? defaultFilename("csv"))
      break
    case "excel":
      exportToExcel(records, options)
      break
    case "pdf":
      exportToPDF(records, options)
      break
    default:
      throw new Error(`Unsupported export format: ${options.format}`)
  }
}
