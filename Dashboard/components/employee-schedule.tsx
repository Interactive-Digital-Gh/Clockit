"use client"

import { useState } from "react"
import { api, ApiError } from "@/lib/api"
import type { Employee, WorkMode } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const LABELS = { office: "Office", remote: "Remote", off: "Off duty" }
const newWeek = (mode: WorkMode = "remote"): WorkMode[] => [mode, mode, mode, mode, mode, "off", "off"]
const MONTH_BLOCKS = ["Days 1–7", "Days 8–14", "Days 15–21", "Days 22–28", "Days 29–end"]
function monthStart() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
}
function monday() {
  const date = new Date()
  date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function EmployeeSchedule({ employee, onSaved }: { employee: Employee; onSaved: (value: Employee) => void }) {
  const [open, setOpen] = useState(false)
  const [weeks, setWeeks] = useState<WorkMode[][]>([newWeek()])
  const [pattern, setPattern] = useState<"cycle" | "monthly">("cycle")
  const [startsOn, setStartsOn] = useState("")
  const [saving, setSaving] = useState(false)
  const schedule = employee.work_schedule
  const applyPreset = (preset: string) => {
    const monthly = preset.startsWith("monthly")
    setPattern(monthly ? "monthly" : "cycle")
    setStartsOn(monthly ? monthStart() : monday())
    const modes: WorkMode[] = preset === "two-two" ? ["remote", "remote", "office", "office"]
      : preset === "monthly-two" ? ["remote", "remote", "office", "office", "office"]
      : preset === "monthly-one" ? ["remote", "office", "office", "office", "office"]
      : ["remote", "office"]
    setWeeks(modes.map(newWeek))
  }
  const save = async (clear = false) => {
    if (!clear && (!startsOn || (pattern === "monthly" ? !startsOn.endsWith("-01") : new Date(`${startsOn}T12:00:00Z`).getUTCDay() !== 1))) {
      toast.error(pattern === "monthly" ? "Choose the first day of a month" : "Choose a Monday as the start of Week 1")
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateEmployee(employee.id, { work_schedule: clear ? null : { pattern, starts_on: startsOn, weeks } })
      onSaved(updated)
      toast.success(clear ? "Schedule removed" : "Work schedule saved")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the schedule")
    } finally { setSaving(false) }
  }
  return <div className="min-w-56 space-y-2">
    {schedule ? schedule.weeks.map((week, index) => <p key={index} className="text-xs text-muted-foreground">
      {schedule.pattern === "monthly" ? `${MONTH_BLOCKS[index]}: ` : schedule.weeks.length > 1 ? `Week ${index + 1}: ` : ""}
      {week.map((mode, day) => mode === "office" ? DAYS[day].slice(0, 3) : null).filter(Boolean).join(", ") || "No office days"}
    </p>) : <p className="text-xs text-muted-foreground">No schedule set</p>}
    {employee.expected_work_mode && <p className="text-xs">Today: {LABELS[employee.expected_work_mode]}</p>}
    <Dialog open={open} onOpenChange={(next) => {
      if (saving) return
      if (next) {
        setWeeks(schedule ? schedule.weeks.map((week) => [...week]) : [newWeek()])
        setStartsOn(schedule?.starts_on ?? monday())
        setPattern(schedule?.pattern ?? "cycle")
      }
      setOpen(next)
    }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {schedule ? "Edit schedule" : "Set schedule"}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Work schedule — {employee.name}</DialogTitle>
          <DialogDescription>Choose a repeating cycle or a monthly pattern. Weekday locations are planned separately from actual attendance.</DialogDescription>
        </DialogHeader>
        <label className="text-sm">Apply a preset
          <select className="mt-2 block w-full rounded-md border bg-background p-2" value="" disabled={saving} onChange={(event) => applyPreset(event.target.value)}>
            <option value="" disabled>Choose a pattern to customise…</option>
            <option value="one-one">1 week remote, 1 week on-site</option>
            <option value="two-two">2 weeks remote, 2 weeks on-site</option>
            <option value="monthly-one">1 remote week per month (days 1–7)</option>
            <option value="monthly-two">2 remote weeks per month (days 1–14)</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Repeat pattern
            <select className="mt-2 block w-full rounded-md border bg-background p-2" value={pattern === "monthly" ? "monthly" : weeks.length} disabled={saving} onChange={(event) => {
              if (event.target.value === "monthly") {
                setPattern("monthly")
                setWeeks((current) => Array.from({ length: 5 }, (_, index) => current[index] ?? newWeek("office")))
                setStartsOn(`${(startsOn || monday()).slice(0, 7)}-01`)
              } else {
                setPattern("cycle")
                setWeeks((current) => Array.from({ length: Number(event.target.value) }, (_, index) => current[index] ?? newWeek()))
                if (pattern === "monthly") setStartsOn(monday())
              }
            }}>
              {Array.from({ length: 8 }, (_, index) => <option key={index} value={index + 1}>{index === 0 ? "Every week" : `Every ${index + 1} weeks`}</option>)}
              <option value="monthly">Every calendar month</option>
            </select>
          </label>
          <label className="text-sm">{pattern === "monthly" ? "Starts on (first of month)" : "Week 1 starts (Monday)"}
            <Input className="mt-2" type="date" value={startsOn} disabled={saving} onChange={(event) => setStartsOn(event.target.value)} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{pattern === "monthly"
          ? "Each month resets: days 1–7, 8–14, 15–21, 22–28, and 29–end. In each block, set the location for the actual weekday. The last block only applies when those dates exist."
          : "The cycle repeats continuously from Week 1, including across month boundaries."} Presets leave weekends off duty. Adjust any day below.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {weeks.map((week, weekIndex) => <fieldset key={weekIndex} className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{pattern === "monthly" ? MONTH_BLOCKS[weekIndex] : `Week ${weekIndex + 1}`}</legend>
            {week.map((mode, day) => <label key={day} className="flex items-center justify-between gap-3 text-sm">
              {DAYS[day]}
              <select aria-label={`${pattern === "monthly" ? MONTH_BLOCKS[weekIndex] : `Week ${weekIndex + 1}`} ${DAYS[day]}`} className="rounded-md border bg-background p-2" value={mode} disabled={saving} onChange={(event) => setWeeks((current) => current.map((days, index) => index === weekIndex ? days.map((value, i) => i === day ? event.target.value as WorkMode : value) : days))}>
                <option value="office">Office</option><option value="remote">Remote</option><option value="off">Off duty</option>
              </select>
            </label>)}
          </fieldset>)}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {schedule && <Button variant="destructive" disabled={saving} onClick={() => save(true)}>Remove schedule</Button>}
          <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => save()}>{saving ? "Saving…" : "Save schedule"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
}
