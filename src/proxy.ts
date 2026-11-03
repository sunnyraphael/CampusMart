import { type NextRequest } from "next/server"
import { NextResponse } from 'next/server'
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  if (['/api/health','/api/operations/maintenance','/api/connectivity', '/api/paystack/webhook', '/api/payments/reconcile', '/sw.js', '/offline.html', '/offline.js', '/status.css'].includes(request.nextUrl.pathname)) return NextResponse.next()
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
