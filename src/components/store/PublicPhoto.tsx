'use client'
import {useState} from 'react'
import {Package} from 'lucide-react'
import {publicThumbnail} from '@/lib/media/paths'
export default function PublicPhoto({src,alt}:{src:string;alt:string}){
  const [fallback,setFallback]=useState(false),[failed,setFailed]=useState(false)
  const thumb=publicThumbnail(src)
  if(failed)return <Package size={32} strokeWidth={1.5} aria-label="Photo unavailable"/>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fallback?src:thumb} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>{if(!fallback&&thumb!==src)setFallback(true);else setFailed(true)}}/>
}
