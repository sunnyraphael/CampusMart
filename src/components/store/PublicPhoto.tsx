'use client'
import Image from 'next/image'
import {useState} from 'react'
import {Package} from 'lucide-react'
import {publicThumbnail} from '@/lib/media/paths'
export default function PublicPhoto({src,alt,priority=false}:{src:string;alt:string;priority?:boolean}){
  const [fallback,setFallback]=useState(false),[failed,setFailed]=useState(false)
  const thumb=publicThumbnail(src)
  if(failed)return <Package size={32} strokeWidth={1.5} aria-label="Photo unavailable"/>
  let optimize=false
  try{const image=new URL(src),origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'');optimize=!fallback&&thumb===src&&origin.protocol==='https:'&&image.origin===origin.origin&&image.pathname.startsWith('/storage/v1/object/public/product-images/')&&!image.search&&!image.username&&!image.password}catch{/* Preserve legacy external images without proxying arbitrary hosts. */}
  function recover(){if(!fallback&&(thumb!==src||optimize))setFallback(true);else setFailed(true)}
  if(optimize)return <Image src={src} alt={alt} width={480} height={480} sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 280px" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined} referrerPolicy="no-referrer" onError={recover}/>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fallback?src:thumb} alt={alt} loading={priority?"eager":"lazy"} fetchPriority={priority?"high":undefined} decoding="async" referrerPolicy="no-referrer" onError={recover}/>
}
