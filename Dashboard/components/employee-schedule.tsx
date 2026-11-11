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
const newWeek = (): WorkMode[] => ["remote", "remote", "remote", "remote", "remote", "off", "off"]
function monday() {
  const date = new Date()
  date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function EmployeeSchedule({ employee, onSaved }: { employee: Employee; onSaved: (value: Employee) => void }) {
  const [open, setOpen] = useState(false)
  const [weeks, setWeeks] = useState<WorkMode[][]>([newWeek()])
  const [startsOn, setStartsOn] = useState("")
  const [saving, setSaving] = useState(false)
  const schedule = employee.work_schedule
  const save = async (clear = false) => {
    if (!clear && (!startsOn || new Date(`${startsOn}T12:00:00Z`).getUTCDay() !== 1)) {
      toast.error("Choose a Monday as the start of Week 1")
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateEmployee(employee.id, { work_schedule: clear ? null : { starts_on: startsOn, weeks } })
      onSaved(updated)
      toast.success(clear ? "Schedule removed" : "Work schedule saved")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the schedule")
    } finally { setSaving(false) }
  }
  return <div className="min-w-56 space-y-2">
    {schedule ? schedule.weeks.map((week, index) => <p key={index} className="text-xs text-muted-foreground">
      {schedule.weeks.length === 2 && `Week ${index + 1}: `}
      {week.map((mode, day) => mode === "office" ? DAYS[day].slice(0, 3) : null).filter(Boolean).join(", ") || "No office days"}
    </p>) : <p className="text-xs text-muted-foreground">No schedule set</p>}
    {employee.expected_work_mode && <p className="text-xs">Today: {LABELS[employee.expected_work_mode]}</p>}
    <Dialog open={open} onOpenChange={(next) => {
      if (saving) return
      if (next) {
        setWeeks(schedule ? schedule.weeks.map((week) => [...week]) : [newWeek()])
        setStartsOn(schedule?.starts_on ?? monday())
      }
      setOpen(next)
    }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {schedule ? "Edit schedule" : "Set schedule"}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Work schedule — {employee.name}</DialogTitle>
          <DialogDescription>Choose the planned work location for each day. This pattern repeats from Week 1. Actual attendance is recorded separately.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">Repeat pattern
            <select className="mt-2 block w-full rounded-md border bg-background p-2" value={weeks.length} disabled={saving} onChange={(event) => setWeeks((current) => event.target.value === "1" ? [current[0]] : [current[0], current[1] ?? newWeek()])}>
              <option value="1">Every week</option><option value="2">Every two weeks</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">Week 1 starts (Monday)
            <Input className="mt-2" type="date" value={startsOn} disabled={saving} onChange={(event) => setStartsOn(event.target.value)} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">For two office days a week, select Office on those days. For alternate weeks, set different office days in Week 1 and Week 2. Mark other days Remote or Off duty as appropriate.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {weeks.map((week, weekIndex) => <fieldset key={weekIndex} className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Week {weekIndex + 1}</legend>
            {week.map((mode, day) => <label key={day} className="flex items-center justify-between gap-3 text-sm">
              {DAYS[day]}
              <select aria-label={`Week ${weekIndex + 1} ${DAYS[day]}`} className="rounded-md border bg-background p-2" value={mode} disabled={saving} onChange={(event) => setWeeks((current) => current.map((days, index) => index === weekIndex ? days.map((value, i) => i === day ? event.target.value as WorkMode : value) : days))}>
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
