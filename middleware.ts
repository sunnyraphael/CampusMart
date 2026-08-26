import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // NextResponse.next() means "continue — let the request through"
  // We start by assuming we'll let them through, then check
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Create a Supabase client that works in middleware
  // Middleware runs on the "edge" (between internet and your server)
  // so it can't use the regular server client — it needs this special version
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Middleware reads cookies from the incoming request
        getAll() {
          return request.cookies.getAll()
        },
        // And writes updated cookies to the outgoing response
        // This keeps the user's session alive (refreshes it if needed)
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response = NextResponse.next({
              request: { headers: request.headers },
            })
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getUser() reads the session from the cookie
  // It does NOT make a database call — it just decodes the JWT token
  // So this is fast and free (no Supabase round-trip)
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // ── Vendor route protection ──────────────────────────────────────
  // Check if the person is trying to visit any /vendor/* page
  if (path.startsWith('/vendor')) {

    // Rule 1: Not logged in at all → send to login
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      // Save where they were trying to go so we can send them back after login
      loginUrl.searchParams.set('redirectTo', path)
      return NextResponse.redirect(loginUrl)
    }

    // Rule 2: Logged in but NOT a seller → send to homepage
    // We read role from user_metadata (set during registration)
    const role = user.user_metadata?.role
    if (role !== 'vendor') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Rule 3: They're a logged-in seller → let them through
    return response
  }

  // ── Auth page protection ──────────────────────────────────────────
  // If someone is already logged in and tries to visit /login or /register
  // send them to the homepage instead — no point showing login to someone logged in
  if (path.startsWith('/login') || path.startsWith('/register')) {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // All other pages — just let them through
  return response
}

// This tells Next.js which URLs the middleware should run on
// Without this, middleware would run on EVERY request including
// images, fonts, CSS files — which would slow everything down
export const config = {
  matcher: [
    // Run on all pages EXCEPT Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}