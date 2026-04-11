const CACHE_NAME = 'encuesta-v4.2';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icon-512.svg',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Activar de inmediato
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cachear recursos críticos primero (sin fallar si alguno externo falla)
            return cache.addAll(['/index.html', '/style.css', '/app.js', '/manifest.json', '/icon-512.svg'])
                .catch(() => console.log('SW: Algunos recursos no se pudieron cachear'));
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // No interceptar las llamadas a la API
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                // Cachear respuestas válidas de recursos estáticos
                if (response.ok && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached); // Si no hay red, usar lo que hay en cache
        })
    );
});
