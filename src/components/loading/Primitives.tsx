import type { CSSProperties, ReactNode } from 'react'
import { skeletonCopy } from './copy'

export function Block({ width = '100%', height = 16, className = '', style }: { width?: string | number; height?: number; className?: string; style?: CSSProperties }) {
  return <span className={`sk-block ${className}`} style={{ width, height, ...style }} />
}
export function Lines({ count = 3 }: { count?: number }) {
  return <div className="sk-lines">{Array.from({ length: count }, (_, i) => <Block key={i} width={i === count - 1 ? '68%' : '100%'} height={12} />)}</div>
}
export function Field({ tall = false, hint }: { tall?: boolean; hint?: string }) {
  return <div className="sk-field"><Block width="34%" height={21} /><Block height={tall ? 120 : 44} className="sk-input" />{hint && <span className="buyer-help"><span className="sk-ink">{hint}</span></span>}</div>
}
export function Button({ width = 112 }: { width?: number | string }) { return <Block width={width} height={40} className="sk-button" /> }
export function Frame({ variant, className = 'buyer-page', children }: { variant: string; className?: string; children: ReactNode }) {
  return <div data-page-skeleton={variant} role="status" aria-busy="true" aria-label={`Loading ${variant.replaceAll('-', ' ')}`}><div className={className} aria-hidden="true">{children}</div><span className="sr-only">Loading {variant.replaceAll('-', ' ')}…</span></div>
}
export function Heading({ vendor = false, actions = true, eyebrow = false, copy }: { vendor?: boolean; actions?: boolean; eyebrow?: boolean; copy?: keyof typeof skeletonCopy }) {
  const text = copy ? skeletonCopy[copy] : null
  return <header className={vendor ? 'vx-page-heading' : 'buyer-heading'}><div className="sk-heading-copy">{eyebrow && <Block width={160} height={10} style={{ marginBottom: 12 }} />}<h1>{text ? <span className="sk-ink">{text[0]}</span> : <Block width="min(290px,80vw)" style={{ height: vendor ? 'clamp(31.2px,2.73vw,39px)' : 'clamp(28.8px,4.8vw,38.4px)' }} />}</h1><p>{text ? <span className="sk-ink">{text[1]}</span> : <Block width="min(410px,80vw)" height={vendor ? 19 : 22} />}</p></div>{actions && <div className={vendor ? 'vx-actions' : 'buyer-actions'}><Button /></div>}</header>
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`buyer-panel buyer-stack ${className}`}>{children}</section> }
export function Rows({ count = 3, image = false, height = 76 }: { count?: number; image?: boolean; height?: number }) {
  return <div className="sk-rows">{Array.from({ length: count }, (_, i) => <div className="sk-row" key={i} style={{ minHeight: height }}>{image && <Block width={44} height={44} className="sk-square" />}<div className="sk-row-copy"><Block width="68%" height={14} /><Block width="45%" height={11} /></div><Block width={64} height={20} /></div>)}</div>
}
export function ProductCards({ count = 8, home = false, favorite = false }: { count?: number; home?: boolean; favorite?: boolean }) {
  return <div className={home ? 'hm-grid' : 'pl-grid'}>{Array.from({ length: count }, (_, i) => <div key={i} className={favorite ? 'buyer-card-wrap' : undefined}><article className="pc sk-product"><div className="pc-photo sk-surface" /><div className="pc-body">{!home && <Block width="40%" height={12} />}<Block width="95%" height={17} /><Block width="62%" height={12} /><Block width="58%" height={17} /><Block width="80%" height={13} /><Block width="70%" height={12} /></div><div className="pc-foot"><Block className="pc-price" width="52%" height={21} /><span className="pc-add sk-surface" /></div></article>{favorite && <Button width="100%" />}</div>)}</div>
}
