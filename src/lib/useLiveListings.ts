'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ListingFields } from '@/lib/listing-display'

export type LiveListing = ListingFields & { id:string; status:string }
type Result={key:string;live:Record<string,LiveListing>;error:string|null}

export function useLiveListings(ids:string[]) {
  const key=[...new Set(ids)].sort().join(',')
  const [attempt,setAttempt]=useState(0)
  const [result,setResult]=useState<Result>({key:'',live:{},error:null})
  const requestKey=`${key}:${attempt}`
  useEffect(()=>{
    if(!key)return
    let cancelled=false
    async function load() {
      try {
        const {data,error}=await createClient().from('products').select('id,price,stock_quantity,status,compare_at_price,sale_ends_at,condition,availability,delivery_days').in('id',key.split(','))
        if(cancelled)return
        setResult({key:requestKey,live:Object.fromEntries(((data??[]) as LiveListing[]).map((r)=>[r.id,r])),error:error?'Prices and availability could not be refreshed.':null})
      } catch {if(!cancelled)setResult({key:requestKey,live:{},error:'Prices and availability could not be refreshed.'})}
    }
    void load()
    return()=>{cancelled=true}
  },[key,requestKey])
  const retry=useCallback(()=>setAttempt((n)=>n+1),[])
  useEffect(()=>{const onFocus=()=>retry();window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[retry])
  return {live:key&&result.key===requestKey?result.live:{},loading:!!key&&result.key!==requestKey,error:key&&result.key===requestKey?result.error:null,retry}
}
