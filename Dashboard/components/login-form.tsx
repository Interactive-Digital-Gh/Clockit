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

// Sign-in options:
// - Google (production path): GIS button → ID token → POST /auth/google/admin.
// - Password: for profiles that had a password set via /dashboard/users →
//   POST /auth/login/password. Independent of Google.
export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement>(null)

  const finishLogin = useCallback(() => {
    toast.success("Signed in")
    router.push("/dashboard")
    router.refresh()
  }, [router])

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
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width: 320,
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
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Ninani Group employees: sign in with your work Google account.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Interactive Digital · Rezultz · BrandAlert · InnovaDDB · P2P
        </p>
      </div>
      <div className="grid gap-6">
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
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or sign in with a password</span>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@interactivedigital.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in with password"
          )}
        </Button>
      </div>
    </form>
  )
}
