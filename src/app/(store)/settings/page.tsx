import { BuyerPage } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import SettingsClient from './SettingsClient'
import '@/components/account/account.css'

export default async function SettingsPage() {
  const {user}=await buyerSession('/settings')
  return <BuyerPage title="Account settings" description="Make CampusMart yours. Manage appearance, security and privacy from one place.">
    <SettingsClient email={user.email??''}/>
  </BuyerPage>
}
