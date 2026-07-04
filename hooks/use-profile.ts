"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"

export function useProfile() {
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setProfile(null)
          setIsLoading(false)
        }
        return
      }

      const { data } = await supabase.from("profiles").select("id, email, full_name, role, created_at").eq("id", user.id).single()

      if (!cancelled) {
        setProfile(data as Profile | null)
        setIsLoading(false)
      }
    }

    fetchProfile()

    return () => {
      cancelled = true
    }
  }, [])

  return { profile, isLoading }
}
