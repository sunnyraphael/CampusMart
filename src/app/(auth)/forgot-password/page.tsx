import AuthForm from '@/components/buyer/AuthForm'
import { safeRedirect } from '@/lib/buyer/validation'

export default async function Page({searchParams}:{searchParams:Promise<{redirectTo?:string;role?:string;error?:string}>}) {
  const params=await searchParams
  return <AuthForm mode="forgot" next={safeRedirect(params.redirectTo)} vendor={params.role==='vendor'} initialError={params.error?'The sign-in or recovery link could not be completed. Please try again.':''}/>
}
