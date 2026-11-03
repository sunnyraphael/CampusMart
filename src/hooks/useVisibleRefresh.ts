'use client'
import {useEffect} from 'react'
// One in-flight refresh, only while visible/online; failures back off to one minute.
export function useVisibleRefresh(task:()=>Promise<void>|void,interval=30000){
  useEffect(()=>{
    let stopped=false,running=false,timer:ReturnType<typeof setTimeout>|undefined,failures=0,last=0
    const schedule=()=>{clearTimeout(timer);if(!stopped&&!document.hidden&&navigator.onLine)timer=setTimeout(()=>void run(),Math.min(60000,interval*2**failures))}
    async function run(){
      if(stopped||running||document.hidden||!navigator.onLine)return
      if(Date.now()-last<1500){schedule();return}
      running=true;last=Date.now()
      try{await task();failures=0}catch{failures=Math.min(3,failures+1)}finally{running=false;schedule()}
    }
    const wake=()=>{clearTimeout(timer);if(!document.hidden&&navigator.onLine)void run()}
    void run();window.addEventListener('focus',wake);window.addEventListener('online',wake);window.addEventListener('offline',wake);document.addEventListener('visibilitychange',wake)
    return()=>{stopped=true;clearTimeout(timer);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);window.removeEventListener('offline',wake);document.removeEventListener('visibilitychange',wake)}
  },[task,interval])
}
