'use client'

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import StatusView from './StatusView'

function subscribe(listener: () => void) { window.addEventListener('online', listener); window.addEventListener('offline', listener); return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener) } }
const snapshot = () => !navigator.onLine
const serverSnapshot = () => false

export default function ConnectionGuard({ children }: { children: ReactNode }) {
  const offline = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => { /* The open-page offline screen remains available if registration is blocked. */ })
  }, [])
  useEffect(() => {
    if (!offline) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [offline])
  async function check() {
    setChecking(true); setNotice('')
    try {
      const response = await fetch('/api/connectivity', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(4000) })
      setNotice(response.ok ? 'CampusMart is reachable. Your page will return when your browser reconnects.' : 'CampusMart is temporarily unavailable. Please try again shortly.')
    } catch { setNotice('Still offline. Check your Wi-Fi or mobile data, then try again.') }
    finally { setChecking(false) }
  }
  return <><div hidden={offline} inert={offline || undefined} data-connection-content>{children}</div>{offline && <main className="cm-connection-overlay" aria-label="Connection status"><StatusView kind="offline" actions={<button className="cm-status-btn" autoFocus disabled={checking} onClick={check}><RefreshCw size={16} aria-hidden="true" />{checking ? 'Checking connection…' : 'Check connection'}</button>} note={notice || 'This tab keeps your open page and typed form fields in place. We won’t automatically resubmit any action.'} /></main>}</>
}
