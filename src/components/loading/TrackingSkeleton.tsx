import { deliverySteps } from '@/lib/orders/tracking'
import { Block } from './Primitives'

export default function TrackingSkeleton() {
  return <div className="ot-tracking"><ol className="ot-steps">{deliverySteps.map(step => <li key={step.status}>
    <span className="ot-step-dot"><Block width={16} height={16} /></span><span className="sk-ink">{step.label}</span>
  </li>)}</ol><p className="ot-credit"><Block width={16} height={16} /><span className="sk-ink">Vendor credit held until delivery is verified and approved</span></p><div className="ot-history"><Block width={130} height={19} style={{ margin: '8px 0' }} /></div></div>
}
