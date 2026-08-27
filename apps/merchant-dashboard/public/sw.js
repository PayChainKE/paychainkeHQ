const CACHE_NAME = 'paychain-merchant-v5';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/logo.png',
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/apple-touch-icon.png'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // The Cache API's put()/match() only support GET — caching a mutating
  // request (login, OTP verify, any POST/PUT/PATCH/DELETE) is never
  // correct anyway. Previously this fell through to the stale-while-
  // revalidate branch below regardless of method: cache.put() then threw
  // "Request method 'POST' is unsupported" *inside* the .then() attached to
  // the real fetch() call, which rejected the promise event.respondWith was
  // waiting on — turning a successful login response into an apparent
  // network failure on the page (axios saw no response at all, so
  // MerchantAuthContext.jsx's catch block reported the generic "Login
  // failed"/"OTP Verification failed" even though the backend had already
  // succeeded and dispatched the OTP). Returning here with no
  // event.respondWith() call lets the browser handle non-GET requests as a
  // normal, uncontrolled fetch — exactly what every API call needs.
  if (event.request.method !== 'GET') {
    return;
  }

  // Allow network first, fallback to cache for navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html') || await caches.match('/');
        if (cached) return cached;
        // Fallback response if offline and no cache
        return new Response('You are offline and the app is not fully cached.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
    );
    return;
  }
  
  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      });

      if (cachedResponse) {
        // Prevent unhandled promise rejection if background fetch fails
        fetchPromise.catch(() => {});
        return cachedResponse;
      }
      
      return fetchPromise;
    })
  );
});
