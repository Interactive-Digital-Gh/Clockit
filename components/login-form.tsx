"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, ApiError } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

// Local development sign-in. Uses the backend's DEV_MODE /auth/dev-login to mint
// a token from just an email — no password, no Google. When Google OAuth is
// wired up, swap handleLogin to obtain a Google ID token and POST it to
// /auth/google/admin instead, and re-enable the Google button below.
export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"form">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setIsLoading(true)
    try {
      await api.devLogin(email, "admin")
      toast.success("Signed in")
      router.push("/dashboard")
      router.refresh()
    } catch (error: unknown) {
      const message =
        error instanceof ApiError && error.status === 404
          ? "Dev login is disabled. Set DEV_MODE=true on the API, or wire up Google."
          : error instanceof Error
            ? error.message
            : "Could not sign in"
      toast.error(message)
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    toast.info("Google sign-in isn't configured yet — use the email field for local dev.")
  }

  return (
    <form onSubmit={handleLogin} className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Enter your admin email to access the dashboard
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@interactivedigital.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 488 512">
            <path
              fill="currentColor"
              d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
            />
          </svg>
          Login with Google
        </Button>
      </div>
    </form>
  )
}
