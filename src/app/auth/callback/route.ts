import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // ?next= is set by Google OAuth flow; ?redirect= is set by our register page link
  const next = searchParams.get("next") || searchParams.get("redirect") || "/"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user

      // Check if user row already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", user.id)
        .single()

      if (!existingUser) {
        // Read the role from user_metadata — set during signup via signUp({ data: { role } })
        const role = user.user_metadata?.role ?? "buyer"

        await supabase.from("users").insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name ?? "",
          avatar_url: user.user_metadata?.avatar_url ?? "",
          role,
        })

        // New vendor → always send to onboarding regardless of ?next=
        if (role === "vendor") {
          return NextResponse.redirect(`${origin}/vendor/onboarding`)
        }
      }

      // Existing user or new buyer → go to intended destination
      const redirectTo = next.startsWith("/") ? next : "/"
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
