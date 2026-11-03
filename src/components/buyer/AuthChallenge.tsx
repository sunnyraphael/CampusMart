'use client'
import Script from 'next/script'
import {useEffect,useRef,useState} from 'react'
type Turnstile={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void}
declare global{interface Window{turnstile?:Turnstile}}
export default function AuthChallenge({onToken}:{onToken:(token:string)=>void}){
  const container=useRef<HTMLDivElement>(null),widget=useRef<string|null>(null),[error,setError]=useState(false)
  useEffect(()=>()=>{if(widget.current)window.turnstile?.remove(widget.current)},[])
  function render(){
    if(!container.current||widget.current||!window.turnstile)return
    widget.current=window.turnstile.render(container.current,{sitekey:process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,theme:'auto',size:'flexible',appearance:'interaction-only',callback:(token:string)=>{setError(false);onToken(token)},'expired-callback':()=>onToken(''),'error-callback':()=>{onToken('');setError(true)}})
  }
  return <div><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={render} onError={()=>setError(true)}/><div ref={container}/>{error&&<p role="alert" className="buyer-help">The security check could not load. Check your connection or refresh this page. Your form stays here.</p>}</div>
}
