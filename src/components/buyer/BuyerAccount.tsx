'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Account = { user: User | null; vendorState: 'loading' | 'none' | 'buyer' | 'onboarding' | 'active'; favorites: string[]; notifications: number; messages: number; refresh: () => void; favoriteChanged: (id: string, saved: boolean) => void }
const Context = createContext<Account>({ user:null,vendorState:'loading',favorites:[],notifications:0,messages:0,refresh:()=>{},favoriteChanged:()=>{} })

export function BuyerAccount({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [account, setAccount] = useState<Omit<Account,'refresh'|'favoriteChanged'>>({ user:null,vendorState:'loading',favorites:[],notifications:0,messages:0 })
  const refresh = useCallback(() => window.dispatchEvent(new Event('campusmart:account')), [])
  const favoriteChanged = useCallback((id: string, saved: boolean) => setAccount((a) => ({...a,favorites:saved ? [...new Set([...a.favorites,id])] : a.favorites.filter((p)=>p!==id)})), [])
  useEffect(() => {
    let cancelled=false
    let generation=0
    async function load() {
      const version=++generation
      const {data:{user}}=await supabase.auth.getUser()
      if (cancelled || version!==generation) return
      if (!user) { setAccount({user:null,vendorState:'none',favorites:[],notifications:0,messages:0}); return }
      const [profile,seller,wishlist,notifications,chats] = await Promise.all([
        supabase.from('users').select('role,full_name').eq('id',user.id).maybeSingle(),
        supabase.from('sellers').select('id').eq('user_id',user.id).maybeSingle(),
        supabase.from('wishlist').select('product_id').eq('user_id',user.id),
        supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('is_read',false),
        supabase.rpc('cm_conversations'),
      ])
      if (cancelled || version!==generation) return
      setAccount({user: {...user, user_metadata:{...user.user_metadata,full_name:profile.data?.full_name ?? user.user_metadata?.full_name}},vendorState:profile.data?.role==='vendor' ? seller.data ? 'active' : 'onboarding' : 'buyer',favorites:(wishlist.data??[]).map((w)=>w.product_id),notifications:notifications.count??0,messages:(chats.data??[]).reduce((n:number,c:{unread_count:number})=>n+Number(c.unread_count),0)})
    }
    const run=()=> { if (!document.hidden) void load().catch((e)=>console.error('Account refresh failed',e)) }
    run()
    const timer=setInterval(run,30000)
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=> { queueMicrotask(run) })
    window.addEventListener('campusmart:account',run)
    window.addEventListener('focus',run)
    return ()=> {cancelled=true; clearInterval(timer); subscription.unsubscribe();window.removeEventListener('campusmart:account',run);window.removeEventListener('focus',run)}
  },[supabase])
  return <Context.Provider value={{...account,refresh,favoriteChanged}}>{children}</Context.Provider>
}

export const useBuyerAccount=()=>useContext(Context)
