import { adminSession } from '@/lib/admin/server'
import AdminWorkspace from './AdminWorkspace'
import './admin.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin workspace | CampusMart' , robots:{index:false,follow:false}}
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await adminSession()
  const name = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : 'Administrator'
  return <AdminWorkspace name={name}>{children}</AdminWorkspace>
}
