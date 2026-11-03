import {adminSession} from '@/lib/admin/server'
import {AdminHeading} from '@/components/admin/Workspace'
import OperationsClient from './OperationsClient'
export default async function OperationsPage(){
  const {supabase}=await adminSession(),r=await supabase.rpc('cm_admin_operations')
  // eslint-disable-next-line react-hooks/purity -- Snapshot this authenticated server request once.
  const now=Date.now()
  return <section className="buyer-stack"><AdminHeading eyebrow="Reliability" title="System health" description="Capacity, operational alerts and safe photo maintenance. No private keys are displayed."/>{r.error||!r.data?<p role="alert" className="buyer-notice">System health is unavailable. Apply the reliability migration, then refresh.</p>:<OperationsClient now={now} data={r.data}/>}</section>
}
