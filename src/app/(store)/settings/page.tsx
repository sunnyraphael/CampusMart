import Link from 'next/link'
import { BuyerPage } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const {user}=await buyerSession('/settings')
  return <BuyerPage title="Account settings" description="Choose your appearance and manage account security.">
    <SettingsClient email={user.email??''}/>
    <div className="buyer-panel"><h2>Privacy and account help</h2><p>For a data correction, export, or account deletion request, contact support while signed in. Open orders and disputes need to be resolved before an account can be closed.</p><div className="buyer-actions"><Link className="buyer-btn" href="/contact">Contact support</Link><Link className="buyer-btn" href="/privacy">Data &amp; privacy</Link></div></div>
  </BuyerPage>
}
