'use client'
import { useState } from 'react'
import { cleanupListingImages } from '@/lib/vendor/actions'

export default function CleanupButton() {
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  async function retry() {
    setBusy(true);setNotice('')
    try {const result=await cleanupListingImages();setNotice(result.pending?'Some unused photos could not be removed yet. Please try again later.':'Unused photo cleanup is up to date.')}
    catch {setNotice('Photo cleanup could not finish. Please try again later.')}
    finally {setBusy(false)}
  }
  return <div className="buyer-actions"><button className="vx-btn vx-btn-secondary" disabled={busy} onClick={retry}>{busy?'Cleaning photos…':'Clean up unused photos'}</button>{notice&&<p className="buyer-help" role="status">{notice}</p>}</div>
}
