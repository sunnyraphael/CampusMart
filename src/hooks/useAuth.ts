// Auth hook
"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuthStore } from "@/store/auth"
import { createClient as createServerClient } from "@/lib/supabase/client"

export function useAuth() {
  const { user, isLoading, setUser, clearUser } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single()
          setUser(profile)
        } else {
          clearUser()
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    clearUser()
  }

  return { user, isLoading, signOut }
}