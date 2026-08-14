import Image from "next/image"
import { LoginForm } from "@/components/login-form"

// Only ever a same-origin relative path (e.g. "/scan?t=..."), never a full
// URL — `next` comes from a query param an attacker could craft, and this is
// the one place it enters the app, so sanitize it here rather than trust it
// downstream. A bare "/" prefix (and not "//", which browsers treat as
// protocol-relative to another host) is what makes it safe to hand to
// router.push().
function sanitizeNext(next: string | undefined): string | undefined {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return undefined
  return next
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return (
    <div className="bg-grid-paper relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Image src="/logo.png" alt="Clockit logo" width={22} height={22} className="size-5.5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Clock<span className="text-primary">it</span>
          </span>
        </div>

        <div className="w-full rounded-2xl border border-border bg-card p-7 shadow-[0_14px_34px_rgba(20,18,16,.08)]">
          <LoginForm redirectTo={sanitizeNext(next)} />
        </div>

        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Interactive Digital Group
        </span>
      </div>
    </div>
  )
}
