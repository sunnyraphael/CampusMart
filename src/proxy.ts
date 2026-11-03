import {contentSecurityPolicy} from '@/lib/security/csp'
import { type NextRequest } from "next/server"
import { NextResponse } from 'next/server'
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  if (['/robots.txt','/sitemap.xml','/api/health','/api/operations/maintenance','/api/connectivity', '/api/paystack/webhook', '/api/payments/reconcile', '/sw.js', '/offline.html', '/offline.js', '/status.css'].includes(request.nextUrl.pathname)) return NextResponse.next()
  // Next.js reads the trusted request policy to nonce streamed framework scripts.
  const nonce=Buffer.from(crypto.randomUUID()).toString('base64')
  const policy=contentSecurityPolicy(nonce)
  request.headers.set('x-nonce',nonce)
  request.headers.set('Content-Security-Policy',policy)
  const response=await updateSession(request)
  response.headers.set('Content-Security-Policy',policy)
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
