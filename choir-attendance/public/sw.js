// Offline support for the PARENT pages only. Always tries the network first, so updates show at once;
// the saved copy is used only when the network fails. The teacher area, the API and the hymn audio are
// never touched here (the parent page keeps its own small copy of the data it last loaded).
const CACHE = 'choir-app-v12';
const PRECACHE = ['/', '/style.css', '/common.js', '/parent.js', '/home.js', '/theme.js', '/nav.js', '/synth.js', '/staff.js', '/staffgame.js', '/games.js', '/singpath.js', '/xp.js', '/game.js', '/player.js', '/warmup.js', '/audio.js', '/levels.js', '/pitch.js', '/badges.js', '/logo.png', '/manifest.webmanifest', '/icon-192.png'];
const WAIT_MS = 4000; // on a very slow connection, fall back to the saved copy after this long

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const skip = (url) => url.origin !== location.origin
  || url.pathname.startsWith('/api/') || url.pathname.startsWith('/teacher') || url.pathname.startsWith('/hymns/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (skip(url)) return;
  const key = req.mode === 'navigate' ? '/' : req; // /?c=CODE and / share one saved page
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(key);
    const live = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone()).catch(() => {});
      return res;
    });
    try {
      if (!saved) return await live;
      return await Promise.race([live, new Promise((_, no) => setTimeout(no, WAIT_MS))]);
    } catch {
      return saved || Response.error();
    }
  })());
});
