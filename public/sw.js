/* Cache only the public offline screen. Never store account pages, API data or requests to Supabase. */
const OFFLINE_CACHE = 'campusmart-offline-v2'
const OFFLINE_FILES = ['/offline.html', '/status.css', '/offline.js']
self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.addAll(OFFLINE_FILES.map(path => new Request(path, { cache: 'reload' })))).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('campusmart-offline-') && key !== OFFLINE_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(OFFLINE_CACHE)).match('/offline.html')))
  } else if (OFFLINE_FILES.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(async () => (await caches.open(OFFLINE_CACHE)).match(url.pathname)))
  }
})
