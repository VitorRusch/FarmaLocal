const CACHE = "farmalocal-offline-v1";
const PAGES = ["/", "/estoque", "/movimentacoes", "/importar", "/exportar", "/backup"];
async function cacheAsset(cache, path, seen = new Set()) {
  const url = new URL(path, self.location.origin).href;
  if (seen.has(url)) return;
  seen.add(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    await cache.put(url, response.clone());
    if (new URL(url).pathname.endsWith(".js")) {
      const source = await response.text();
      const dependencies = [
        ...source.matchAll(/["']((?:\.\/|\/assets\/)[^"']+\.(?:js|css))["']/g),
      ].map((match) => new URL(match[1], url).href);
      await Promise.all(dependencies.map((dependency) => cacheAsset(cache, dependency, seen)));
    }
  } catch {}
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of PAGES) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response.clone());
            const html = await response.text();
            const paths = [...html.matchAll(/(?:src|href)="([^"\s]+)"/g)]
              .map((m) => m[1])
              .filter((url) => url.startsWith("/assets/"));
            await Promise.all(
              paths.map(async (path) => {
                try {
                  await cacheAsset(cache, path);
                } catch {}
              }),
            );
          }
        } catch {}
      }
      await self.skipWaiting();
    }),
  );
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_URLS")
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        Promise.all(
          event.data.urls.map(async (url) => {
            try {
              await cache.add(url);
            } catch {}
          }),
        ),
      ),
    );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request, { ignoreVary: true })) ??
          (event.request.mode === "navigate" ? await caches.match("/") : undefined) ??
          Response.error(),
      ),
  );
});
