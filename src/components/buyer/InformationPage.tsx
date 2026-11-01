import Link from 'next/link'
import { BuyerPage } from './Page'
import PolicyPage, { type PolicyKind } from '@/components/privacy/PolicyPage'

const information = {
  'how-it-works': {
    title: 'Buying on CampusMart', description: 'From finding a listing to confirming delivery.',
    sections: [
      {title:'1. Find your item',body:'Browse categories, use the search bar, or explore current deals. Check condition, stock, delivery time and vendor details. Use Favorites to save a listing and Saved searches to revisit a search.'},
      {title:'2. Ask the vendor',body:'Message a vendor from a listing or their storefront. Agree on any details you need before placing an order. Keep the conversation on CampusMart so there is a record.'},
      {title:'3. Review checkout',body:'Your cart and checkout refresh listing prices and stock. Review your delivery method, contact number, item total and fees. A service fee of 2% applies below a NGN 20,000 item subtotal; it is waived at or above that amount. Delivery does not count toward that threshold.'},
      {title:'4. Follow the order',body:'My orders shows payment and item fulfillment separately. Only treat a payment as complete when it is verified. When an item arrives, inspect it before confirming receipt. Report a problem from the order if a shipped or delivered item needs review.'},
    ],
  },

}

export default function InformationPage({kind}:{kind:keyof typeof information|PolicyKind}) {
  if(kind!=='how-it-works')return <PolicyPage kind={kind}/>
  const page=information[kind]
  return <BuyerPage title={page.title} description={page.description}><article className="buyer-panel buyer-article">{page.sections.map((s)=><section key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}<div className="buyer-actions"><Link href="/help" className="buyer-btn">Help center</Link><Link href="/contact" className="buyer-btn">Contact support</Link></div></article></BuyerPage>
}
