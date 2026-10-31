import { adminSession } from '@/lib/admin/server'
import { DataError } from '@/components/buyer/Page'
import DeliveriesClient, { type DeliveryApproval } from './DeliveriesClient'

export default async function DeliveryApprovalsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams
  const view = params.view === 'held' || params.view === 'approved' ? params.view : 'pending'
  const page = Math.min(10000, Math.max(1, parseInt(params.page ?? '1', 10) || 1))
  const {supabase} = await adminSession()
  const { data, error } = await supabase.rpc('cm_admin_delivery_queue', { p_view: view, p_page: page })
  if (error) return <DataError message="Delivery approvals could not load. Please retry. If this continues, check the delivery service configuration." />
  const rows = (data ?? []) as DeliveryApproval[]
  // This dynamic server response supplies one timestamp for consistent follow-up labels during hydration.
  // eslint-disable-next-line react-hooks/purity
  const loadedAt = Date.now()
  return <DeliveriesClient key={`${view}:${page}`} loadedAt={loadedAt} items={rows.slice(0, 20)} hasMore={rows.length > 20} page={page} view={view} />
}
