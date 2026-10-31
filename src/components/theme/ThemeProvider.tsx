'use client'
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
type Theme='light'|'dark'|'system'
const ThemeContext=createContext<{theme:Theme;resolvedTheme:'light'|'dark';setTheme:(theme:Theme)=>void}>({theme:'system',resolvedTheme:'light',setTheme:()=>{}})
const subscribe=(notify:()=>void)=>{window.addEventListener('storage',notify);window.addEventListener('campusmart:theme',notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener('campusmart:theme',notify)}}
function getTheme():Theme {try {const value=localStorage.getItem('campusmart-theme');return value==='light'||value==='dark'?value:'system'}catch{return 'system'}}
const subscribeSystem=(notify:()=>void)=>{const query=window.matchMedia('(prefers-color-scheme: dark)');query.addEventListener('change',notify);return()=>query.removeEventListener('change',notify)}
export function ThemeProvider({children}:{children:ReactNode}) {
  const theme=useSyncExternalStore(subscribe,getTheme,()=> 'system' as Theme)
  const systemDark=useSyncExternalStore(subscribeSystem,()=>window.matchMedia('(prefers-color-scheme: dark)').matches,()=>false)
  const resolvedTheme=theme==='dark'||(theme==='system'&&systemDark)?'dark':'light'
  useEffect(()=>{const root=document.documentElement;root.classList.toggle('dark',resolvedTheme==='dark');root.classList.toggle('light',resolvedTheme==='light');root.dataset.theme=resolvedTheme},[resolvedTheme])
  function setTheme(value:Theme){try{localStorage.setItem('campusmart-theme',value);window.dispatchEvent(new Event('campusmart:theme'))}catch{console.error('Theme preference could not be stored')}}
  return <ThemeContext.Provider value={{theme,resolvedTheme,setTheme}}>{children}</ThemeContext.Provider>
}
export const useTheme=()=>useContext(ThemeContext)
