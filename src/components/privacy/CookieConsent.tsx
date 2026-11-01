'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Cookie, LockKeyhole, X } from 'lucide-react'
import { COOKIE_CHOICE_EVENT, COOKIE_CHOICE_KEY, COOKIE_PREFERENCES_EVENT, makeCookieChoice, parseCookieChoice } from '@/lib/privacy/cookies'
import styles from './CookieConsent.module.css'

let tabChoice: string | null | undefined
const serverSnapshot = () => null
const subscribeHydrated = () => () => {}
function snapshot() {
  if(tabChoice!==undefined)return tabChoice
  try { return window.localStorage.getItem(COOKIE_CHOICE_KEY) } catch { return null }
}
function subscribe(listener:()=>void) {
  window.addEventListener('storage',listener)
  window.addEventListener(COOKIE_CHOICE_EVENT,listener)
  window.addEventListener('focus',listener)
  return ()=>{window.removeEventListener('storage',listener);window.removeEventListener(COOKIE_CHOICE_EVENT,listener);window.removeEventListener('focus',listener)}
}

export default function CookieConsent() {
  const raw=useSyncExternalStore(subscribe,snapshot,serverSnapshot)
  const hydrated=useSyncExternalStore(subscribeHydrated,()=>true,()=>false)
  const choice=parseCookieChoice(raw)
  const [preferences,setPreferences]=useState(false)
  const [dismissed,setDismissed]=useState(false)
  const [notice,setNotice]=useState('')
  const title=useRef<HTMLHeadingElement>(null)
  const opener=useRef<HTMLElement|null>(null)
  useEffect(()=>{
    const open=()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setPreferences(true);setNotice('')}
    window.addEventListener(COOKIE_PREFERENCES_EVENT,open)
    return ()=>window.removeEventListener(COOKIE_PREFERENCES_EVENT,open)
  },[])
  useEffect(()=>{if(preferences)title.current?.focus()},[preferences])
  function close() {setPreferences(false);setDismissed(true);opener.current?.focus()}
  function save() {
    const value=makeCookieChoice(new Date())
    let stored=true
    try {window.localStorage.setItem(COOKIE_CHOICE_KEY,value);tabChoice=undefined} catch {stored=false;tabChoice=value}
    window.dispatchEvent(new Event(COOKIE_CHOICE_EVENT))
    setPreferences(false);setDismissed(false)
    setNotice(stored?'':'Your choice applies to this tab. Your browser did not allow it to be saved.')
    opener.current?.focus()
  }
  function reset() {
    try {window.localStorage.removeItem(COOKIE_CHOICE_KEY);tabChoice=undefined} catch {tabChoice=null}
    window.dispatchEvent(new Event(COOKIE_CHOICE_EVENT))
    setPreferences(false);setDismissed(false);setNotice('')
    opener.current?.focus()
  }
  if(!hydrated)return null
  if(!preferences&&(choice||dismissed))return notice?<aside className={styles.saved} role="status">{notice}<button type="button" aria-label="Dismiss storage notice" onClick={()=>setNotice('')}><X size={15} aria-hidden/></button></aside>:null
  return <aside className={styles.panel} role={preferences?'dialog':'region'} aria-modal={preferences?false:undefined} aria-labelledby="cookie-choice-title" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close()}}}>
    <button type="button" className={styles.close} aria-label={preferences?'Close cookie preferences':'Dismiss cookie notice'} onClick={close}><X size={17} aria-hidden/></button>
    <div className={styles.heading}><span className={styles.symbol}><Cookie size={20} aria-hidden/></span><h2 id="cookie-choice-title" ref={title} tabIndex={-1}>{preferences?'Cookie preferences':'Your privacy choices'}</h2></div>
    <p>Essential storage keeps sign-in, your cart and chosen appearance working. We don&apos;t currently use advertising or analytics cookies. <Link href="/cookies">Cookie policy</Link></p>
    {preferences&&<div className={styles.details}><div><LockKeyhole size={17} aria-hidden/><strong>Essential functions</strong><span>Active</span></div><p>Used for the services you request. There are no optional tracking categories to switch on. Resetting your saved choice shows this notice again without clearing your cart or signing you out.</p>{choice&&<p>Choice saved {new Date(choice.savedAt).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})} on this device.</p>}</div>}
    <div className={styles.actions}><button type="button" onClick={save}>{preferences?'Save preferences':'Essential only'}</button>{preferences?choice&&<button type="button" onClick={reset}>Reset saved choice</button>:<button type="button" onClick={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setPreferences(true)}}>Preferences</button>}</div>
  </aside>
}
