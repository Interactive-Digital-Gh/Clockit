"use client"

import { useEffect, useState } from "react"
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
import { Pencil, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { RequireRole } from "@/components/require-role"
import { ADMIN_ROLES, type Agency } from "@/lib/types"

function toCsv(values: string[] | undefined): string {
  return (values ?? []).join(", ")
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function EditNetworkConfigDialog({ agency, onSaved }: { agency: Agency; onSaved: (updated: Agency) => void }) {
  const [open, setOpen] = useState(false)
  const [subnets, setSubnets] = useState(toCsv(agency.network_config?.allowed_subnets))
  const [ssids, setSsids] = useState(toCsv(agency.network_config?.allowed_ssids))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const network_config = {
      ...agency.network_config,
      allowed_subnets: fromCsv(subnets),
      allowed_ssids: fromCsv(ssids),
    }
    const { error } = await supabase.from("agencies").update({ network_config }).eq("id", agency.id)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Updated network config for ${agency.name}`)
    onSaved({ ...agency, network_config })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Pencil className="h-3.5 w-3.5" />
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
            <Label htmlFor="subnets">Allowed IP prefixes</Label>
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
          <div className="grid gap-2">
            <Label htmlFor="ssids">Allowed WiFi network names (SSIDs)</Label>
            <Input
              id="ssids"
              value={ssids}
              onChange={(e) => setSsids(e.target.value)}
              placeholder="Ninani Office WiFi"
            />
            <p className="text-xs text-muted-foreground">Comma-separated exact network names. Leave blank if not used yet.</p>
          </div>
        </div>
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
            ) : (
              "Save changes"
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

  useEffect(() => {
    const fetchAgencies = async () => {
      setIsLoading(true)
      const { data } = await supabase
        .from("agencies")
        .select("id, name, agency_code, address, is_active, network_config")
        .order("name")
      setAgencies((data as Agency[]) ?? [])
      setIsLoading(false)
    }
    fetchAgencies()
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
      header: "WiFi allowlist",
      render: (row) => {
        const subnets = row.network_config?.allowed_subnets ?? []
        const ssids = row.network_config?.allowed_ssids ?? []
        if (subnets.length === 0 && ssids.length === 0) {
          return <span className="text-muted-foreground italic">Any WiFi allowed</span>
        }
        return (
          <span className="text-xs">
            {subnets.length > 0 && <span>{subnets.length} subnet{subnets.length === 1 ? "" : "s"}</span>}
            {subnets.length > 0 && ssids.length > 0 && <span> · </span>}
            {ssids.length > 0 && <span>{ssids.length} SSID{ssids.length === 1 ? "" : "s"}</span>}
          </span>
        )
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => <EditNetworkConfigDialog agency={row} onSaved={updateAgencyInList} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Agencies" description="Offices and their mobile clock-in WiFi rules." />
      <DataTable data={agencies} columns={columns} isLoading={isLoading} emptyMessage="No agencies found." />
    </div>
  )
}

export default function AgenciesPage() {
  return (
    <RequireRole allowed={ADMIN_ROLES}>
      <AgenciesPageContent />
    </RequireRole>
  )
}
