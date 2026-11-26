// Caches the game so it opens instantly and works offline after the first visit.
const CACHE = 'bookit-v166';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './sounds/cheer.mp3', './sounds/applause.mp3'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});
// Network first for the page (so updates arrive), cache fallback when offline.
// A page load (including a back swipe) always gets the game back, never an empty answer, because an
// empty answer is what makes Safari show "Safari couldn't open the page".
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url), mine = url.origin === self.location.origin, nav = e.request.mode === 'navigate';
  if (!mine && !nav) return; // fonts and other sites go straight to the network
  e.respondWith(fetch(e.request).then(r => {
    // only keep good, unredirected responses from this site (Safari refuses a redirected one from the cache)
    if (mine && r.status === 200 && r.type === 'basic' && !r.redirected) { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(e.request, c)); }
    return r;
  }).catch(async () => {
    const hit = await caches.match(e.request, { ignoreSearch: nav });
    if (hit || !nav || !mine) return hit || Response.error();
    return (await caches.match('./index.html')) || (await caches.match('./')) || new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#14111c;color:#eee;font:16px system-ui;padding:24px">BookIt needs a connection to open. <a style="color:#f5c542" href="./">Try again</a></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
