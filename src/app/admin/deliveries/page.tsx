import { createClient } from '@/lib/supabase/server'
import { DataError } from '@/components/buyer/Page'
import DeliveriesClient, { type DeliveryApproval } from './DeliveriesClient'

export default async function DeliveryApprovalsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams
  const view = params.view === 'held' || params.view === 'approved' ? params.view : 'pending'
  const page = Math.min(10000, Math.max(1, parseInt(params.page ?? '1', 10) || 1))
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cm_admin_delivery_queue', { p_view: view, p_page: page })
  if (error) return <DataError message="Delivery approvals could not load. Please retry. If this continues, check the delivery service configuration." />
  const rows = (data ?? []) as DeliveryApproval[]
  return <DeliveriesClient items={rows.slice(0, 20)} hasMore={rows.length > 20} page={page} view={view} />
}
