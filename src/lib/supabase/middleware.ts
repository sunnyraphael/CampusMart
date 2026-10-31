// src/lib/supabase/middleware.ts
import { localRedirectUrl, safeRedirect } from "@/lib/buyer/validation"
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Matches the route itself and anything under it, but not look-alikes.
// "/orders" and "/orders/12" match; "/orders-old" does not.
function isUnder(path: string, route: string) {
  return path === route || path.startsWith(route + "/")
}

const PROTECTED_ROUTES = ["/checkout", "/orders", "/profile", "/settings", "/wishlist", "/saved", "/messages", "/notifications", "/start-selling", "/vendor", "/admin"]
const AUTH_PAGES = ["/login", "/register"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Asks Supabase Auth to verify the session. Do not put code between
  // createServerClient and this line, it can cause random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Redirect helper. It copies any refreshed session cookies onto the
  // redirect, otherwise a token refresh that happened in this request is lost.
  function redirectTo(pathname: string, params?: Record<string, string>) {
    const url = localRedirectUrl(request.url, pathname)
    if (params) {
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    }
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  // Gate 1: must be logged in
  if (!user && PROTECTED_ROUTES.some((route) => isUnder(path, route))) {
    return redirectTo("/login", { redirectTo: path + request.nextUrl.search })
  }

  // Gate 2: /vendor needs the vendor role, read from the database
  if (user && path === "/vendor/new") return redirectTo("/start-selling")
  if (user && isUnder(path, "/vendor")) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    if (profile?.role !== "vendor") return redirectTo(path === "/vendor/onboarding" ? "/start-selling" : "/")
  }

  // Gate 3: /admin needs a row in the locked public.admins table
  if (user && isUnder(path, "/admin")) {
    const { data: isAdmin } = await supabase.rpc("is_admin")
    if (isAdmin !== true) return redirectTo("/")
  }

  // Logged-in people have no reason to see the login or register pages
  if (user && AUTH_PAGES.some((route) => isUnder(path, route))) {
    // A callback may have created a session before profile setup failed.
    // Keep recognized errors visible rather than silently sending that person home.
    if (["auth_failed", "profile_failed"].includes(request.nextUrl.searchParams.get("error") ?? "")) return supabaseResponse
    if (request.nextUrl.searchParams.get("role") === "vendor") return redirectTo("/start-selling")
    return redirectTo(safeRedirect(request.nextUrl.searchParams.get("redirectTo")))
  }

  return supabaseResponse
}
