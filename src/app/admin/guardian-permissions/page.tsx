import { adminSession } from '@/lib/admin/server'
import { AdminHeading } from '@/components/admin/Workspace'
import AdminRefresh from '@/components/admin/RefreshButton'
import GuardianReviews from './GuardianReviews'

export type GuardianReview={id:string;relationship:string;state:string;allows_selling:boolean;created_at:string;guardian_email:string;guardian_name:string|null}
export default async function GuardianQueue(){const {supabase}=await adminSession();const {data,error}=await supabase.rpc('cm_admin_guardian_queue');return <section><AdminHeading title="Guardian permissions" description="Review the adult's identity, authority and informed permission before an under-18 student can register." actions={<AdminRefresh/>}/><p className="buyer-notice">A confirmed email and a checkbox do not prove guardianship. Arrange a proportionate verification through support, record your method and decision, and avoid storing document numbers or images in review notes.</p>{error?<p className="buyer-notice is-error" role="alert">Guardian permission requests could not load. Try Refresh.</p>:<GuardianReviews items={(data??[]) as GuardianReview[]}/>}</section>}
