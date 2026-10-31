import { createClient } from '@/lib/supabase/server'
import { safeRedirect } from '@/lib/buyer/validation'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const {searchParams,origin}=new URL(request.url)
  const next=safeRedirect(searchParams.get('next')||searchParams.get('redirect'))
  const supabase=await createClient()
  const code=searchParams.get('code')
  const tokenHash=searchParams.get('token_hash')
  const type=searchParams.get('type')
  const allowedTypes=['signup','recovery','email','invite','email_change']
  const result=code?await supabase.auth.exchangeCodeForSession(code):tokenHash&&type&&allowedTypes.includes(type)?await supabase.auth.verifyOtp({token_hash:tokenHash,type:type as EmailOtpType}):null
  if(!result||result.error||!result.data.user) return NextResponse.redirect(new URL('/login?error=auth_failed',origin))
  if(next==='/reset-password'||type==='recovery') return NextResponse.redirect(new URL('/reset-password',origin))
  const user=result.data.user
  const {data:existing,error:lookupError}=await supabase.from('users').select('id,role').eq('id',user.id).maybeSingle()
  if(lookupError) return NextResponse.redirect(new URL('/login?error=profile_failed',origin))
  if(!existing) {
    // Only a new account can choose vendor. Administrator access never comes from signup data.
    const role=user.user_metadata?.role==='vendor'||searchParams.get('role')==='vendor'?'vendor':'buyer'
    const {error}=await supabase.from('users').insert({id:user.id,email:user.email??'',full_name:user.user_metadata?.full_name??'',avatar_url:user.user_metadata?.avatar_url??'',role})
    if(error) return NextResponse.redirect(new URL('/login?error=profile_failed',origin))
    if(role==='vendor') return NextResponse.redirect(new URL('/vendor/onboarding',origin))
  }
  // Auth triggers can create the profile before this callback runs. An existing
  // buyer still needs to consent to enrollment; never change their role in a GET.
  if(searchParams.get('role')==='vendor' && existing?.role!=='vendor') {
    return NextResponse.redirect(new URL('/start-selling',origin))
  }
  return NextResponse.redirect(new URL(next,origin))
}
