import Link from 'next/link'
import { BuyerPage } from '@/components/buyer/Page'
import { helpTopics } from '@/lib/buyer/help'
import HelpSearch from './HelpSearch'

export default function HelpPage() {
  return <BuyerPage title="How can we help?" description="Straightforward answers for buying, delivery, accounts and order issues." actions={<Link className="buyer-btn is-primary" href="/contact">Contact support</Link>}>
    <div className="buyer-links"><Link className="buyer-link" href="/orders">Track an order</Link><Link className="buyer-link" href="/messages">Message a vendor</Link><Link className="buyer-link" href="/forgot-password">Recover your account</Link></div>
    <HelpSearch topics={helpTopics}/>
    <p className="buyer-help">Never share your password, PIN, card details or recovery codes with anyone claiming to be a vendor or support agent.</p>
  </BuyerPage>
}
