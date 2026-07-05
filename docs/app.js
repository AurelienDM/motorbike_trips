(function () {
  "use strict";

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const cards = Array.from(document.querySelectorAll(".card[id^='day']"));
  const THEME_KEY = "roadbookThemeMode";
  const DAY_KEY = "roadbookActiveDay";
  const TILE_SIZE = 256;
  const SWIPE_MIN_DISTANCE = 70;
  const SWIPE_MAX_TIME = 900;
  const SIGHT_MATCHER = /★|view|sight|lac|lake|see|river|col\b|pass|gorge|valley|forest|glacier|waterfall|cascade|roselend|iseran|grimsel|furka|susten|jura|sal[eè]ve|morvan|ardenne|clervaux|beaufort|bourg|chapieux|bonneval|geneva|zurich|gruy[eè]res|sion|chamonix|colmar|munster|bastogne|spa|maastricht|titisee|schluchsee|settons|gileppe/i;
  const ROUTE_METRICS = [
    { km: 389, mins: 347, legs: [76, 59, 116, 39, 78, 20] },
    { km: 513, mins: 490, legs: [64, 106, 91, 82, 140, 31] },
    { km: 94, mins: 112, legs: [6, 23, 9, 29, 27] },
    { km: 274, mins: 260, legs: [87, 57, 83, 46] },
    { km: 137, mins: 170, legs: [18, 21, 10, 46, 41] },
    { km: 447, mins: 380, legs: [163, 98, 92, 22, 53, 19] },
    { km: 106, mins: 157, legs: [6, 4, 13, 1, 19, 8, 15, 41] },
    { km: 75, mins: 93, legs: [7, 9, 12, 4, 15, 28] },
    { km: 32, mins: 91, legs: [0, 14, 12, 6] },
    { km: 61, mins: 103, legs: [6, 14, 19, 8, 15, 0] },
    { km: 88, mins: 138, legs: [4, 19, 8, 0, 13, 14, 31] },
    { km: 125, mins: 158, legs: [12, 15, 5, 17, 13, 15, 48] },
    { km: 177, mins: 196, legs: [54, 10, 26, 8, 12, 21, 0, 46] },
    { km: 109, mins: 177, legs: [20, 50, 19, 21] },
    { km: 250, mins: 249, legs: [28, 100, 28, 37, 18, 24, 15] },
    { km: 121, mins: 132, legs: [26, 6, 10, 22, 10, 18, 28] },
    { km: 118, mins: 118, legs: [8, 6, 39, 31, 34] },
    { km: 336, mins: 335, legs: [84, 71, 32, 22, 97, 20, 10] },
    { km: 418, mins: 362, legs: [28, 123, 57, 62, 70, 78] },
    { km: 302, mins: 272, legs: [40, 34, 88, 60, 80] }
  ];

  function htmlEscape(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sectionNode(card, label) {
    const wanted = label.toLowerCase();
    return Array.from(card.querySelectorAll(".section-title"))
      .find((node) => clean(node.textContent).toLowerCase() === wanted)
      ?.nextElementSibling || null;
  }

  function sectionText(card, label) {
    return clean(sectionNode(card, label)?.textContent || "");
  }

  function cardStats(card) {
    return Array.from(card.querySelectorAll(".stat")).slice(0, 3).map((stat) => ({
      label: clean(stat.querySelector("span")?.textContent),
      value: clean(stat.querySelector("b")?.textContent)
    }));
  }

  function cardStops(card) {
    return Array.from(card.querySelectorAll(".stop")).map((stop) => {
      const name = clean(stop.querySelector("span:first-child")?.textContent || stop.textContent);
      const type = clean(stop.querySelector(".typ")?.textContent);
      return { name, type };
    });
  }

  function statValue(stats, label) {
    return stats.find((stat) => stat.label.toLowerCase() === label.toLowerCase())?.value || "";
  }

  function dayDate(day) {
    return clean(day.meta.split("·")[0] || day.meta);
  }

  function dayRegion(day) {
    return clean(day.meta.split("·").slice(1).join("·")) || "Route";
  }

  function parseKm(value) {
    const match = clean(value).match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function parseCoord(value) {
    const match = clean(value).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    return { lat: Number(match[1]), lon: Number(match[2]) };
  }

  function parseGoogleRoute(href) {
    if (!href) return [];
    try {
      const url = new URL(href);
      const points = [];
      const origin = parseCoord(url.searchParams.get("origin"));
      const destination = parseCoord(url.searchParams.get("destination"));
      if (origin) points.push(origin);
      clean(url.searchParams.get("waypoints")).split("|").forEach((waypoint) => {
        const point = parseCoord(waypoint);
        if (point) points.push(point);
      });
      if (destination) points.push(destination);
      return points;
    } catch (error) {
      return [];
    }
  }

  function openStreetMapRoute(coords) {
    if (!coords.length) return "https://www.openstreetmap.org/";
    const first = coords[0];
    const center = coordsCenter(coords);
    if (coords.length < 2) {
      return `https://www.openstreetmap.org/?mlat=${first.lat}&mlon=${first.lon}#map=12/${first.lat}/${first.lon}`;
    }
    const route = compactRouteCoords(coords).map((point) => (
      `${point.lat.toFixed(6)}%2C${point.lon.toFixed(6)}`
    )).join("%3B");
    return [
      "https://www.openstreetmap.org/directions",
      `?engine=fossgis_osrm_car&route=${route}`,
      `#map=${chooseMapZoom(coords)}/${center.lat}/${center.lon}`
    ].join("");
  }

  function compactRouteCoords(coords, limit = 25) {
    if (coords.length <= limit) return coords;
    const result = [coords[0]];
    const step = (coords.length - 2) / (limit - 2);
    for (let i = 1; i < limit - 1; i += 1) {
      result.push(coords[Math.round(i * step)]);
    }
    result.push(coords[coords.length - 1]);
    return result.filter((point, index) => {
      const previous = result[index - 1];
      return !previous || previous.lat !== point.lat || previous.lon !== point.lon;
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function coordsCenter(coords) {
    if (!coords.length) return { lat: 47.5, lon: 7.2 };
    const bounds = coords.reduce((box, point) => ({
      minLat: Math.min(box.minLat, point.lat),
      maxLat: Math.max(box.maxLat, point.lat),
      minLon: Math.min(box.minLon, point.lon),
      maxLon: Math.max(box.maxLon, point.lon)
    }), {
      minLat: coords[0].lat,
      maxLat: coords[0].lat,
      minLon: coords[0].lon,
      maxLon: coords[0].lon
    });
    return {
      lat: (bounds.minLat + bounds.maxLat) / 2,
      lon: (bounds.minLon + bounds.maxLon) / 2
    };
  }

  function chooseMapZoom(coords) {
    if (coords.length < 2) return 12;
    const lats = coords.map((point) => point.lat);
    const lons = coords.map((point) => point.lon);
    const span = Math.max(
      Math.max(...lats) - Math.min(...lats),
      Math.max(...lons) - Math.min(...lons)
    );
    if (span > 7) return 6;
    if (span > 3.5) return 7;
    if (span > 1.8) return 8;
    if (span > 0.9) return 9;
    if (span > 0.45) return 10;
    return 11;
  }

  function worldPixel(point, zoom) {
    const scale = TILE_SIZE * (2 ** zoom);
    const lat = clamp(point.lat, -85.0511, 85.0511);
    const sinLat = Math.sin(lat * Math.PI / 180);
    return {
      x: (point.lon + 180) / 360 * scale,
      y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
    };
  }

  function realMapMarkup(day, options = {}) {
    if (!day.coords.length) return "";
    const className = clean(`real-map ${options.className || ""}`);
    const loading = options.eager ? "eager" : "lazy";
    const zoom = chooseMapZoom(day.coords);
    const center = coordsCenter(day.coords);
    const centerPx = worldPixel(center, zoom);
    const centerTile = {
      x: Math.floor(centerPx.x / TILE_SIZE),
      y: Math.floor(centerPx.y / TILE_SIZE)
    };
    const tileOrigin = {
      x: (centerTile.x - 1) * TILE_SIZE,
      y: (centerTile.y - 1) * TILE_SIZE
    };
    const maxTile = (2 ** zoom) - 1;
    const routePoints = day.coords.map((point) => {
      const px = worldPixel(point, zoom);
      return `${(px.x - tileOrigin.x).toFixed(1)},${(px.y - tileOrigin.y).toFixed(1)}`;
    }).join(" ");
    const markers = day.coords.map((point, index) => {
      const px = worldPixel(point, zoom);
      const x = (px.x - tileOrigin.x).toFixed(1);
      const y = (px.y - tileOrigin.y).toFixed(1);
      const cls = index === 0 ? "start" : index === day.coords.length - 1 ? "end" : "waypoint";
      return `<circle class="map-marker ${cls}" cx="${x}" cy="${y}" r="${cls === "waypoint" ? 4.5 : 7}"/>`;
    }).join("");
    const tiles = [-1, 0, 1].map((dy) => [-1, 0, 1].map((dx) => {
      const x = (centerTile.x + dx + maxTile + 1) % (maxTile + 1);
      const y = clamp(centerTile.y + dy, 0, maxTile);
      return `<img data-map-tile alt="" loading="${loading}" decoding="async" referrerpolicy="no-referrer" src="https://tile.openstreetmap.org/${zoom}/${x}/${y}.png">`;
    }).join("")).join("");

    return [
      `<div class="${htmlEscape(className)}" aria-label="Live OpenStreetMap route preview">`,
      mapFallbackMarkup(),
      `<div class="tile-grid">${tiles}</div>`,
      `<svg class="route-overlay" viewBox="0 0 768 768" aria-hidden="true"><polyline points="${routePoints}"/>${markers}</svg>`,
      '<a class="map-open" target="_blank" rel="noopener" aria-label="Open this route in OpenStreetMap" href="' + htmlEscape(day.osm) + '">' + icon("map") + '<span>OSM</span></a>',
      '<a class="map-attribution" target="_blank" rel="noopener" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
      '</div>'
    ].join("");
  }

  function mapFallbackMarkup() {
    return [
      '<svg class="map-fallback" viewBox="0 0 768 768" aria-hidden="true">',
      '<rect width="768" height="768" fill="#e7efe9"/>',
      '<path d="M0 184 C118 132 220 203 344 145 C478 82 580 134 768 83 V768 H0Z" fill="#d4e7d8"/>',
      '<path d="M0 526 C112 476 205 541 322 492 C462 433 576 498 768 428 V768 H0Z" fill="#c3dccd"/>',
      '<path d="M55 690 C168 590 284 626 384 527 C502 411 625 440 760 315" fill="none" stroke="#9ebbb1" stroke-width="32" stroke-linecap="round" opacity="0.45"/>',
      '<path d="M88 164 H678 M50 295 H720 M38 427 H728 M95 560 H676 M190 82 V682 M347 43 V732 M516 75 V694" stroke="#ffffff" stroke-width="5" opacity="0.58"/>',
      '</svg>'
    ].join("");
  }

  function dayData(card, index) {
    const stops = cardStops(card);
    const stats = cardStats(card);
    const distance = statValue(stats, "Distance");
    const google = card.querySelector(".btn.blue[href^='https://www.google.com/maps']")?.getAttribute("href") || "";
    const coords = parseGoogleRoute(google);
    const gpx = card.querySelector("a[download][href$='.gpx']")?.getAttribute("href") || "";
    const routeMetric = ROUTE_METRICS[index] || null;
    return {
      index,
      id: card.id,
      label: `Day ${String(index + 1).padStart(2, "0")}`,
      shortLabel: String(index + 1).padStart(2, "0"),
      title: clean(card.querySelector("h2")?.textContent),
      meta: clean(card.querySelector(".card-header div[style*='font-weight']")?.textContent),
      stats,
      plannedDistance: distance,
      distance: routeMetric ? `${routeMetric.km} km` : distance,
      distanceKm: routeMetric?.km || parseKm(distance),
      routeDurationMins: routeMetric?.mins || 0,
      legsKm: routeMetric?.legs || [],
      rideTime: statValue(stats, "Riding time"),
      road: statValue(stats, "Road"),
      google,
      coords,
      osm: openStreetMapRoute(coords),
      camp: card.querySelector(".btn.green[href^='http']")?.getAttribute("href") || "",
      gpx,
      fuel: sectionText(card, "Fuel"),
      food: sectionText(card, "Eat / nature stop"),
      night: sectionText(card, "Night"),
      note: sectionText(card, "Road book note"),
      ridePlan: sectionText(card, "Ride plan"),
      stops,
      fuelStops: stops.filter((stop) => /fuel/i.test(`${stop.name} ${stop.type}`)),
      breakStops: stops.filter((stop) => /break|coffee|nature|picnic|lake|river/i.test(`${stop.name} ${stop.type}`)),
      campStops: stops.filter((stop) => /camp|night|home|friends/i.test(`${stop.name} ${stop.type}`)),
      sightStops: stops.filter(isSightStop)
    };
  }

  const days = cards.map(dayData);
  let currentDay = savedDay();
  let themeMode = window.localStorage.getItem(THEME_KEY) || "day";
  let todaySwipeInstalled = false;

  function savedDay() {
    const saved = Number(window.localStorage.getItem(DAY_KEY) || 0);
    return Number.isInteger(saved) && saved >= 0 && saved < days.length ? saved : 0;
  }

  function icon(name) {
    const paths = {
      bike: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><path d="M11 19h2l2.5-5.5"/><path d="m14 6 3 3h3"/><path d="M5 13h4l3-6h2"/><path d="M6 16l3-3"/><path d="M15 13h2l1 3"/>',
      calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>',
      camp: '<path d="m3 20 9-16 9 16Z"/><path d="m12 4 2.8 16"/><path d="M9.2 20 12 14l2.8 6"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
      fuel: '<path d="M6 22V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v18"/><path d="M5 22h13"/><path d="M8 6h5"/><path d="M17 8h1a3 3 0 0 1 3 3v4a2 2 0 0 1-4 0v-2"/>',
      coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8h2a4 4 0 0 1 0 8h-2"/><path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M6 20h10"/>',
      map: '<path d="M14.1 4 9 2 3 5v17l6-3 6 3 6-3V2Z"/><path d="M9 2v17"/><path d="M15 5v17"/>',
      moon: '<path d="M12 3a6 6 0 0 0 9 7.2A9 9 0 1 1 12 3Z"/>',
      more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
      route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7H6.5a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
      settings: '<path d="M9.7 3.4c.5-1.9 4.1-1.9 4.6 0a2.1 2.1 0 0 0 3.1 1.3c1.7-1 4.2 1.5 3.2 3.2a2.1 2.1 0 0 0 1.3 3.1c1.9.5 1.9 4.1 0 4.6a2.1 2.1 0 0 0-1.3 3.1c1 1.7-1.5 4.2-3.2 3.2a2.1 2.1 0 0 0-3.1 1.3c-.5 1.9-4.1 1.9-4.6 0a2.1 2.1 0 0 0-3.1-1.3c-1.7 1-4.2-1.5-3.2-3.2a2.1 2.1 0 0 0-1.3-3.1c-1.9-.5-1.9-4.1 0-4.6a2.1 2.1 0 0 0 1.3-3.1c-1-1.7 1.5-4.2 3.2-3.2a2.1 2.1 0 0 0 3.1-1.3Z"/><circle cx="12" cy="12" r="3"/>',
      sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
      shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
      target: '<path d="M20 10c0 4.9-8 12-8 12s-8-7.1-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
      awake: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      trip: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><path d="M11 19h2l2.5-5.5"/><path d="m14 6 3 3h3"/><path d="M5 13h4l3-6h2"/><path d="M6 16l3-3"/><path d="M15 13h2l1 3"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.trip}</svg>`;
  }

  function setTheme(mode) {
    themeMode = mode;
    window.localStorage.setItem(THEME_KEY, mode);
    const resolved = mode === "auto"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day")
      : mode;
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      resolved === "night" ? "#07100b" : "#f4f7f4"
    );
    updateThemeButtons();
  }

  function updateThemeButtons() {
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      const active = button.getAttribute("data-theme-choice") === themeMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setCurrentDay(index, options = {}) {
    if (!days.length) return;
    currentDay = Math.max(0, Math.min(days.length - 1, index));
    window.localStorage.setItem(DAY_KEY, String(currentDay));
    renderToday();
    renderItinerary();
    renderFuel();
    renderCalendar();
    updateDaySelects();
    if (options.scrollCard) {
      document.getElementById(days[currentDay].id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function updateDaySelects() {
    document.querySelectorAll("[data-day-select]").forEach((select) => {
      select.value = String(currentDay);
    });
  }

  function dayOptions() {
    return days.map((day, index) => (
      `<option value="${index}">${htmlEscape(day.shortLabel)} - ${htmlEscape(day.title)}</option>`
    )).join("");
  }

  function listMarkup(items, fallback) {
    if (!items.length) return `<p class="app-muted">${htmlEscape(fallback)}</p>`;
    return `<ul class="app-list">${items.slice(0, 5).map((item) => (
      `<li><strong>${htmlEscape(item.name)}</strong><span>${htmlEscape(item.type)}</span></li>`
    )).join("")}</ul>`;
  }

  function chipMarkup(day) {
    return [
      ["Distance", day.distance || "-"],
      ["Ride", day.rideTime || "-"],
      ["Road", day.road || "-"]
    ].map(([label, value]) => (
      `<div class="metric"><span>${htmlEscape(label)}</span><b>${htmlEscape(value)}</b></div>`
    )).join("");
  }

  function actionLink(className, href, label, iconName, extra = "") {
    return `<a class="${className}" href="${htmlEscape(href)}" target="_blank" rel="noopener" ${extra}>${icon(iconName)}<span>${htmlEscape(label)}</span></a>`;
  }

  function actionPanel(day, options = {}) {
    const main = [];
    const extras = [];
    const compact = options.compact === true;
    const includeCamping = options.includeCamping !== false;
    if (day.google) {
      main.push(actionLink("action primary", day.google, "Maps", "map"));
    }
    if (includeCamping && day.camp) {
      main.push(actionLink("action camp-action", day.camp, "Camp", "camp"));
    }
    if (options.includeFuel) {
      main.push(actionLink("action fuel-action", fuelMapsLink(), "Fuel", "fuel"));
    }
    if (day.osm) {
      extras.push(actionLink("action", day.osm, "OpenStreetMap", "map"));
    }
    if (day.gpx) {
      extras.push(actionLink("action", day.gpx, "OsmAnd", "trip"));
      extras.push(`<a class="action" href="${htmlEscape(day.gpx)}" download>${icon("file")}<span>GPX</span></a>`);
    }
    if (options.includeDayCard) {
      extras.push(`<button class="action" type="button" data-open-day>${icon("more")}<span>Day Card</span></button>`);
    }
    if (options.nextHref) {
      extras.push(`<a class="action" href="${htmlEscape(options.nextHref)}">${icon("trip")}<span>Next Day</span></a>`);
    }
    return [
      `<div class="action-stack${compact ? " compact" : ""}">`,
      `<div class="primary-actions">${main.join("")}</div>`,
      extras.length ? [
        '<details class="more-actions">',
        `<summary>${icon("more")}<span>Options</span></summary>`,
        `<div class="action-grid compact">${extras.join("")}</div>`,
        '</details>'
      ].join("") : "",
      '</div>'
    ].join("");
  }

  function fuelWindows(day) {
    if (!day.distanceKm) return "Use the 180-200 km rhythm.";
    const windows = Math.max(1, Math.ceil(day.distanceKm / 190));
    return `${windows} fuel window${windows > 1 ? "s" : ""} for ${day.distanceKm} km`;
  }

  function attachMapTileHandlers(scope) {
    scope.querySelectorAll("[data-map-tile]").forEach((tile) => {
      tile.addEventListener("error", () => {
        tile.classList.add("is-missing");
      });
    });
  }

  function cardMapPlaceholder(day, index) {
    return [
      `<div class="real-map card-real-map map-placeholder" data-card-map="${index}" role="img" aria-label="OpenStreetMap preview for ${htmlEscape(day.title)}">`,
      '<div class="map-placeholder-inner">',
      `${icon("map")}`,
      '<strong>OpenStreetMap</strong>',
      '<span>Loads when this day card is in view</span>',
      '</div>',
      '<a class="map-attribution" target="_blank" rel="noopener" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
      '</div>'
    ].join("");
  }

  function loadCardMap(container) {
    const index = Number(container.dataset.cardMap);
    const day = days[index];
    if (!day || container.dataset.loaded === "true") return;
    container.dataset.loaded = "true";
    container.outerHTML = realMapMarkup(day, { className: "card-real-map" });
    const card = document.getElementById(day.id);
    if (card) attachMapTileHandlers(card);
  }

  function installCardMaps() {
    cards.forEach((card, index) => {
      const day = days[index];
      const mapbox = card.querySelector(".mapbox");
      if (!day || !mapbox || mapbox.dataset.osmReady === "true") return;
      mapbox.dataset.osmReady = "true";
      mapbox.outerHTML = cardMapPlaceholder(day, index);
      const caption = card.querySelector(".mapcaption");
      if (caption) {
        caption.textContent = "OpenStreetMap preview. Use Maps or GPX/OsmAnd for turn-by-turn navigation.";
      }
      card.querySelector(".maplegend")?.remove();
    });

    const placeholders = Array.from(document.querySelectorAll("[data-card-map]"));
    if (!placeholders.length) return;
    if (!("IntersectionObserver" in window)) {
      placeholders.slice(0, 3).forEach(loadCardMap);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        loadCardMap(entry.target);
      });
    }, { rootMargin: "360px 0px" });
    placeholders.forEach((placeholder) => observer.observe(placeholder));
  }

  function buildAppShell() {
    if (!days.length || document.querySelector(".bottom-glass-nav")) return;

    document.body.classList.add("app-shell-ready");
    removeInstallSurface();
    tuneStaticCopy();
    markStaticSections();
    syncRouteMetricsToStaticCards();
    buildTodayPanel();
    buildItineraryPanel();
    buildFuelPanel();
    buildCalendarPanel();
    buildSettingsPanel();
    buildBottomNav();
    installCardMaps();
    wireAppEvents();
    installTodaySwipe();
    setTheme(themeMode);
    updateActiveNav();
    setCurrentDay(currentDay);
  }

  function removeInstallSurface() {
    document.getElementById("iphone")?.remove();
    document.querySelectorAll('a[href="#iphone"]').forEach((link) => link.remove());
    document.querySelectorAll(".install-troubleshooting").forEach((node) => node.remove());
  }

  function tuneStaticCopy() {
    const heroTitle = document.querySelector(".hero h1");
    const heroText = document.querySelector(".hero p");
    const heroPills = document.querySelector(".hero .pillrow");
    const dayHeading = document.querySelector("#days > h2");
    if (heroTitle) heroTitle.textContent = "Alps Roadbook";
    if (heroText) heroText.textContent = "Ducati route, fuel rhythm, camps and GPX.";
    if (heroPills) {
      heroPills.innerHTML = [
        '<a class="pill primary" href="#today">Today</a>',
        '<a class="pill" href="#itinerary">Itinerary</a>',
        '<a class="pill" href="#fuel">Fuel</a>',
        '<a class="pill" href="#calendar">Dates</a>'
      ].join("");
    }
    if (dayHeading) dayHeading.textContent = "Day cards";
  }

  function markStaticSections() {
    document.querySelector("main > .panel.grid")?.classList.add("static-overview");
    document.getElementById("days")?.classList.add("app-day-cards");
    document.getElementById("gpx")?.classList.add("app-gpx-notes");
  }

  function syncRouteMetricsToStaticCards() {
    cards.forEach((card, index) => {
      const metric = ROUTE_METRICS[index];
      if (!metric) return;
      const distanceStat = Array.from(card.querySelectorAll(".stat"))
        .find((stat) => clean(stat.querySelector("span")?.textContent).toLowerCase() === "distance");
      const value = distanceStat?.querySelector("b");
      if (value) value.textContent = `${metric.km} km`;
    });
  }

  function buildTodayPanel() {
    const section = document.createElement("section");
    section.id = "today";
    section.className = "panel app-panel app-view today-panel";
    section.innerHTML = [
      '<div class="app-panel-head">',
      '<div><span class="eyebrow">Main</span><h2>Today on the bike</h2></div>',
      `<select class="app-select" data-day-select aria-label="Choose day">${dayOptions()}</select>`,
      '</div>',
      '<div id="today-card" class="app-card"></div>'
    ].join("");

    const overview = document.querySelector("main > .panel.grid");
    (overview || document.getElementById("days")).before(section);
  }

  function buildItineraryPanel() {
    const section = document.createElement("section");
    section.id = "itinerary";
    section.className = "panel app-panel app-view itinerary-panel";
    section.innerHTML = [
      '<div class="app-panel-head">',
      '<div><span class="eyebrow">Route</span><h2>Full itinerary</h2></div>',
      `<select class="app-select" data-day-select aria-label="Choose itinerary day">${dayOptions()}</select>`,
      '</div>',
      '<div id="itinerary-card" class="app-card"></div>'
    ].join("");

    document.querySelector(".static-overview")?.before(section);
  }

  function buildFuelPanel() {
    const section = document.createElement("section");
    section.id = "fuel";
    section.className = "panel app-panel app-view fuel-panel";
    section.innerHTML = [
      '<div class="app-panel-head">',
      '<div><span class="eyebrow">Fuel</span><h2>180-200 km rhythm</h2></div>',
      `<select class="app-select" data-day-select aria-label="Choose fuel day">${dayOptions()}</select>`,
      '</div>',
      '<div id="fuel-card" class="app-card"></div>'
    ].join("");

    document.getElementById("days").before(section);
  }

  function buildCalendarPanel() {
    const section = document.createElement("section");
    section.id = "calendar";
    section.className = "panel app-panel app-view calendar-panel";
    section.innerHTML = [
      '<div class="app-panel-head">',
      '<div><span class="eyebrow">Dates</span><h2>Calendar</h2></div>',
      `<select class="app-select" data-day-select aria-label="Choose calendar day">${dayOptions()}</select>`,
      '</div>',
      '<div id="calendar-card" class="app-card"></div>'
    ].join("");

    document.getElementById("days").before(section);
  }

  function buildSettingsPanel() {
    const section = document.createElement("section");
    section.id = "settings";
    section.className = "panel app-panel app-view settings-panel";
    section.innerHTML = [
      '<div class="app-panel-head">',
      '<div><span class="eyebrow">Setup</span><h2>App controls</h2></div>',
      '</div>',
      '<div class="setup-grid">',
      '<section class="setup-card">',
      `<span class="setup-icon">${icon("sun")}</span>`,
      '<div><h3>Display</h3><p>Switch the road book for daylight, night riding, or system mode.</p></div>',
      '<div class="segmented" role="group" aria-label="Theme">',
      `<button type="button" data-theme-choice="day">${icon("sun")}Day</button>`,
      `<button type="button" data-theme-choice="night">${icon("moon")}Night</button>`,
      '<button type="button" data-theme-choice="auto">Auto</button>',
      '</div>',
      '</section>',
      '<section class="setup-card">',
      `<span class="setup-icon">${icon("awake")}</span>`,
      '<div><h3>Bike screen</h3><p>Useful when the phone is mounted and you are stopped checking the route.</p></div>',
      `<button class="action primary full" type="button" data-keep-awake>${icon("awake")}<span>Keep Awake</span></button>`,
      '</section>',
      '<section class="setup-card">',
      `<span class="setup-icon">${icon("file")}</span>`,
      '<div><h3>Route pack</h3><p>Download routepoints for OsmAnd, Garmin, TomTom, Kurviger or Calimoto.</p></div>',
      '<div class="action-grid setup-actions">',
      `<a class="action" href="gpx/full_trip_routepoints_v3.gpx" download>${icon("file")}<span>Full GPX</span></a>`,
      `<a class="action" href="data/road_book_links_v3.csv" download>${icon("file")}<span>CSV</span></a>`,
      '<a class="action" href="#gpx"><span class="action-letter">i</span><span>GPX Notes</span></a>',
      '</div>',
      '</section>',
      '<section class="setup-card">',
      `<span class="setup-icon">${icon("shield")}</span>`,
      '<div><h3>Offline</h3><p id="app-status" class="app-muted">Core road book files cache after the first full load. Map tiles still depend on network unless opened in your map app offline.</p></div>',
      '</section>',
      '</div>'
    ].join("");

    document.getElementById("gpx").before(section);
  }

  function todayActivityTile({ href, title, text, iconName, className = "", download = false }) {
    const attrs = download ? "download" : 'target="_blank" rel="noopener"';
    return [
      `<a class="today-activity ${htmlEscape(className)}" href="${htmlEscape(href)}" ${attrs}>`,
      `<span class="today-activity-icon">${icon(iconName)}</span>`,
      '<span>',
      `<strong>${htmlEscape(title)}</strong>`,
      `<small>${htmlEscape(text)}</small>`,
      '</span>',
      '</a>'
    ].join("");
  }

  function todayActivities(day) {
    const breakStop = day.breakStops[0]?.name || "Nature break";
    const fuelStop = day.fuelStops[0]?.name || "Petrol station near me";
    const campStop = day.campStops[0]?.name || day.night || "Night stop";
    return [
      day.google ? todayActivityTile({
        href: day.google,
        title: "Ride",
        text: "Open the full route",
        iconName: "route",
        className: "ride"
      }) : "",
      todayActivityTile({
        href: fuelMapsLink(),
        title: "Fuel",
        text: fuelStop,
        iconName: "fuel",
        className: "fuel"
      }),
      todayActivityTile({
        href: googleSearchLink(breakStop),
        title: "Break",
        text: breakStop,
        iconName: "coffee",
        className: "break"
      }),
      day.camp ? todayActivityTile({
        href: day.camp,
        title: "Camp",
        text: campStop,
        iconName: "camp",
        className: "camp"
      }) : "",
      day.gpx ? todayActivityTile({
        href: day.gpx,
        title: "GPX",
        text: "Download routepoints",
        iconName: "file",
        className: "gpx",
        download: true
      }) : ""
    ].join("");
  }

  function formatDuration(mins) {
    if (!mins) return "";
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${hours}h${String(minutes).padStart(2, "0")}`;
  }

  function stopTypeText(stop) {
    return clean((stop.type || "stop")
      .replace(/^[^a-zA-Z0-9]+/, "")
      .replace(/^(S|C)\s+/i, "")) || "stop";
  }

  function stopKind(stop, index, count) {
    const text = `${stop.name} ${stop.type}`.toLowerCase();
    if (index === 0) return "start";
    if (index === count - 1) return /camp|night|home|friends/.test(text) ? "camp" : "arrive";
    if (/fuel/.test(text)) return "fuel";
    if (/break|coffee|nature|picnic|lake|river/.test(text)) return "break";
    if (isSightStop(stop)) return "sight";
    if (/camp/.test(text)) return "camp";
    return "stop";
  }

  function stopKindLabel(kind) {
    const labels = {
      arrive: "Arrive",
      break: "Break",
      camp: "Camp",
      fuel: "Fuel",
      sight: "Sight",
      start: "Start",
      stop: "Stop"
    };
    return labels[kind] || labels.stop;
  }

  function stopKindIcon(kind) {
    const icons = {
      arrive: "target",
      break: "coffee",
      camp: "camp",
      fuel: "fuel",
      sight: "map",
      start: "trip",
      stop: "target"
    };
    return icons[kind] || icons.stop;
  }

  function stopDistanceIntoDay(day, stop) {
    const index = day.stops.findIndex((item) => item.name === stop.name);
    if (index <= 0 || !day.legsKm.length) return 0;
    return day.legsKm.slice(0, index).reduce((sum, km) => sum + km, 0);
  }

  function roughItinerary(day) {
    if (!day.stops.length || !day.legsKm.length) return [];
    const count = day.stops.length;
    const limit = Math.min(day.legsKm.length, count - 1);
    const items = [];
    for (let index = 0; index < limit; index += 1) {
      const from = day.stops[index];
      const to = day.stops[index + 1];
      const km = day.legsKm[index] || 0;
      if (!to || (km < 1 && clean(from?.name).toLowerCase() === clean(to.name).toLowerCase())) continue;
      const kind = stopKind(to, index + 1, count);
      items.push({
        km: Math.max(1, km),
        name: sightName(to),
        type: stopTypeText(to),
        kind
      });
    }
    return items;
  }

  function todayRoughItineraryMarkup(day) {
    const items = roughItinerary(day);
    if (!items.length) return "";
    return [
      '<details class="today-itinerary" open>',
      '<summary>',
      '<span><small>Rough itinerary</small><strong>Ride rhythm</strong></span>',
      `<b>${htmlEscape(day.distance)}${day.routeDurationMins ? ` · ${htmlEscape(formatDuration(day.routeDurationMins))}` : ""}</b>`,
      '</summary>',
      '<div class="today-route-summary">',
      `<span><strong>${htmlEscape(day.distance)}</strong><small>OSM route km</small></span>`,
      day.routeDurationMins ? `<span><strong>${htmlEscape(formatDuration(day.routeDurationMins))}</strong><small>OSM estimate</small></span>` : "",
      `<span><strong>${htmlEscape(String(items.length))}</strong><small>Route legs</small></span>`,
      '</div>',
      '<ol class="ride-segments">',
      items.map((item) => [
        `<li class="ride-segment ${htmlEscape(item.kind)}">`,
        '<span class="ride-segment-leg">',
        `<strong>Ride ${htmlEscape(String(item.km))} km</strong>`,
        `<small>to ${htmlEscape(item.name)}</small>`,
        '</span>',
        '<span class="ride-segment-stop">',
        `<span class="ride-segment-icon">${icon(stopKindIcon(item.kind))}</span>`,
        '<span>',
        `<b>${htmlEscape(stopKindLabel(item.kind))}</b>`,
        `<small>${htmlEscape(item.type)}</small>`,
        '</span>',
        '</span>',
        '</li>'
      ].join("")).join(""),
      '</ol>',
      '</details>'
    ].join("");
  }

  function isSightStop(stop) {
    const text = `${stop.name} ${stop.type}`;
    return SIGHT_MATCHER.test(text) && !/fuel|start|home/i.test(text);
  }

  function sightName(stop) {
    return clean(stop.name
      .replace(/\s*\/\s*(coffee|break|nature stop|picnic|fuel option|fuel|camp|night)\b.*$/i, "")
      .replace(/\s+-\s*(coffee|break|nature stop|picnic|fuel|camp|night)\b.*$/i, ""));
  }

  function sightTheme(stop) {
    const text = `${stop.name} ${stop.type}`.toLowerCase();
    if (/lac|lake|see|river|gileppe|settons|titisee|schluchsee|water/.test(text)) return "lake";
    if (/col\b|pass|iseran|grimsel|furka|susten|roselend|schlucht|bernard|pré|pre|chapieux|glacier/.test(text)) return "mountain";
    if (/camp|camping|bivouac/.test(text)) return "camp";
    if (/forest|morvan|ardenne|vosges|jura|valley|vall[eé]e|munster/.test(text)) return "forest";
    return "town";
  }

  function sightDescription(stop, day) {
    const text = `${stop.name} ${stop.type} ${dayRegion(day)}`.toLowerCase();
    if (/lac|lake|see|river|gileppe|settons|titisee|schluchsee|water/.test(text)) {
      return "Water-side pause for a short walk, snack, and quiet reset before the next riding section.";
    }
    if (/col\b|pass|iseran|grimsel|furka|susten|roselend|schlucht|bernard|pré|pre|chapieux|glacier/.test(text)) {
      return "Mountain-road viewpoint with the kind of short stop that makes the day feel bigger.";
    }
    if (/forest|morvan|ardenne|vosges|jura|valley|vall[eé]e|munster/.test(text)) {
      return "Green valley or forest stop, useful for a calm break away from traffic.";
    }
    if (/camp|camping/.test(text)) {
      return "End-of-day anchor near the route, good for checking in and planning tomorrow.";
    }
    return `Compact stop near ${dayRegion(day)} for a quick look around without adding a big detour.`;
  }

  function sightInitials(name) {
    const initials = clean(name).split(/[\s/-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase();
    return initials || "•";
  }

  function sightPalette(theme) {
    const palettes = {
      lake: ["#b9dcff", "#5a9d73", "#2d6cdf", "#f7fbff"],
      mountain: ["#dce8ff", "#556d60", "#c98533", "#fffaf0"],
      forest: ["#cfe9cf", "#2f7b4f", "#6b8f3b", "#f9f4dc"],
      camp: ["#d7e8ff", "#447556", "#e6b450", "#fff8e7"],
      town: ["#e7edf3", "#697c72", "#c36a3d", "#fffaf0"]
    };
    return palettes[theme] || palettes.town;
  }

  function sightPictureMarkup(sight) {
    const [sky, land, accent, light] = sightPalette(sight.theme);
    const initials = htmlEscape(sightInitials(sight.name));
    const label = htmlEscape(`${sight.name} visual`);
    const base = [
      `<svg class="sight-picture" viewBox="0 0 240 136" role="img" aria-label="${label}">`,
      '<rect width="240" height="136" rx="0" fill="' + sky + '"/>',
      `<circle cx="202" cy="30" r="18" fill="${light}" opacity="0.9"/>`
    ];
    const marks = {
      lake: [
        `<path d="M0 70 C52 52 78 66 116 54 C154 42 186 58 240 46 V136 H0Z" fill="${land}" opacity="0.92"/>`,
        `<path d="M0 88 C48 78 83 94 124 84 C165 74 197 91 240 82 V136 H0Z" fill="${accent}" opacity="0.9"/>`,
        `<path d="M36 106 C76 98 102 111 138 103 C174 95 196 106 218 101" fill="none" stroke="${light}" stroke-width="3" opacity="0.72"/>`
      ],
      mountain: [
        `<path d="M0 98 L54 44 L82 74 L120 24 L182 98 Z" fill="${land}" opacity="0.95"/>`,
        `<path d="M70 98 L126 42 L156 68 L198 31 L240 98 Z" fill="#22392c" opacity="0.78"/>`,
        `<path d="M120 24 L106 50 L128 43 L140 61 Z" fill="${light}" opacity="0.88"/>`,
        `<path d="M38 113 C86 96 142 125 204 101" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`
      ],
      forest: [
        `<path d="M0 78 C46 48 80 70 121 48 C166 24 194 52 240 38 V136 H0Z" fill="${land}" opacity="0.9"/>`,
        `<path d="M22 104 l16-30 16 30h-9l11 20H20l11-20z M96 108 l19-38 19 38h-10l13 23H91l14-23z M174 103 l17-34 17 34h-9l12 23h-40l12-23z" fill="#174a31" opacity="0.82"/>`,
        `<path d="M0 114 C54 100 104 124 158 108 C194 98 216 106 240 98 V136 H0Z" fill="${accent}" opacity="0.65"/>`
      ],
      camp: [
        `<path d="M0 78 C56 56 88 72 128 56 C168 40 198 54 240 44 V136 H0Z" fill="${land}" opacity="0.88"/>`,
        `<path d="M72 112 L116 44 L160 112 Z" fill="${accent}"/>`,
        `<path d="M116 44 L130 112 H102 Z" fill="${light}" opacity="0.88"/>`,
        `<path d="M52 116 H188" stroke="#173421" stroke-width="6" stroke-linecap="round" opacity="0.55"/>`
      ],
      town: [
        `<path d="M0 90 C50 76 84 93 126 80 C168 66 197 80 240 70 V136 H0Z" fill="${land}" opacity="0.75"/>`,
        `<rect x="46" y="61" width="32" height="55" rx="4" fill="${light}" opacity="0.9"/>`,
        `<rect x="86" y="42" width="38" height="74" rx="5" fill="${accent}" opacity="0.9"/>`,
        `<rect x="134" y="70" width="56" height="46" rx="5" fill="#253d30" opacity="0.84"/>`,
        `<path d="M28 116 H212" stroke="${light}" stroke-width="5" stroke-linecap="round" opacity="0.78"/>`
      ]
    };
    return [
      ...base,
      ...(marks[sight.theme] || marks.town),
      `<g class="sight-badge" transform="translate(16 16)"><rect width="48" height="32" rx="12" fill="rgba(6,17,12,0.74)"/><text x="24" y="22" text-anchor="middle">${initials}</text></g>`,
      '</svg>'
    ].join("");
  }

  function todaySights(day) {
    const scenicBreaks = day.breakStops.filter((stop) => (
      SIGHT_MATCHER.test(`${stop.name} ${stop.type}`) ||
      /nature|picnic|lake|river/i.test(`${stop.name} ${stop.type}`)
    ));
    const usefulCamps = day.campStops.filter((stop) => !/home|friends/i.test(`${stop.name} ${stop.type}`));
    const candidates = [
      ...day.sightStops,
      ...scenicBreaks,
      ...usefulCamps
    ];
    const seen = new Set();
    const sights = candidates.reduce((items, stop) => {
      const name = sightName(stop);
      const key = name.toLowerCase();
      if (!name || seen.has(key) || /fuel|start|home/i.test(`${name} ${stop.type}`)) return items;
      seen.add(key);
      const distance = stopDistanceIntoDay(day, stop);
      items.push({
        name,
        description: sightDescription(stop, day),
        href: googleSearchLink(name),
        meta: distance ? `${distance} km into ride` : "On route",
        theme: sightTheme(stop)
      });
      return items;
    }, []);
    if (sights.length) return sights.slice(0, 3);
    const destination = dayDestination(day);
    return [{
      name: destination,
      description: `Simple stop near ${dayRegion(day)} for a quick look around and route check.`,
      href: googleSearchLink(destination),
      theme: "town"
    }];
  }

  function todaySightsMarkup(day) {
    const sights = todaySights(day);
    return [
      '<section class="today-sights" aria-label="Nearby sights">',
      '<div class="today-section-head"><span>Nearby sights</span><strong>Worth a stop</strong></div>',
      '<div class="sight-strip">',
      sights.map((sight, index) => [
        `<a class="sight-card" target="_blank" rel="noopener" href="${htmlEscape(sight.href)}" aria-label="Open ${htmlEscape(sight.name)} in Maps">`,
        sightPictureMarkup(sight),
        '<span class="sight-copy">',
        `<strong>${htmlEscape(sight.name)}</strong>`,
        `<small>${htmlEscape(sight.description)}</small>`,
        `<span class="sight-meta">${htmlEscape(sight.meta || "On route")}</span>`,
        `<span class="sight-open">${icon("map")}<span>Maps</span></span>`,
        '</span>',
        '</a>'
      ].join("")).join(""),
      '</div>',
      '</section>'
    ].join("");
  }

  function dayDestination(day) {
    const last = day.campStops[0]?.name || day.title.split("→").pop() || day.title;
    return clean(last.replace(/^[•C]\s*/, ""));
  }

  function routeQuickActions(day) {
    const actions = [
      day.google ? actionLink("action primary", day.google, "Maps", "map") : "",
      actionLink("action fuel-action", fuelMapsLink(), "Fuel", "fuel"),
      day.camp ? actionLink("action camp-action", day.camp, "Camp", "camp") : "",
      day.osm ? actionLink("action", day.osm, "OSM", "map") : "",
      day.gpx ? `<a class="action" href="${htmlEscape(day.gpx)}" download>${icon("file")}<span>GPX</span></a>` : ""
    ].filter(Boolean);
    return `<div class="route-actions">${actions.join("")}</div>`;
  }

  function stopCardsMarkup(stops, emptyText) {
    if (!stops.length) return `<p class="app-muted">${htmlEscape(emptyText)}</p>`;
    return stops.slice(0, 6).map((stop) => (
      `<a class="route-stop-card" target="_blank" rel="noopener" href="${htmlEscape(googleSearchLink(stop.name))}">` +
      `<strong>${htmlEscape(stop.name)}</strong><span>${htmlEscape(stop.type || "stop")}</span>` +
      '</a>'
    )).join("");
  }

  function campOptions(day) {
    const options = [];
    day.campStops.forEach((stop) => {
      if (!options.some((item) => item.name === stop.name)) {
        options.push({ name: stop.name, type: stop.type || "Camp / night stop", href: googleSearchLink(stop.name) });
      }
    });
    if (day.night && !options.some((item) => item.name === day.night)) {
      options.push({ name: day.night, type: "Planned night", href: googleSearchLink(day.night) });
    }
    if (day.camp) {
      options.push({ name: "Official camping page", type: "Booking / campsite info", href: day.camp });
    }
    options.push({
      name: `Camping near ${dayDestination(day)}`,
      type: "Map search",
      href: googleSearchLink(`camping near ${dayDestination(day)}`)
    });
    return options.slice(0, 5);
  }

  function campOptionsMarkup(day) {
    return campOptions(day).map((option) => (
      `<a class="camp-option" target="_blank" rel="noopener" href="${htmlEscape(option.href)}">` +
      `<span class="camp-option-icon">${icon("camp")}</span>` +
      `<span><strong>${htmlEscape(option.name)}</strong><small>${htmlEscape(option.type)}</small></span>` +
      '</a>'
    )).join("");
  }

  function routeDayCard(day) {
    return [
      '<article class="route-day-card">',
      '<div class="route-day-hero">',
      realMapMarkup(day, { className: "route-day-map" }),
      '<div class="route-day-copy">',
      `<div class="app-day-kicker">${htmlEscape(day.label)} / ${htmlEscape(day.meta)}</div>`,
      `<h3>${htmlEscape(day.title)}</h3>`,
      `<p>${htmlEscape(day.ridePlan || day.note || "Follow the planned route and keep the day simple.")}</p>`,
      '</div>',
      '</div>',
      `<div class="metric-row route-day-stats">${chipMarkup(day)}</div>`,
      routeQuickActions(day),
      '<div class="route-detail-grid">',
      `<section class="route-detail-card"><span>Fuel stops</span><div class="route-stop-grid">${stopCardsMarkup(day.fuelStops, "No named fuel stop for this day.")}</div></section>`,
      `<section class="route-detail-card"><span>Breaks</span><div class="route-stop-grid">${stopCardsMarkup(day.breakStops, "Use a quiet scenic stop from the route.")}</div></section>`,
      `<section class="route-detail-card camps"><span>Camping options</span><div class="camp-option-list">${campOptionsMarkup(day)}</div></section>`,
      '</div>',
      '</article>'
    ].join("");
  }

  function renderToday() {
    const target = document.getElementById("today-card");
    if (!target || !days.length) return;
    const day = days[currentDay];
    target.classList.add("today-card");
    target.innerHTML = [
      '<div class="today-hero-copy">',
      `<div class="app-day-kicker">${htmlEscape(day.label)} / ${htmlEscape(day.meta)}</div>`,
      `<h3>${htmlEscape(day.title)}</h3>`,
      `<p class="today-intro">${htmlEscape(day.ridePlan || day.note || "Keep the day simple and ride within the plan.")}</p>`,
      '</div>',
      '<div class="today-actions">',
      day.google ? actionLink("action primary today-main-action", day.google, "Maps", "map") : "",
      todayActivityTile({
        href: fuelMapsLink(),
        title: "Fuel",
        text: "Near me",
        iconName: "fuel",
        className: "today-fuel-direct"
      }),
      day.camp ? actionLink("action camp-action today-main-action", day.camp, "Camp", "camp") : "",
      '</div>',
      '<div class="today-hero">',
      realMapMarkup(day, { className: "today-map today-hero-map", eager: true }),
      '</div>',
      `<div class="metric-row today-stats">${chipMarkup(day)}</div>`,
      todayRoughItineraryMarkup(day),
      todaySightsMarkup(day),
      '<div class="today-activities">',
      todayActivities(day),
      '</div>',
      '<div class="today-secondary">',
      `<button class="mini-link button-link" type="button" data-prev-day${currentDay === 0 ? " disabled" : ""}>Previous</button>`,
      '<button class="mini-link button-link" type="button" data-open-day>Day Card</button>',
      `<button class="mini-link button-link" type="button" data-next-day${currentDay === days.length - 1 ? " disabled" : ""}>Next</button>`,
      '</div>'
    ].join("");
    attachMapTileHandlers(target);
  }

  function renderItinerary() {
    const target = document.getElementById("itinerary-card");
    if (!target || !days.length) return;
    const totalKm = days.reduce((sum, day) => sum + day.distanceKm, 0);
    const fullCoords = days.flatMap((day) => day.coords);
    const fullTrip = {
      coords: fullCoords,
      osm: openStreetMapRoute(fullCoords)
    };
    const day = days[currentDay];
    target.innerHTML = [
      routeDayCard(day),
      '<div class="metric-row itinerary-summary">',
      `<div class="metric"><span>Days</span><b>${days.length}</b></div>`,
      `<div class="metric"><span>OSM km</span><b>${totalKm} km</b></div>`,
      '<div class="metric"><span>Fuel rule</span><b>180-200 km</b></div>',
      '</div>',
      realMapMarkup(fullTrip, { className: "itinerary-map" }),
      '<div class="itinerary-list">',
      days.map((day, index) => [
        `<article class="itinerary-item${index === currentDay ? " is-current" : ""}">`,
        '<div class="itinerary-main">',
        `<span class="itinerary-date">${htmlEscape(dayDate(day))}</span>`,
        `<h3>${htmlEscape(day.shortLabel)}. ${htmlEscape(day.title)}</h3>`,
        `<p>${htmlEscape(dayRegion(day))} / ${htmlEscape(day.distance || "-")} / ${htmlEscape(day.rideTime || "-")}</p>`,
        '</div>',
        '<div class="itinerary-actions">',
        `<button class="mini-link button-link" type="button" data-select-day="${index}" data-go="today">Today</button>`,
        `<button class="mini-link button-link" type="button" data-select-day="${index}" data-go="itinerary">Card</button>`,
        day.google ? `<a class="mini-link" href="${htmlEscape(day.google)}" target="_blank" rel="noopener">Maps</a>` : "",
        '</div>',
        '</article>'
      ].join("")).join(""),
      '</div>'
    ].join("");
    attachMapTileHandlers(target);
  }

  function renderFuel() {
    const target = document.getElementById("fuel-card");
    if (!target || !days.length) return;
    const day = days[currentDay];
    const fuelStops = day.fuelStops.length ? day.fuelStops : [{ name: "Petrol station near me", type: "Map search" }];
    target.innerHTML = [
      `<div class="app-day-kicker">${htmlEscape(day.label)} / ${htmlEscape(day.title)}</div>`,
      '<div class="fuel-dashboard">',
      '<div class="fuel-dashboard-main">',
      `<span class="fuel-dashboard-icon">${icon("fuel")}</span>`,
      `<strong>${htmlEscape(fuelWindows(day))}</strong>`,
      '<p>Plan the Scrambler around 180-200 km. Open a map search before leaving the stop.</p>',
      '</div>',
      '<div class="fuel-dashboard-actions">',
      `<a class="action primary" target="_blank" rel="noopener" href="${fuelMapsLink()}">${icon("fuel")}<span>Fuel near me</span></a>`,
      `<a class="action" target="_blank" rel="noopener" href="${appleFuelMapsLink()}">${icon("map")}<span>Apple Maps</span></a>`,
      '</div>',
      '</div>',
      '<div class="fuel-simple-grid">',
      `<section class="fuel-simple-card"><span>Distance</span><strong>${htmlEscape(day.distance || "-")}</strong></section>`,
      `<section class="fuel-simple-card"><span>Rule</span><strong>180-200 km</strong></section>`,
      `<section class="fuel-simple-card"><span>Stops</span><strong>${fuelStops.length}</strong></section>`,
      '</div>',
      `<section class="fuel-plan-card"><span>Plan</span><p>${htmlEscape(day.fuel || "Fuel before 180-200 km and never arrive at camp on reserve.")}</p></section>`,
      '<section class="fuel-stop-panel">',
      '<div class="nearby-head"><span>Planned fuel stops</span></div>',
      '<div class="fuel-stop-grid">',
      fuelStops.map((stop) => (
        `<a class="fuel-stop-card" target="_blank" rel="noopener" href="${htmlEscape(googleSearchLink(stop.name))}">` +
        `${icon("fuel")}<span><strong>${htmlEscape(stop.name)}</strong><small>${htmlEscape(stop.type || "fuel")}</small></span>` +
        '</a>'
      )).join(""),
      '</div>',
      '</section>'
    ].join("");
  }

  function parseTripDateRange(day) {
    const match = dayDate(day).match(/(\d+)(?:[–-](\d+))?\s+([A-Za-z]+)/);
    if (!match) return null;
    const months = { Jul: 6, July: 6, Aug: 7, August: 7 };
    const month = months[match[3]];
    if (month == null) return null;
    return {
      start: Number(match[1]),
      end: Number(match[2] || match[1]),
      month
    };
  }

  function calendarMonthMarkup(month, label) {
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const entries = days.map((day, index) => ({ day, index, range: parseTripDateRange(day) }))
      .filter((entry) => entry.range?.month === month);
    const entryByStart = new Map(entries.map((entry) => [entry.range.start, entry]));
    const daysInMonth = new Date(2026, month + 1, 0).getDate();
    const leading = (new Date(2026, month, 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < leading; i += 1) cells.push('<div class="calendar-cell is-empty"></div>');
    for (let date = 1; date <= daysInMonth; date += 1) {
      const entry = entryByStart.get(date);
      const active = entry?.index === currentDay;
      cells.push([
        `<div class="calendar-cell${entry ? " has-trip" : ""}${active ? " is-current" : ""}">`,
        `<span class="calendar-number">${date}</span>`,
        entry ? [
          `<button class="calendar-day-button" type="button" data-select-day="${entry.index}" data-go="itinerary">`,
          `<strong>${htmlEscape(`Day ${entry.day.shortLabel}`)}</strong>`,
          entry.range.end > entry.range.start ? `<small>${htmlEscape(`${entry.range.start}-${entry.range.end} ${label}`)}</small>` : "",
          '</button>'
        ].join("") : "",
        '</div>'
      ].join(""));
    }
    return [
      '<section class="calendar-month">',
      `<h3>${htmlEscape(label)} 2026</h3>`,
      `<div class="calendar-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>`,
      `<div class="calendar-grid">${cells.join("")}</div>`,
      '</section>'
    ].join("");
  }

  function renderCalendar() {
    const target = document.getElementById("calendar-card");
    if (!target || !days.length) return;
    target.innerHTML = [
      '<div class="calendar-summary">',
      '<strong>20 Jul - 14 Aug</strong>',
      '<span>The Hague to the Alps, Switzerland, Vosges, Ardennes, home.</span>',
      '</div>',
      '<div class="calendar-months">',
      calendarMonthMarkup(6, "Jul"),
      calendarMonthMarkup(7, "Aug"),
      '</div>',
      `<div class="calendar-selected"><span>Selected</span><strong>${htmlEscape(dayDate(days[currentDay]))} · ${htmlEscape(days[currentDay].title)}</strong></div>`
    ].join("");
  }

  function fuelMapsLink() {
    return "https://www.google.com/maps/search/petrol+station+near+me";
  }

  function googleSearchLink(query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function appleFuelMapsLink() {
    return "https://maps.apple.com/?q=petrol%20station";
  }

  function fuelShortcutMarkup(compact = false) {
    return [
      '<div class="fuel-shortcut">',
      `<a class="action primary fuel-direct" target="_blank" rel="noopener" href="${fuelMapsLink()}">${icon("fuel")}<span>Fuel in Maps</span></a>`,
      compact ? "" : `<a class="mini-link" target="_blank" rel="noopener" href="${appleFuelMapsLink()}">Apple Maps</a>`,
      '<p class="app-muted">Opens a petrol-station search using the map app location context.</p>',
      '</div>'
    ].join("");
  }

  function renderFuelShortcut() {
    const panel = document.getElementById("nearby-fuel-list");
    const floating = document.getElementById("fuel-floating-content");
    if (panel) panel.innerHTML = fuelShortcutMarkup();
    if (floating) floating.innerHTML = fuelShortcutMarkup(true);
  }

  function isInteractiveTarget(target) {
    return Boolean(target.closest?.("a, button, input, select, textarea, summary, details, [role='button']"));
  }

  function animateTodaySwipe(direction) {
    const target = document.getElementById("today-card");
    if (!target) return;
    target.classList.remove("is-swipe-next", "is-swipe-prev");
    void target.offsetWidth;
    target.classList.add(direction > 0 ? "is-swipe-next" : "is-swipe-prev");
    window.setTimeout(() => {
      target.classList.remove("is-swipe-next", "is-swipe-prev");
    }, 260);
  }

  function moveTodayBySwipe(direction) {
    const nextDay = currentDay + direction;
    if (nextDay < 0 || nextDay >= days.length) return;
    setCurrentDay(nextDay);
    animateTodaySwipe(direction);
  }

  function installTodaySwipe() {
    if (todaySwipeInstalled) return;
    todaySwipeInstalled = true;
    let swipeStart = null;

    document.addEventListener("touchstart", (event) => {
      const card = event.target.closest?.("#today-card");
      if (!card || document.body.dataset.activeTab !== "today" || isInteractiveTarget(event.target)) {
        swipeStart = null;
        return;
      }
      const touch = event.touches[0];
      swipeStart = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    }, { passive: true });

    document.addEventListener("touchend", (event) => {
      if (!swipeStart) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;
      const elapsed = Date.now() - swipeStart.time;
      swipeStart = null;

      if (
        elapsed > SWIPE_MAX_TIME ||
        Math.abs(deltaX) < SWIPE_MIN_DISTANCE ||
        Math.abs(deltaX) < Math.abs(deltaY) * 1.4
      ) {
        return;
      }

      moveTodayBySwipe(deltaX < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener("touchcancel", () => {
      swipeStart = null;
    }, { passive: true });
  }

  function buildBottomNav() {
    const nav = document.createElement("nav");
    nav.className = "bottom-glass-nav";
    nav.setAttribute("aria-label", "Main app navigation");
    nav.innerHTML = [
      `<a href="#today" data-tab="today">${icon("target")}<span>Today</span></a>`,
      `<a href="#itinerary" data-tab="itinerary">${icon("route")}<span>Route</span></a>`,
      `<a href="#fuel" data-tab="fuel">${icon("fuel")}<span>Fuel</span></a>`,
      `<a href="#calendar" data-tab="calendar">${icon("calendar")}<span>Dates</span></a>`,
      `<a href="#settings" data-tab="settings">${icon("sliders")}<span>Setup</span></a>`
    ].join("");
    document.body.appendChild(nav);
  }

  function buildFuelFloatingSheet() {
    const sheet = document.createElement("aside");
    sheet.id = "fuel-floating-sheet";
    sheet.className = "fuel-floating-sheet";
    sheet.setAttribute("aria-label", "Nearby petrol stations");
    sheet.innerHTML = [
      '<div class="fuel-floating-head">',
      '<span>Fuel shortcut</span>',
      '</div>',
      '<div id="fuel-floating-content" class="nearby-list"></div>'
    ].join("");
    document.body.appendChild(sheet);
    renderFuelShortcut();
  }

  function wireAppEvents() {
    document.addEventListener("change", (event) => {
      if (event.target.matches("[data-day-select]")) {
        setCurrentDay(Number(event.target.value));
      }
    });

    document.addEventListener("click", (event) => {
      const themeButton = event.target.closest("[data-theme-choice]");
      if (themeButton) setTheme(themeButton.getAttribute("data-theme-choice"));

      const dayButton = event.target.closest("[data-select-day]");
      if (dayButton) {
        const index = Number(dayButton.getAttribute("data-select-day"));
        if (Number.isInteger(index)) {
          setCurrentDay(index);
          if (dayButton.dataset.go === "today") {
            event.preventDefault();
            window.location.hash = "today";
          }
          if (dayButton.dataset.go === "itinerary") {
            event.preventDefault();
            window.location.hash = "itinerary";
          }
        }
      }

      if (event.target.closest("[data-prev-day]")) setCurrentDay(currentDay - 1);
      if (event.target.closest("[data-next-day]")) setCurrentDay(currentDay + 1);
      if (event.target.closest("[data-open-day]")) {
        event.preventDefault();
        window.location.hash = days[currentDay].id;
        updateActiveNav();
      }

      if (event.target.closest("[data-keep-awake]") && typeof window.keepAwake === "function") {
        window.keepAwake();
      }
    });

    window.addEventListener("hashchange", updateActiveNav);
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const refreshAutoTheme = () => {
      if (themeMode === "auto") setTheme("auto");
    };
    if (typeof colorScheme.addEventListener === "function") {
      colorScheme.addEventListener("change", refreshAutoTheme);
    } else if (typeof colorScheme.addListener === "function") {
      colorScheme.addListener(refreshAutoTheme);
    }
  }

  function updateActiveNav() {
    const hash = window.location.hash.replace("#", "");
    const hashDayIndex = days.findIndex((day) => day.id === hash);
    if (hashDayIndex >= 0 && hashDayIndex !== currentDay) {
      setCurrentDay(hashDayIndex);
    }
    const active = hash === "fuel"
      ? "fuel"
      : hash === "settings" || hash === "gpx"
        ? "settings"
        : hash === "calendar"
          ? "calendar"
          : hash === "itinerary" || hash === "days" || hashDayIndex >= 0
            ? "itinerary"
            : "today";
    document.body.dataset.activeTab = active;
    document.body.dataset.showDayCards = String(hash === "days");
    document.body.dataset.showGpx = String(hash === "gpx");
    document.querySelectorAll("[data-tab]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.tab === active);
    });
    if (hashDayIndex >= 0) {
      window.requestAnimationFrame(() => {
        document.getElementById("itinerary")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function organizeDayCardActions() {
    cards.forEach((card, index) => {
      const actions = card.querySelector(".btns");
      const day = days[index];
      if (!actions || !day || actions.dataset.organized === "true") return;
      const next = actions.querySelector('a.btn.full[href^="#day"]:not([style*="display:none"])')?.getAttribute("href");
      actions.dataset.organized = "true";
      actions.classList.add("organized-actions");
      actions.innerHTML = actionPanel(day, { nextHref: next });
    });
  }

  function addFullGpxButtons() {
    const panel = document.getElementById("gpx");
    if (!panel || panel.querySelector(".full-gpx-actions")) return;
    const actions = document.createElement("div");
    actions.className = "btns full-gpx-actions";
    actions.innerHTML = [
      '<a class="btn osmand" href="gpx/full_trip_routepoints_v3.gpx" target="_blank" rel="noopener">OsmAnd full GPX</a>',
      '<a class="btn" href="gpx/full_trip_routepoints_v3.gpx" download>Download full GPX</a>',
      '<a class="btn full" href="data/road_book_links_v3.csv" download>Download route CSV</a>'
    ].join("");
    panel.appendChild(actions);
  }

  organizeDayCardActions();
  addFullGpxButtons();
  buildAppShell();
}());
