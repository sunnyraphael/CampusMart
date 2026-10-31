import { CheckCircle2, Clock, ExternalLink, ShieldCheck } from 'lucide-react'
import { creditLabel, deliverySteps, safeTrackingUrl, trackingDate, type OrderTracking } from '@/lib/orders/tracking'

export default function TrackingTimeline({ tracking: t, pickup = false }: { tracking: OrderTracking; pickup?: boolean }) {
  const current = deliverySteps.findIndex(s => s.status === t.status)
  const link = safeTrackingUrl(t.tracking_url)
  return <section className="ot-tracking" aria-label="Delivery tracking">
    <ol className="ot-steps" aria-label="Delivery stages">{deliverySteps.map((step, index) => <li key={step.status} className={current >= index ? 'is-done' : ''} aria-current={index === current ? 'step' : undefined}>
      <span className="ot-step-dot" aria-hidden>{current >= index ? <CheckCircle2 size={16} /> : <Clock size={16} />}</span>
      <span>{pickup && step.status === 'shipped' ? 'Ready for pickup' : step.label}</span>
    </li>)}</ol>
    <div className="ot-facts">
      {t.expected_by && <p><strong>Estimated {pickup ? 'pickup' : 'delivery'}:</strong> {trackingDate(t.expected_by)}</p>}
      {t.courier && <p><strong>Courier:</strong> {t.courier}</p>}
      {t.tracking_number && <p><strong>Tracking number:</strong> {t.tracking_number}</p>}
      {link && <a href={link} target="_blank" rel="noopener noreferrer">Track with courier <ExternalLink size={13} aria-hidden /></a>}
      {t.delivery_note && <p className="ot-note">{t.delivery_note}</p>}
    </div>
    <p className="ot-credit" role="status"><ShieldCheck size={16} aria-hidden />{creditLabel(t, t.status)}</p>
    {t.code_verified_at && <p className="buyer-help">Delivery code verified · {trackingDate(t.code_verified_at)}</p>}
    <details className="ot-history"><summary>Tracking history</summary><ol>
      {t.created_at && <li><span>Order placed</span><time dateTime={t.created_at}>{trackingDate(t.created_at)}</time></li>}
      {t.events.map(event => <li key={event.id}><span>{event.note || event.status.replaceAll('_', ' ')}</span><time dateTime={event.created_at}>{trackingDate(event.created_at)}</time></li>)}
      {!t.events.length && <li>Earlier tracking updates were not recorded for this order.</li>}
    </ol></details>
  </section>
}
