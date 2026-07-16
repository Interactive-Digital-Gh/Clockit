"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Loader2, Plus, Trash2, Wifi, TriangleAlert } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { toast } from "sonner"
import { RequireRole } from "@/components/require-role"
import { AGENCIES_CHANGED_EVENT } from "@/components/network-setup-banner"
import { ADMIN_ROLES, type Agency } from "@/lib/types"

function notifyAgenciesChanged() {
  window.dispatchEvent(new Event(AGENCIES_CHANGED_EVENT))
}

function toCsv(values: string[] | undefined): string {
  return (values ?? []).join(", ")
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function EditNetworkConfigDialog({
  agency,
  onSaved,
  defaultOpen = false,
}: {
  agency: Agency
  onSaved: (updated: Agency) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [publicIps, setPublicIps] = useState(toCsv(agency.network_config?.allowed_public_ips))
  const [subnets, setSubnets] = useState(toCsv(agency.network_config?.allowed_subnets))
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setSaving(true)
    const network_config = {
      description: agency.network_config?.description,
      allowed_public_ips: fromCsv(publicIps),
      allowed_subnets: fromCsv(subnets),
    }
    try {
      const updated = await api.updateAgencyNetworkConfig(agency.id, network_config)
      toast.success(`Updated network config for ${agency.name}`)
      onSaved(updated)
      notifyAgenciesChanged()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to update agency")
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setConfirming(false)
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Wifi className="h-3.5 w-3.5" />
        Edit WiFi
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit WiFi allowlist — {agency.name}</DialogTitle>
          <DialogDescription>
            Controls which networks the mobile app accepts for clock-in at this agency.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="publicIps">Office public IP(s)</Label>
            <Input
              id="publicIps"
              value={publicIps}
              onChange={(e) => setPublicIps(e.target.value)}
              placeholder="203.0.113.7"
            />
            <p className="text-xs text-muted-foreground">
              The office&apos;s public/WAN IP — the strongest &quot;really on-site&quot; signal, since the server
              sees it directly and the app can&apos;t fake it. Comma-separated; a prefix like <code>203.0.113.</code>{" "}
              matches a range. Find it by visiting a &quot;what&apos;s my IP&quot; site on the office WiFi.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subnets">Allowed IP prefixes (device LAN)</Label>
            <Input
              id="subnets"
              value={subnets}
              onChange={(e) => setSubnets(e.target.value)}
              placeholder="192.168.1., 192.168.2."
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated IP prefixes, each ending in a dot — e.g. <code>192.168.1.</code>. The app matches
              a device&apos;s IP with <code>startsWith()</code>, so ranges like &quot;192.168.0.0 to 192.168.0.255&quot;
              won&apos;t work — use one prefix entry per subnet instead.
            </p>
          </div>
        </div>
        {confirming && (
          <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            Are you sure? These rules decide whether clock-ins verify as on-site.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : confirming ? (
              "Yes, save changes"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditAgencyDialog({ agency, onSaved }: { agency: Agency; onSaved: (updated: Agency) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(agency.name)
  const [code, setCode] = useState(agency.agency_code ?? "")
  const [address, setAddress] = useState(agency.address ?? "")
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    setConfirming(false)
    if (next) {
      setName(agency.name)
      setCode(agency.agency_code ?? "")
      setAddress(agency.address ?? "")
    }
  }

  const handleSave = async () => {
    if (!name.trim() || saving) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateAgency(agency.id, {
        name: name.trim(),
        agency_code: code.trim() || null,
        address: address.trim() || null,
      })
      toast.success(`Updated ${updated.name}`)
      onSaved(updated)
      notifyAgenciesChanged()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to update agency")
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit agency — {agency.name}</DialogTitle>
          <DialogDescription>
            Name, code, and address. WiFi verification rules have their own dialog.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-agency-name">Name</Label>
            <Input id="edit-agency-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-agency-code">Code</Label>
            <Input id="edit-agency-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ID-HQ" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-agency-address">Address</Label>
            <Input id="edit-agency-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        {confirming && (
          <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            Are you sure? This changes the agency&apos;s details everywhere it appears.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : confirming ? (
              "Yes, save changes"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteAgencyDialog({ agency, onDeleted }: { agency: Agency; onDeleted: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.deleteAgency(agency.id)
      toast.success(`Deleted ${agency.name}`)
      onDeleted(agency.id)
      notifyAgenciesChanged()
      setOpen(false)
    } catch (error) {
      // 409 = employees still assigned; the API message explains what to do.
      toast.error(error instanceof ApiError ? error.message : "Failed to delete agency")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${agency.name}`}
          />
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-destructive" />
            Delete {agency.name}?
          </DialogTitle>
          <DialogDescription className="pt-2">
            Are you sure? This cannot be undone — the agency and its WiFi verification rules are
            removed permanently. Deleting is blocked while employees are still assigned to it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Yes, delete it"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddAgencyDialog({ onCreated }: { onCreated: (agency: Agency) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName("")
    setCode("")
    setAddress("")
  }

  const handleCreate = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const created = await api.createAgency({
        name: name.trim(),
        agency_code: code.trim() || undefined,
        address: address.trim() || undefined,
      })
      toast.success(`Created ${created.name} — set its WiFi rules so clock-ins verify as on-site`)
      onCreated(created)
      notifyAgenciesChanged()
      setOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to create agency")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="h-4 w-4" />
        Add agency
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add agency</DialogTitle>
          <DialogDescription>
            A new office or team whose employees clock in with Clockit. You can configure its
            on-site WiFi rules afterwards with &quot;Edit WiFi&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="agency-name">Name</Label>
            <Input
              id="agency-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rezultz HQ"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agency-code">Code (optional)</Label>
            <Input
              id="agency-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="RZ-HQ"
            />
            <p className="text-xs text-muted-foreground">A short identifier used in lists and exports.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agency-address">Address (optional)</Label>
            <Input
              id="agency-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="12 Independence Ave, Accra"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create agency"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AgenciesPageContent() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // ?configure=<agencyId> (from the network-setup banner) auto-opens that
  // agency's WiFi dialog.
  const configureId = useSearchParams().get("configure")

  useEffect(() => {
    let cancelled = false
    api
      .agencies()
      .then((data) => {
        if (!cancelled) setAgencies(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const updateAgencyInList = (updated: Agency) => {
    setAgencies((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  const columns: ColumnDef<Agency>[] = [
    { key: "name", header: "Agency", render: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { key: "agency_code", header: "Code", render: (row) => row.agency_code ?? "—" },
    { key: "address", header: "Address", render: (row) => row.address ?? "—" },
    {
      key: "network",
      header: "On-site check",
      render: (row) => {
        const publicIps = row.network_config?.allowed_public_ips ?? []
        const subnets = row.network_config?.allowed_subnets ?? []
        if (publicIps.length === 0 && subnets.length === 0) {
          return (
            <span className="text-muted-foreground italic" title="All clock-ins here will show as Remote">
              Not configured
            </span>
          )
        }
        return (
          <span className="text-xs">
            {publicIps.length > 0 && <span>{publicIps.length} public IP{publicIps.length === 1 ? "" : "s"}</span>}
            {publicIps.length > 0 && subnets.length > 0 && <span> · </span>}
            {subnets.length > 0 && <span>{subnets.length} subnet{subnets.length === 1 ? "" : "s"}</span>}
          </span>
        )
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <EditNetworkConfigDialog
            agency={row}
            onSaved={updateAgencyInList}
            defaultOpen={row.id === configureId}
          />
          <EditAgencyDialog agency={row} onSaved={updateAgencyInList} />
          <DeleteAgencyDialog
            agency={row}
            onDeleted={(id) => setAgencies((prev) => prev.filter((a) => a.id !== id))}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Agencies" description="Offices and their mobile clock-in WiFi rules.">
        <AddAgencyDialog onCreated={(created) => setAgencies((prev) => [...prev, created])} />
      </PageHeader>
      <DataTable data={agencies} columns={columns} isLoading={isLoading} emptyMessage="No agencies found." />
    </div>
  )
}

export default function AgenciesPage() {
  return (
    <RequireRole allowed={ADMIN_ROLES}>
      {/* Suspense: useSearchParams needs it during static prerender */}
      <Suspense>
        <AgenciesPageContent />
      </Suspense>
    </RequireRole>
  )
}
