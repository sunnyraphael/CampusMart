/* This file is used only by the public, cached offline document. */
try {
  const preference = localStorage.getItem('campusmart-theme')
  document.documentElement.classList.toggle('dark', preference === 'dark' || ((!preference || preference === 'system') && matchMedia('(prefers-color-scheme: dark)').matches))
} catch { /* The screen still works when browser storage is unavailable. */ }
const retry = document.getElementById('offline-retry'), notice = document.getElementById('offline-notice')
async function reconnect() {
  if (retry.disabled) return
  retry.disabled = true; retry.textContent = 'Checking connection…'
  try {
    const response = await fetch('/api/connectivity', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error('Unavailable')
    location.reload()
  } catch {
    notice.textContent = navigator.onLine ? 'We still can’t reach CampusMart. Please try again in a moment.' : 'Still offline. Check your connection and try again.'
    retry.disabled = false; retry.textContent = 'Try again'
  }
}
retry.addEventListener('click', reconnect)
window.addEventListener('online', reconnect)
