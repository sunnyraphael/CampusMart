import { vendorSession } from '@/lib/vendor/server'
import { paymentConfig,paymentService,paystackBanks } from '@/lib/paystack/config'
import { PageHeading } from '@/components/vendor/Workspace'
import PayoutAccount from './PayoutAccount'
export default async function PayoutAccountPage(){
  const {seller}=await vendorSession('/vendor/payout-account')
  let loaded:{banks:{code:string;name:string}[];mode:string;saved:{account_name:string;bank_name:string;last_four:string}|null}|null=null
  try{
    const config=paymentConfig()
    const [banks,recipient]=await Promise.all([paystackBanks(),paymentService().from('paystack_recipients').select('account_name,bank_name,last_four,mode').eq('seller_id',seller.id).eq('mode',config.mode).maybeSingle()])
    if(recipient.error)throw new Error('Payout setup unavailable')
    loaded={banks,mode:config.mode,saved:recipient.data??null}
  }catch{/* Render the retry explanation outside the data-fetching boundary. */}
  if(!loaded)return <section><PageHeading title="Your payout account" description="Paystack payout setup is currently unavailable."/><p className="buyer-notice">Check payment configuration and migrations, or try again later. No bank details have been changed.</p></section>
  return <section className="buyer-stack"><PageHeading title="Your payout account" description="Resolve a bank account with Paystack before receiving approved earnings."/><PayoutAccount banks={loaded.banks} mode={loaded.mode} saved={loaded.saved}/></section>
}
