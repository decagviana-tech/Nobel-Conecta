
const CACHE_NAME = 'nobel-conecta-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Suporte para Notificações Push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nobel Conecta';
  const options = {
    body: data.content || 'Você tem uma nova notificação!',
    icon: 'https://cdn-icons-png.flaticon.com/512/3308/3308395.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3308/3308395.png',
    data: {
      url: data.link || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
