'use client'
import {useSyncExternalStore} from 'react'
export const FEE_NOTICE_KEY='campusmart-fee-notice-dismissed-v1'
const eventName='campusmart:interface-preference'
const memory=new Set<string>()
export function preferenceSaved(key:string){
  if(memory.has(key))return true
  try{return localStorage.getItem(key)==='1'}catch{return false}
}
export function savePreference(key:string){
  memory.add(key)
  try{localStorage.setItem(key,'1')}catch{/* Retain the choice for this tab when storage is blocked. */}
  window.dispatchEvent(new Event(eventName))
}
function subscribe(listener:()=>void){window.addEventListener(eventName,listener);window.addEventListener('storage',listener);return ()=>{window.removeEventListener(eventName,listener);window.removeEventListener('storage',listener)}}
export function useFeeNoticeDismissed(){return useSyncExternalStore(subscribe,()=>preferenceSaved(FEE_NOTICE_KEY),()=>true)}
