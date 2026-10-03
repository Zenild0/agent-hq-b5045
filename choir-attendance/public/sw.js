// Minimal service worker so browsers offer "Install app". It caches nothing:
// every request goes straight to the server, so children's data is never stored by it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
