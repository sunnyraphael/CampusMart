import { createClient } from '@/lib/supabase/server'
import VerificationsClient from './VerificationsClient'

export const dynamic = 'force-dynamic'

type QueueRow = {
  seller_id: string
  store_name: string
  owner_name: string | null
  owner_email: string | null
  phone: string | null
  submitted_at: string | null
  selfie_path: string | null
  id_path: string | null
}

export default async function VerificationsPage() {
  const supabase = await createClient()

  // The database function re-checks that the caller is an admin
  const { data, error } = await supabase.rpc('admin_kyc_queue')
  const rows = (data ?? []) as QueueRow[]

  // The files are private, so we create temporary links that expire after 10 minutes
  const paths = rows.flatMap((r) => [r.selfie_path, r.id_path]).filter((p): p is string => !!p)
  const urls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('kyc-documents').createSignedUrls(paths, 600)
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
    })
  }

  const items = rows.map((r) => ({
    sellerId: r.seller_id,
    storeName: r.store_name,
    ownerName: r.owner_name,
    ownerEmail: r.owner_email,
    phone: r.phone,
    submittedAt: r.submitted_at,
    selfieUrl: r.selfie_path ? urls[r.selfie_path] ?? null : null,
    idUrl: r.id_path ? urls[r.id_path] ?? null : null,
  }))

  return <VerificationsClient items={items} loadError={error?.message ?? null} />
}