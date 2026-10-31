'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InboxRefresh() {
  const router=useRouter()
  useEffect(()=>{const tick=()=>{if(!document.hidden) router.refresh()};const timer=setInterval(tick,15000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick)}},[router])
  return null
}
