"use client"

import * as React from "react"
import { api } from "@/lib/api"
import type { Profile } from "@/lib/types"

export function useProfile() {
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    api
      .me()
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { profile, isLoading }
}
