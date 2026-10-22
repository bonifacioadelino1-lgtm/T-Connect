// T-Connect Child — Service Worker (v2.39.6): cache versionado + rede primeiro para código.
const CACHE = 'tc-child-v2.39.62';
const SCOPE = self.registration.scope;
const abs = p => new URL(p, SCOPE).href;
const SHELL = ['index.html','css/style.css','js/app.js','js/fruitgame.js','manifest.webmanifest','../guardian/js/supabase.js','../guardian/js/supabase-config.js','../vendor/html5-qrcode/html5-qrcode.min.js','../assets/icons/minha-emergencia-192.png','../assets/icons/minha-emergencia-512.png'].map(abs);
const FALLBACK = abs('index.html');
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))));
  await self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('tc-child-') && k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
function put(req, res) { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {}); } }
function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const hit = () => caches.match(req, { ignoreSearch: true });
    const t = setTimeout(async () => { const c = await hit(); if (c && !done) { done = true; resolve(c); } }, 4000);
    fetch(req).then(r => { put(req, r); if (!done) { done = true; clearTimeout(t); resolve(r); } })
      .catch(async () => { clearTimeout(t); if (done) return; const c = await hit(); done = true; resolve(c || (req.mode === 'navigate' ? await caches.match(FALLBACK) : null) || Response.error()); });
  });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (/\.(?:png|jpe?g|webp|svg|ico|woff2?)$/i.test(u.pathname)) {
    e.respondWith(caches.match(req).then(c => c || fetch(req).then(r => { put(req, r); return r; }).catch(() => Response.error())));
    return;
  }
  e.respondWith(networkFirst(req));
});
