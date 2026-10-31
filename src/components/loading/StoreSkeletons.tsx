import { Block, Button, Field, Frame, Heading, Lines, Panel, ProductCards, Rows } from './Primitives'
import { SORT_OPTIONS } from '@/lib/products-query'

export function HomeSkeleton() {
  return <Frame variant="homepage" className="hm"><section className="hm-hero has-mosaic"><div><Block width="min(520px, 90%)" height={98} /><div style={{ margin: '18px 0 24px', maxWidth: 410 }}><Lines count={2} /></div><div className="hm-btns"><Button width={145} /><Button width={155} /></div></div><div className="hm-mosaic">{[0, 1, 2, 3].map(i => <span className="hm-tile sk-surface" key={i} />)}</div></section><section><div className="hm-head"><Block width={190} height={23} /><Block width={70} height={14} /></div><ProductCards home count={6} /></section><section><div className="hm-head"><Block width={180} height={23} /></div><div className="hm-steps">{[0, 1, 2].map(i => <div className="hm-step" key={i}><Block width={24} height={14} /><Block width="70%" height={19} style={{ margin: '14px 0' }} /><Lines /></div>)}</div></section><section className="hm-band"><div style={{ width: '70%' }}><Block width="65%" height={22} /><Lines count={2} /></div><Button width={150} /></section></Frame>
}
export function CatalogSkeleton({ kind = 'catalog' }: { kind?: 'catalog' | 'deals' | 'favorites' }) {
  return <Frame variant={kind} className={kind === 'catalog' ? 'pl' : 'buyer-page'}>{kind === 'catalog' ? <header className="pl-head"><div className="pl-head-text"><Block width={210} style={{ height: 'clamp(25.3px,4.6vw,32.2px)', marginBottom: 4 }} /><Block width={150} height={21} /></div><div className="buyer-actions"><span className="buyer-btn"><Block width={16} height={16} /><span className="sk-ink">Save search</span></span><div className="pl-sort"><span className="sk-ink">Sort by</span><select className="sk-native-select" tabIndex={-1} disabled aria-hidden="true">{SORT_OPTIONS.map(option => <option key={option.key}>{option.label}</option>)}</select></div></div></header> : <Heading copy={kind} actions={false} />}{kind === 'catalog' && <div className="pl-chips">{[65, 135, 110, 100, 125].map((width, i) => <Block key={i} width={width} height={40} className="sk-chip" />)}</div>}<ProductCards count={8} favorite={kind === 'favorites'} /></Frame>
}
export function CategoriesSkeleton() {
  return <Frame variant="categories" className="cat-page"><header className="cat-head"><div><Block width={240} height={32} /><Block width="min(360px, 80vw)" height={15} style={{ marginTop: 10 }} /></div><Button /></header><div className="cat-grid">{Array.from({ length: 8 }, (_, i) => <div className="cat-tile" key={i}><span className="cat-tile-top"><span className="cat-icon"><Block width={20} height={20} /></span><Block width={16} height={16} className="cat-arrow" /></span><span className="cat-copy"><Block width="80%" height={20} /><Block width="95%" height={12} className="cat-description" style={{ marginTop: 8 }} /></span></div>)}</div></Frame>
}
export function ProductSkeleton() {
  return <Frame variant="product-detail"><Heading /><div className="buyer-columns"><div className="sk-gallery"><div className="sk-gallery-main sk-surface" /><div className="sk-gallery-thumbs">{[0, 1, 2, 3].map(i => <Block key={i} width={68} height={68} className="sk-square" />)}</div></div><Panel><Block width="50%" height={38} /><div className="buyer-actions"><Block width={90} height={26} /><Block width={95} height={16} /></div><Block width="45%" height={23} /><Block width="75%" height={20} /><Button width="100%" /><div className="buyer-actions"><Button /><Button width={145} /></div><Block height={68} className="sk-input" /><Lines count={2} /></Panel></div><Panel><Block width={170} height={25} /><Lines /><Button width={160} /></Panel><Panel><Block width={180} height={25} /><Rows count={2} /></Panel></Frame>
}
export function StorefrontSkeleton() {
  return <Frame variant="storefront"><Heading /><Panel><div className="buyer-actions"><Block width={44} height={44} className="sk-square" /><Block width={125} height={25} /></div><Lines count={2} /></Panel><ProductCards /></Frame>
}
export function OrdersSkeleton({ detail = false }: { detail?: boolean }) {
  return <Frame variant={detail ? 'order-detail' : 'orders'}><Heading copy={detail ? "order-detail" : "orders"} actions={detail} />{Array.from({ length: detail ? 1 : 2 }, (_, i) => <Panel key={i}><div className="buyer-row"><div className="sk-lines"><Block width={185} height={25} /><Block width={145} height={12} /></div><Block width={100} height={24} /></div><div className="order-items">{[0, 1].map(n => <div className="order-item" key={n}><Block width={48} height={48} className="sk-square" /><div className="sk-lines"><Block width="60%" height={17} /><Block width="45%" height={14} /><Block width={110} height={24} /><div className="buyer-actions"><Button /><Button /></div></div></div>)}</div><footer className="buyer-row"><Block width="35%" height={14} /><Block width={110} height={22} />{!detail && <Button />}</footer></Panel>)}</Frame>
}
export function InboxSkeleton({ vendor = false }: { vendor?: boolean }) {
  return <Frame variant={vendor ? 'vendor-inbox' : 'inbox'} className={vendor ? 'vx-page' : 'buyer-page'}><Heading copy={vendor ? "vendor-inbox" : "inbox"} vendor={vendor} eyebrow={vendor} actions={false} />{vendor ? <div className="vx-conversations">{[0, 1, 2, 3].map(i => <div className="vx-conversation" key={i}><Block width={43} height={43} className="sk-square" /><div className="vx-conversation-main sk-lines"><Block width="38%" height={16} /><Block width="75%" height={12} /></div><Block width={40} height={12} /></div>)}</div> : <div className="buyer-stack">{[0, 1, 2, 3].map(i => <Panel key={i}><Rows count={1} image height={34} /></Panel>)}</div>}</Frame>
}
export function ThreadSkeleton({ vendor = false }: { vendor?: boolean }) {
  return <Frame variant={vendor ? 'vendor-conversation' : 'conversation'} className={vendor ? 'vx-page' : 'buyer-page'}>{vendor && <Block width={125} height={15} style={{ marginBottom: 24 }} />}<Heading vendor={vendor} eyebrow={vendor} /><Button width={115} /><Panel><div className="chat-history"><Block width="65%" height={72} className="sk-input" /><Block width="51%" height={62} className="sk-input" style={{ alignSelf: 'flex-end' }} /><Block width="60%" height={72} className="sk-input" /></div><div className="chat-composer"><Block height={70} className="sk-input" /><Block width={46} height={44} className="sk-square" /></div><Block width="80%" height={12} /></Panel></Frame>
}
export function ProfileSkeleton() {
  return <Frame variant="profile"><Heading copy="profile" actions={false} /><div className="buyer-links">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="buyer-link"><Block width={20} height={20} /><Block width="65%" height={15} /></div>)}</div><Panel><Block width={170} height={25} /><div className="buyer-form"><Field /><Field hint="Optional. Used to coordinate your orders." /><Field hint="Your sign-in email. Contact support if you need help changing it." /><Button width={130} /></div></Panel></Frame>
}
export function SettingsSkeleton() {
  return <Frame variant="account-settings"><Heading copy="settings" actions={false} /><Panel><Block width={150} height={25} /><Field /><Block width="70%" height={14} /></Panel><Panel><Block width={170} height={25} /><Field /><Field /><Field /><Button width={160} /></Panel><div><Button width={170} /></div><Panel><Block width={195} height={25} /><Lines count={3} /><div className="buyer-actions"><Button /><Button width={125} /></div></Panel></Frame>
}
export function NotificationsSkeleton() {
  return <Frame variant="notifications"><Heading copy="notifications" actions={false} /><div className="buyer-stack"><div className="buyer-row"><div className="sk-lines"><Block width={45} height={21} /><Block width={145} height={44} className="sk-input" /></div><Button width={140} /></div>{[0, 1, 2, 3].map(i => <Panel key={i}><Rows count={1} height={48} /></Panel>)}</div></Frame>
}
export function SavedSkeleton() {
  return <Frame variant="saved-searches"><Heading copy="saved" actions={false} /><div className="buyer-stack">{[0, 1, 2].map(i => <Panel key={i}><div className="buyer-row"><div className="sk-row-copy"><Block width={180} height={19} /><Block width={130} height={13} /></div><div className="buyer-actions"><Button /><Button width={80} /></div></div></Panel>)}</div></Frame>
}
export function ContactSkeleton() {
  return <Frame variant="contact-support"><Heading copy="contact" actions={false} /><div className="buyer-columns"><Panel><Block width={155} height={25} /><Field /><Field /><Field tall /><Button width={130} /></Panel><Panel><Block width={190} height={25} /><Lines count={4} /><Lines count={3} /><Button width={165} /></Panel></div><Block width={185} height={25} /><Panel><Rows count={1} /></Panel></Frame>
}
export function HelpSkeleton() {
  return <Frame variant="help-center"><Heading copy="help" /><div className="buyer-links">{[0, 1, 2].map(i => <div key={i} className="buyer-link"><Block height={18} width="80%" /></div>)}</div><Panel><Block height={44} className="sk-input" /><Rows count={5} height={55} /></Panel></Frame>
}
export function ArticleSkeleton({ enrollment = false }: { enrollment?: boolean }) {
  return <Frame variant={enrollment ? 'start-selling' : 'information-page'}><Heading actions={false} /><Panel className={enrollment ? '' : 'buyer-article'}>{Array.from({ length: enrollment ? 1 : 4 }, (_, i) => <div className="sk-lines" key={i}><Block width="55%" height={25} style={{ margin: '12px 0' }} /><Lines count={4} /></div>)}<div className="buyer-actions"><Button /><Button /></div></Panel></Frame>
}
export function CartSkeleton({ bodyOnly = false }: { bodyOnly?: boolean }) {
  const content = <div className="ct-layout"><div className="ct-list">{[0, 1].map(i => <div className="ct-item" key={i}><Block className="ct-img" style={{ height: 'auto', aspectRatio: '1' }} /><div className="ct-info sk-row-copy sk-lines"><Block width="75%" height={22} /><Block width="50%" height={14} /><Block width="70%" height={20} /><Block width={100} height={34} /></div></div>)}</div><aside className="ct-summary"><Block width={170} height={23} /><Rows count={3} height={42} /><div style={{ margin: '20px 0' }}><Block height={22} /></div><Button width="100%" /><Button width="100%" /><Lines count={2} /></aside></div>
  if (bodyOnly) return <div data-page-skeleton="cart-items" role="status" aria-label="Loading cart" aria-busy="true"><div aria-hidden="true">{content}</div></div>
  return <Frame variant="cart" className="ct-page"><div className="ct-wrap"><div className="ct-head"><Block width={34} height={34} /><Block width={160} height={32} /></div>{content}</div></Frame>
}
export function CheckoutSkeleton() {
  return <Frame variant="checkout"><Heading copy="checkout" /><Block height={49} className="sk-input" /><div className="buyer-columns"><Panel><Block width={170} height={25} /><Field /><Field /><Field tall /></Panel><Panel><Block width={170} height={25} /><Block width="75%" height={20} /><Lines count={3} /><Rows count={4} height={36} /><Button width="100%" /><Lines count={2} /></Panel></div></Frame>
}
export function AuthSkeleton({ mode = 'login' }: { mode?: 'login' | 'register' | 'forgot' | 'reset' }) {
  const fields = mode === 'register' ? 4 : mode === 'forgot' ? 1 : 2
  return <Frame variant={`auth-${mode}`} className="buyer-auth buyer-panel buyer-stack"><Block width={28} height={28} /><Block width="75%" height={34} /><Lines count={2} /><div className="buyer-form">{Array.from({ length: fields }, (_, i) => <Field key={i} />)}<Button width="100%" /></div>{(mode === 'login' || mode === 'register') && <Button width="100%" />}<div className="buyer-actions"><Block width="40%" height={17} /><Block width="38%" height={17} /></div></Frame>
}
