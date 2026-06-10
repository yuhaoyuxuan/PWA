const CONFIG_URL = './pwa.config.json';
const CACHE_PREFIX = 'pwa';

let pwaConfig = null;

function cacheKey(suffix) {
  const version = (pwaConfig && pwaConfig.cache && pwaConfig.cache.version) || '1.0.0';
  return `${CACHE_PREFIX}-v${version}-${suffix}`;
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function fetchConfig() {
  try {
    const res = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (res.ok) pwaConfig = await res.json();
  } catch (e) {
    // Use built-in defaults if config unavailable
  }
}

// Install: fetch config then precache
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await fetchConfig();
    if (pwaConfig && pwaConfig.cache && pwaConfig.cache.precache) {
      const staticCache = await caches.open(cacheKey('static'));
      const toCache = pwaConfig.cache.precache.filter(url => {
        try { new URL(url, self.location.origin); return true; } catch { return false; }
      });
      await staticCache.addAll(toCache).catch(e => {
        console.warn('SW precache partial failure:', e);
      });
    }
  })());
  // Do not skip waiting unconditionally — let the page control activation timing
});

// Handle skip waiting message from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await fetchConfig();
    const validPrefix = pwaConfig
      ? `${CACHE_PREFIX}-v${pwaConfig.cache.version || '1.0.0'}`
      : `${CACHE_PREFIX}-v1.0.0`;
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith(CACHE_PREFIX) && !name.startsWith(validPrefix))
        .map(name => caches.delete(name))
    );
    await clients.claim();
  })());
});

// Fetch: strategy-based handling
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (!isSameOrigin(url)) return;
  if (event.request.method !== 'GET') return;

  // Config: always network-first
  const configPathname = new URL(CONFIG_URL, self.location.href).pathname;
  if (url.pathname === configPathname) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // SW script: always network
  if (url.pathname === self.location.pathname) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (!pwaConfig || !pwaConfig.cache) {
    return cacheFirst(request);
  }

  const url = new URL(request.url);
  const runtimeCache = pwaConfig.cache.runtimeCache || [];

  for (const rule of runtimeCache) {
    if (url.pathname.includes(rule.urlPattern) || url.href.includes(rule.urlPattern)) {
      switch (rule.strategy) {
        case 'network-first': return networkFirst(request, rule.maxAge);
        case 'cache-first': return cacheFirst(request, rule.maxEntries, rule.maxAge);
        case 'stale-while-revalidate': return staleWhileRevalidate(request, rule.maxAge);
        default: return cacheFirst(request);
      }
    }
  }

  // Precache match or cache-first fallback
  return cacheFirst(request);
}

async function cacheFirst(request, maxEntries, maxAge) {
  const cache = await caches.open(cacheKey('runtime'));
  const cached = await cache.match(request);
  if (cached && !isExpired(cached, maxAge)) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (maxEntries) trimCache(cache, maxEntries);
    }
    return response;
  } catch (e) {
    return cached || offlineFallback(request);
  }
}

async function networkFirst(request, maxAge) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheKey('runtime'));
      await cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

async function staleWhileRevalidate(request, maxAge) {
  const cache = await caches.open(cacheKey('runtime'));
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

function isExpired(response, maxAge) {
  if (!maxAge) return false;
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
  return age > maxAge;
}

function trimCache(cache, maxEntries) {
  cache.keys().then(keys => {
    if (keys.length > maxEntries) {
      cache.delete(keys[0]).then(() => trimCache(cache, maxEntries));
    }
  });
}

function offlineFallback(request) {
  if (request.destination === 'document' && pwaConfig && pwaConfig.cache && pwaConfig.cache.offlineFallback) {
    return caches.match(pwaConfig.cache.offlineFallback);
  }
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}
