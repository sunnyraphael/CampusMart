import AuthForm from '@/components/buyer/AuthForm'
import { safeRedirect } from '@/lib/buyer/validation'

export default async function Page({searchParams}:{searchParams:Promise<{redirectTo?:string;role?:string;error?:string}>}) {
  const params=await searchParams
  const error=params.error==='profile_failed'
    ? 'You are signed in, but your account details could not be loaded. Please try again or contact support.'
    : params.error?'The sign-in or recovery link could not be completed. Please try again.':''
  return <AuthForm mode="login" next={safeRedirect(params.redirectTo)} vendor={params.role==='vendor'} initialError={error}/>
}
