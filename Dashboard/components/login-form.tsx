"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Script from "next/script"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, ApiError } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

// Minimal typing for the Google Identity Services global.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

interface LoginFormProps extends React.ComponentPropsWithoutRef<"form"> {
  /** Where to land after a successful sign-in — e.g. a QR scan link (/scan?t=...)
   * that redirected here to authenticate first. Defaults to the dashboard home. */
  redirectTo?: string
}

// Sign-in options:
// - Google (production path): GIS button → ID token → POST /auth/google/admin.
// - Password: for profiles that had a password set via /dashboard/users →
//   POST /auth/login/password. Independent of Google.
export function LoginForm({ className, redirectTo, ...props }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement>(null)

  const finishLogin = useCallback(() => {
    toast.success("Signed in")
    router.push(redirectTo ?? "/dashboard")
    router.refresh()
  }, [router, redirectTo])

  const initGoogle = useCallback(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || !googleButtonRef.current) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        setIsLoading(true)
        try {
          await api.googleLogin(credential)
          finishLogin()
        } catch (error: unknown) {
          const message =
            error instanceof ApiError && error.status === 403
              ? "This Google account has no dashboard access. Ask an administrator to add you."
              : error instanceof Error
                ? error.message
                : "Google sign-in failed"
          toast.error(message)
          setIsLoading(false)
        }
      },
    })
    // GIS wants a fixed pixel width, not a percentage — a hardcoded value
    // overflows on narrow phones (most scans of the front-desk QR land here),
    // so size it to whatever room the card actually has instead. Google
    // clamps to its own [200, 400] range regardless.
    const width = Math.min(googleButtonRef.current.offsetWidth || 320, 400)
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width,
      text: "signin_with",
      shape: "rectangular",
    })
  }, [finishLogin])

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setIsLoading(true)
    try {
      await api.passwordLogin(email, password)
      finishLogin()
    } catch (error: unknown) {
      const message =
        error instanceof ApiError && error.status === 401
          ? "Incorrect email or password."
          : error instanceof Error
            ? error.message
            : "Could not sign in"
      toast.error(message)
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handlePasswordLogin} className={cn("flex flex-col gap-6", className)} {...props}>
      {GOOGLE_CLIENT_ID && (
        <Script src="https://accounts.google.com/gsi/client" onReady={initGoogle} />
      )}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-[26px] leading-[1.15] font-bold tracking-tight text-foreground">
          Welcome back,
          <br />
          let&apos;s clock in.
        </h1>
        <p className="text-balance text-sm text-muted-foreground">
          Sign in with your work Google account — Interactive Digital, Rezultz, BrandAlert,
          InnovaDDB, P2P.
        </p>
      </div>
      <div className="grid gap-5">
        <div className="flex min-h-11 justify-center" ref={googleButtonRef}>
          {!GOOGLE_CLIENT_ID && (
            <p className="text-sm text-muted-foreground">
              Google sign-in isn&apos;t configured yet.
            </p>
          )}
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-[11px] font-medium tracking-wide uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or sign in with a password</span>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@interactivedigital.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </div>
    </form>
  )
}
