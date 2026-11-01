import Link from 'next/link'
import { BuyerPage } from '@/components/buyer/Page'
import AccountControls from '@/components/account/AccountControls'
import { buyerSession } from '@/lib/buyer/server'
import type { AccountControlsState } from '@/lib/account/types'
import '@/components/account/account.css'

export default async function AccountControlsPage(){
  const {supabase}=await buyerSession('/settings/account')
  const {data,error}=await supabase.rpc('cm_account_status')
  return <BuyerPage title="Privacy and account controls" description="Manage your personal data, close your store or request account closure." actions={<Link className="buyer-btn" href="/settings">Back to settings</Link>}>
    {error||!data?<section className="buyer-panel"><h2>Account controls are unavailable</h2><p className="buyer-help">Your account has not been changed. Try again shortly or contact support to make a privacy or closure request.</p><Link href="/contact" className="buyer-btn">Contact support</Link></section>:<AccountControls state={data as AccountControlsState}/>}
  </BuyerPage>
}
