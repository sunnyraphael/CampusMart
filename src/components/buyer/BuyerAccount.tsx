'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Account = { isAdmin: boolean; user: User | null; vendorState: 'loading' | 'none' | 'buyer' | 'onboarding' | 'active'; favorites: string[]; notifications: number; messages: number; refresh: () => void; favoriteChanged: (id: string, saved: boolean) => void }
const Context = createContext<Account>({ isAdmin:false,user:null,vendorState:'loading',favorites:[],notifications:0,messages:0,refresh:()=>{},favoriteChanged:()=>{} })

export function BuyerAccount({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [account, setAccount] = useState<Omit<Account,'refresh'|'favoriteChanged'>>({ isAdmin:false,user:null,vendorState:'loading',favorites:[],notifications:0,messages:0 })
  const refresh = useCallback(() => window.dispatchEvent(new Event('campusmart:account')), [])
  const favoriteChanged = useCallback((id: string, saved: boolean) => setAccount((a) => ({...a,favorites:saved ? [...new Set([...a.favorites,id])] : a.favorites.filter((p)=>p!==id)})), [])
  useEffect(() => {
    let cancelled=false
    let generation=0
    async function load() {
      const version=++generation
      const {data:{user}}=await supabase.auth.getUser()
      if (cancelled || version!==generation) return
      if (!user) { setAccount({isAdmin:false,user:null,vendorState:'none',favorites:[],notifications:0,messages:0}); return }
      const summary=await supabase.rpc('cm_account_summary')
      if(summary.error||!summary.data)throw new Error('Account summary unavailable')
      if(cancelled||version!==generation)return
      const v=summary.data
      setAccount({isAdmin:v.is_admin===true,user:{...user,user_metadata:{...user.user_metadata,full_name:v.full_name??user.user_metadata?.full_name}},vendorState:v.role==='vendor'?(v.seller_id?'active':'onboarding'):'buyer',favorites:v.favorites??[],notifications:Number(v.notifications??0),messages:Number(v.messages??0)})
    }
    const run=()=> { if (!document.hidden) void load().catch((e)=>console.error('Account refresh failed',e)) }
    run()
    const timer=setInterval(run,60000)
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=> { queueMicrotask(run) })
    window.addEventListener('campusmart:account',run)
    window.addEventListener('focus',run)
    return ()=> {cancelled=true; clearInterval(timer); subscription.unsubscribe();window.removeEventListener('campusmart:account',run);window.removeEventListener('focus',run)}
  },[supabase])
  return <Context.Provider value={{...account,refresh,favoriteChanged}}>{children}</Context.Provider>
}

export const useBuyerAccount=()=>useContext(Context)
