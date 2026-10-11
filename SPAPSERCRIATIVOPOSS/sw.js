const CACHE_NAME = 'spap-pdv-v192';
const FICHEIROS = [
  '/',
  '/index.html',
  '/login.html',
  '/registo.html',
  '/monitor.html',
  '/planos.html',
  '/supabase-config.js',
  '/sw.js',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
];

// Instala e guarda ficheiros em cache (tolerante a falhas)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(FICHEIROS.map(f =>
        cache.add(f).catch(err => console.log('SW: falhou cachear', f))
      ))
    )
  );
  self.skipWaiting();
});

// Activa e limpa caches antigas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Intercepta pedidos
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase API — tenta rede, guarda vendas offline se falhar
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', message: 'Sem ligação' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // CDN (supabase-js) — cache first
  if (url.hostname.includes('jsdelivr') || url.hostname.includes('cdn')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return r;
      }))
    );
    return;
  }

  // version.json — NUNCA fazer cache, sempre buscar fresco
  if (url.pathname.includes('version.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => new Response('{}')));
    return;
  }

  // HTML (navegações) — REDE primeiro (mostra sempre a versão mais recente quando
  // há internet); cai para a cache só quando está offline. Isto garante que as
  // atualizações chegam logo ao ecrã, em vez de ficar preso numa versão antiga.
  const ehHTML = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/';
  if (ehHTML) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(e.request).then(cached =>
          cached || caches.match('/index.html') || caches.match('/login.html')
        )
      )
    );
    return;
  }

  // Restantes ficheiros (locais e CDN) — cache first, rede como fallback.
  // As chamadas ao Supabase (API) NÃO são cacheadas (são dados ao vivo).
  const ehAPI = url.hostname.includes('supabase.co') || url.pathname.includes('/rest/') || url.pathname.includes('/auth/');
  if (ehAPI) { return; } // deixa passar direto à rede

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Vendas guardadas offline — sincroniza quando voltar internet
self.addEventListener('sync', e => {
  if (e.tag === 'sync-vendas') {
    e.waitUntil(sincronizarVendasOffline());
  }
});

async function sincronizarVendasOffline() {
  // Notifica clientes que estão online novamente
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ tipo: 'online', mensagem: 'A sincronizar vendas...' }));
}

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
