import Link from 'next/link'
import { Camera, Truck, Wallet, ShieldCheck, ArrowRight, MessageCircle, Package } from 'lucide-react'
import { vendorSession } from '@/lib/vendor/server'
import { PageHeading } from '@/components/vendor/Workspace'

const guides = [
  { title: 'Make a listing worth opening', icon: Camera, href: '/vendor/listings/new', action: 'Create a listing', tips: ['Use a clear cover photo in daylight. Show flaws as well as the good details.', 'Write a specific title and an honest description. Set the correct condition.', 'Use a sale price only when it is a real discount. Set an end date when the offer expires.'] },
  { title: 'Stay on top of your stock', icon: Package, href: '/vendor/listings?stock=low', action: 'Check your stock', tips: ['Review low-stock and out-of-stock listings before accepting new orders.', 'Save unfinished listings as drafts until you are ready to publish.', 'For pre-orders, set a realistic delivery time so buyers know what to expect.'] },
  { title: 'Move orders forward', icon: Truck, href: '/vendor/orders', action: 'Manage orders', tips: ['Orders appear after payment is recorded as paid. Confirm an order when you can fulfil it.', 'Mark an item shipped when it is on the way, and delivered only after it reaches the buyer.', 'Use a packing slip to check what belongs in each order. Keep your delivery details accurate.'] },
  { title: 'Understand your earnings', icon: Wallet, href: '/vendor/earnings', action: 'View earnings', tips: ['CampusMart deducts a 5% commission from item sales. Your earnings show your share.', 'Delivered items wait for buyer confirmation or the release time shown on the order.', 'Disputed items stay on hold during review. A wallet balance is separate from a bank transfer; this workspace does not initiate withdrawals.'] },
  { title: 'Give buyers confidence', icon: ShieldCheck, href: '/vendor/verify', action: 'Review verification', tips: ['Complete your store description, contact details, and campus location.', 'Upload a clear selfie and school ID through the verification page. Documents are submitted for review.', 'Keep your payout account details accurate. Never ask a buyer for their password, card PIN, or OTP.'] },
  { title: 'Keep the conversation going', icon: MessageCircle, href: '/vendor/messages', action: 'Open messages', tips: ['Reply to questions about size, condition, availability, and delivery before a buyer orders.', 'Your CampusMart inbox and messages here use the same conversations.', 'If a problem comes up, keep a clear record in chat and use support for help with a dispute.'] },
]

export default async function VendorGuidePage() {
  await vendorSession('/vendor/guide')
  return <div className="vx-page"><PageHeading eyebrow="A little guidance" title="Good habits. Better business." description="Practical ways to make your store easier to find, trust, and buy from." /><div className="vx-guide-grid">{guides.map(({ title, icon: Icon, href, action, tips }) => <section key={title} className="vx-guide-section"><Icon size={25} strokeWidth={1.6} /><h2>{title}</h2><ul>{tips.map(tip => <li key={tip}>{tip}</li>)}</ul><Link href={href} className="vx-text-link">{action}<ArrowRight size={15} /></Link></section>)}</div><section className="vx-guide-callout"><div><h2>Need a hand with your store?</h2><p>Send a support request and track the reply from your account.</p></div><Link href="/contact" className="vx-btn vx-btn-secondary">Contact support<ArrowRight size={15} /></Link></section></div>
}
