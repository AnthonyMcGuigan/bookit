// Caches the game so it opens instantly and works offline after the first visit.
const CACHE = 'bookit-v71';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './sounds/cheer.mp3', './sounds/applause.mp3'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});
// Network first for the page (so updates arrive), cache fallback when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // only keep good responses from this site (fonts and anything else just pass through)
  const mine = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(fetch(e.request).then(r => { if (mine && r.status === 200 && r.type === 'basic') { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});
