import Link from 'next/link'
import { BuyerPage } from './Page'
import { siteConfig } from '@/config/site'

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
  privacy: {
    title:'Data & privacy', description:'How the features in CampusMart use your information.',
    sections:[
      {title:'Account and order information',body:'CampusMart uses your sign-in email, profile name and optional phone number to manage your account. Orders can include contact details, delivery information, purchased items and payment references. Never send card details, PINs or passwords in a message.'},
      {title:'Private account features',body:'Favorites, saved searches, notifications and support requests are associated with your account. Chat messages are available to the buyer and the vendor participating in the conversation. Support requests and submitted reports can be reviewed by authorized administrators.'},
      {title:'Information stored on your device',body:'The cart and appearance preference are stored in your browser. Authentication also uses session cookies. Signing out ends your session on this device; it does not automatically erase the browser’s cart.'},
      {title:'Requests about your information',body:`Use Contact support while signed in, or email ${siteConfig.supportEmail} if you cannot access your account. Tell us whether you need a correction, a copy of your information, or help closing an account. Do not include identity documents in the initial message.`},
    ],
  },
  terms: {
    title:'Marketplace guidelines', description:'Practical expectations for using CampusMart.',
    sections:[
      {title:'Accurate listings and respectful conduct',body:'Use accurate account information and keep conversations respectful. Listings should describe the item honestly, including its condition, price and availability. Do not use CampusMart to offer prohibited items, impersonate others or send spam.'},
      {title:'Orders and payments',body:'Review the item details, delivery estimate and total before checkout. Keep payment and order discussions on the platform. An order record or payment screenshot alone is not proof that a payment has been verified.'},
      {title:'Delivery and disputes',body:'Only confirm receipt after receiving and checking your item. If a shipped or delivered item has a problem, report it from My orders and describe what happened. Use Contact support for other order issues; a support request does not itself cancel an order or promise a refund.'},
      {title:'Getting help',body:`For account, conduct or order concerns, contact support through the site or at ${siteConfig.supportEmail}. Include the order reference where relevant. Never share passwords or payment credentials.`},
    ],
  },
}

export default function InformationPage({kind}:{kind:keyof typeof information}) {
  const page=information[kind]
  return <BuyerPage title={page.title} description={page.description}><article className="buyer-panel buyer-article">{page.sections.map((s)=><section key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}<div className="buyer-actions"><Link href="/help" className="buyer-btn">Help center</Link><Link href="/contact" className="buyer-btn">Contact support</Link></div></article></BuyerPage>
}
