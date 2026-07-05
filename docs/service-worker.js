const CACHE_NAME = "ducati-alps-roadbook-v16";
const OFFLINE_URL = "./index.html";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.css?v=16",
  "./app.js",
  "./app.js?v=16",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-180.png?v=16",
  "./icons/icon-192.png",
  "./icons/icon-192.png?v=16",
  "./icons/icon-512.png",
  "./icons/icon-512.png?v=16",
  "./data/README_GPX_v3_iPhone.txt",
  "./data/road_book_links_v3.csv",
  "./gpx/day_01_20_Jul_The_Hague_Kautenbach_Luxembourg_Ardennes.gpx",
  "./gpx/day_02_21_Jul_Kautenbach_Lac_des_Settons_Morvan.gpx",
  "./gpx/day_03_22_Jul_Lac_des_Settons_Morvan_loop.gpx",
  "./gpx/day_04_23_Jul_Lac_des_Settons_Le_Bost_63640_Biollet.gpx",
  "./gpx/day_05_24_30_Jul_Le_Bost_Optional_Auvergne_loops.gpx",
  "./gpx/day_06_31_Jul_Le_Bost_Beaufort_Ar_ches.gpx",
  "./gpx/day_07_1_Aug_Beaufort_Roselend_Col_du_Pr_loop.gpx",
  "./gpx/day_08_2_Aug_Beaufort_Les_Saisies_Hauteluce_Ar_ches_loop.gpx",
  "./gpx/day_09_3_Aug_Beaufort_Rest_groceries_sunset_ride.gpx",
  "./gpx/day_10_4_Aug_Beaufort_Bourg_Saint_Maurice_Les_Chapieux.gpx",
  "./gpx/day_11_5_Aug_Bourg_Saint_Maurice_Little_St_Bernard_Italy_loop.gpx",
  "./gpx/day_12_6_Aug_Bourg_Saint_Maurice_Iseran_Bonneval_out_and_back.gpx",
  "./gpx/day_13_7_Aug_Bourg_Saint_Maurice_Geneva.gpx",
  "./gpx/day_14_8_Aug_Geneva_Optional_Sal_ve_Jura_shakeout.gpx",
  "./gpx/day_15_9_Aug_Geneva_Meiringen_Innertkirchen.gpx",
  "./gpx/day_16_10_Aug_Meiringen_Grimsel_Furka_Susten_loop.gpx",
  "./gpx/day_17_11_Aug_Meiringen_Zurich.gpx",
  "./gpx/day_18_12_Aug_Zurich_Vosges_Munster_or_Longemer.gpx",
  "./gpx/day_19_13_Aug_Vosges_Munster_Belgian_Ardennes_Spa_or_Luxembourg.gpx",
  "./gpx/day_20_14_Aug_Belgian_Ardennes_Spa_The_Hague.gpx",
  "./gpx/full_trip_routepoints_v3.gpx"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => (
        key === CACHE_NAME ? null : caches.delete(key)
      ))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
          return caches.match(OFFLINE_URL);
        });
    })
  );
});
