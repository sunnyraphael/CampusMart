'use client'
import Link from 'next/link'
import {useCallback,useState} from 'react'
import {Activity} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {useVisibleRefresh} from '@/hooks/useVisibleRefresh'
export default function OperationsIndicator(){
  const [alerts,setAlerts]=useState(0)
  const refresh=useCallback(async()=>{const r=await createClient().rpc('cm_admin_operations');if(r.error)throw new Error('Health unavailable');setAlerts(r.data?.alerts?.length??0)},[])
  useVisibleRefresh(refresh,60000)
  return <Link className="buyer-btn" href="/admin/operations" aria-label={`System health${alerts?`: ${alerts} alerts`:''}`} title="System health" style={{padding:'8px',color:alerts?'#b45309':undefined}}><Activity size={18} aria-hidden/>{alerts>0&&<strong>{alerts}</strong>}</Link>
}
