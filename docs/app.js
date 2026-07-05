(function () {
  "use strict";

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const cards = Array.from(document.querySelectorAll(".card[id^='day']"));
  const THEME_KEY = "roadbookThemeMode";
  const DAY_KEY = "roadbookActiveDay";
  const TILE_SIZE = 256;

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
    const last = coords[coords.length - 1];
    const center = coordsCenter(coords);
    if (coords.length < 2) {
      return `https://www.openstreetmap.org/?mlat=${first.lat}&mlon=${first.lon}#map=12/${first.lat}/${first.lon}`;
    }
    return [
      "https://www.openstreetmap.org/directions",
      `?engine=fossgis_osrm_car&route=${first.lat}%2C${first.lon}%3B${last.lat}%2C${last.lon}`,
      `#map=${chooseMapZoom(coords)}/${center.lat}/${center.lon}`
    ].join("");
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
      return `<img data-map-tile alt="" loading="lazy" src="https://tile.openstreetmap.org/${zoom}/${x}/${y}.png">`;
    }).join("")).join("");

    return [
      `<div class="${htmlEscape(className)}" aria-label="Live OpenStreetMap route preview">`,
      `<div class="tile-grid">${tiles}</div>`,
      `<svg class="route-overlay" viewBox="0 0 768 768" aria-hidden="true"><polyline points="${routePoints}"/>${markers}</svg>`,
      '<a class="map-open" target="_blank" rel="noopener" href="' + htmlEscape(day.osm) + '">Open map</a>',
      '<a class="map-attribution" target="_blank" rel="noopener" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
      '</div>'
    ].join("");
  }

  function dayData(card, index) {
    const stops = cardStops(card);
    const stats = cardStats(card);
    const distance = statValue(stats, "Distance");
    const google = card.querySelector(".btn.blue[href^='https://www.google.com/maps']")?.getAttribute("href") || "";
    const coords = parseGoogleRoute(google);
    const gpx = card.querySelector("a[download][href$='.gpx']")?.getAttribute("href") || "";
    return {
      index,
      id: card.id,
      label: `Day ${String(index + 1).padStart(2, "0")}`,
      shortLabel: String(index + 1).padStart(2, "0"),
      title: clean(card.querySelector("h2")?.textContent),
      meta: clean(card.querySelector(".card-header div[style*='font-weight']")?.textContent),
      stats,
      distance,
      distanceKm: parseKm(distance),
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
      fuelStops: stops.filter((stop) => /fuel/i.test(`${stop.name} ${stop.type}`)),
      breakStops: stops.filter((stop) => /break|coffee|nature|picnic|lake|river/i.test(`${stop.name} ${stop.type}`)),
      campStops: stops.filter((stop) => /camp|night|home|friends/i.test(`${stop.name} ${stop.type}`))
    };
  }

  const days = cards.map(dayData);
  let currentDay = savedDay();
  let themeMode = window.localStorage.getItem(THEME_KEY) || "day";

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
    buildTodayPanel();
    buildItineraryPanel();
    buildFuelPanel();
    buildCalendarPanel();
    buildSettingsPanel();
    buildBottomNav();
    installCardMaps();
    wireAppEvents();
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
      '<div><span class="eyebrow">Settings</span><h2>Ride setup</h2></div>',
      '</div>',
      '<div class="settings-grid">',
      '<div class="settings-group">',
      '<h3>Display</h3>',
      '<div class="segmented" role="group" aria-label="Theme">',
      `<button type="button" data-theme-choice="day">${icon("sun")}Day</button>`,
      `<button type="button" data-theme-choice="night">${icon("moon")}Night</button>`,
      '<button type="button" data-theme-choice="auto">Auto</button>',
      '</div>',
      '</div>',
      '<div class="settings-group">',
      '<h3>Bike</h3>',
      `<button class="action full" type="button" data-keep-awake>${icon("awake")}<span>Keep Screen Awake</span></button>`,
      '<p id="app-status" class="app-muted">Offline cache ready after first full load.</p>',
      '</div>',
      '<div class="settings-group">',
      '<h3>Route pack</h3>',
      '<div class="action-grid">',
      `<a class="action" href="gpx/full_trip_routepoints_v3.gpx" download>${icon("file")}<span>Full GPX</span></a>`,
      `<a class="action" href="data/road_book_links_v3.csv" download>${icon("file")}<span>CSV</span></a>`,
      '<a class="action" href="#gpx"><span class="action-letter">i</span><span>GPX Notes</span></a>',
      '</div>',
      '</div>',
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

  function renderToday() {
    const target = document.getElementById("today-card");
    if (!target || !days.length) return;
    const day = days[currentDay];
    target.classList.add("today-card");
    target.innerHTML = [
      '<div class="today-hero">',
      realMapMarkup(day, { className: "today-map today-hero-map" }),
      '<div class="today-hero-copy">',
      `<div class="app-day-kicker">${htmlEscape(day.label)} / ${htmlEscape(day.meta)}</div>`,
      `<h3>${htmlEscape(day.title)}</h3>`,
      '</div>',
      '</div>',
      `<div class="metric-row today-stats">${chipMarkup(day)}</div>`,
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
      `<p class="today-note">${htmlEscape(day.ridePlan || day.note || "Keep the day simple and ride within the plan.")}</p>`,
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
    target.innerHTML = [
      '<div class="metric-row itinerary-summary">',
      `<div class="metric"><span>Days</span><b>${days.length}</b></div>`,
      `<div class="metric"><span>Planned km</span><b>${totalKm} km</b></div>`,
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
        `<a class="mini-link" href="#${htmlEscape(day.id)}" data-select-day="${index}">Card</a>`,
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
    const fuelStopCount = day.fuelStops.length;
    target.innerHTML = [
      `<div class="app-day-kicker">${htmlEscape(day.label)} / ${htmlEscape(day.title)}</div>`,
      `<div class="fuel-hero"><strong>${htmlEscape(fuelWindows(day))}</strong><span>Scrambler safety range</span></div>`,
      '<div class="metric-row fuel-metrics">',
      `<div class="metric"><span>Distance</span><b>${htmlEscape(day.distance || "-")}</b></div>`,
      `<div class="metric"><span>Named stops</span><b>${fuelStopCount}</b></div>`,
      `<div class="metric"><span>Rule</span><b>180-200 km</b></div>`,
      '</div>',
      `<div class="mini-block full"><span>Plan</span><p>${htmlEscape(day.fuel || "Fuel before 180-200 km and never arrive at camp on reserve.")}</p></div>`,
      `<div class="mini-block full"><span>Stops</span>${listMarkup(day.fuelStops, "No named fuel stop in the card. Add one before riding this day.")}</div>`,
      '<div class="nearby-fuel-panel">',
      '<div class="nearby-head"><span>Fuel map</span></div>',
      '<div id="nearby-fuel-list" class="nearby-list"></div>',
      '</div>',
      actionPanel(day, { compact: true, includeCamping: false })
    ].join("");
    renderFuelShortcut();
  }

  function renderCalendar() {
    const target = document.getElementById("calendar-card");
    if (!target || !days.length) return;
    target.innerHTML = [
      '<div class="calendar-list">',
      days.map((day, index) => [
        `<article class="calendar-row${index === currentDay ? " is-current" : ""}">`,
        '<div class="calendar-date">',
        `<strong>${htmlEscape(dayDate(day))}</strong>`,
        `<span>${htmlEscape(day.label)}</span>`,
        '</div>',
        '<div class="calendar-main">',
        `<h3>${htmlEscape(day.title)}</h3>`,
        `<p>${htmlEscape(day.night || dayRegion(day))}</p>`,
        '</div>',
        '<div class="calendar-actions">',
        `<button class="mini-link button-link" type="button" data-select-day="${index}" data-go="today">Today</button>`,
        `<a class="mini-link" href="#${htmlEscape(day.id)}" data-select-day="${index}">Card</a>`,
        '</div>',
        '</article>'
      ].join("")).join(""),
      '</div>'
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

  function buildBottomNav() {
    const nav = document.createElement("nav");
    nav.className = "bottom-glass-nav";
    nav.setAttribute("aria-label", "Main app navigation");
    nav.innerHTML = [
      `<a href="#today" data-tab="today">${icon("target")}<span>Today</span></a>`,
      `<a href="#itinerary" data-tab="itinerary">${icon("route")}<span>Route</span></a>`,
      `<a href="#fuel" data-tab="fuel">${icon("fuel")}<span>Fuel</span></a>`,
      `<a href="#calendar" data-tab="calendar">${icon("calendar")}<span>Dates</span></a>`,
      `<a href="#settings" data-tab="settings">${icon("settings")}<span>Setup</span></a>`
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
    document.body.dataset.showDayCards = String(hash === "days" || hashDayIndex >= 0);
    document.body.dataset.showGpx = String(hash === "gpx");
    document.querySelectorAll("[data-tab]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.tab === active);
    });
    if (hashDayIndex >= 0) {
      window.requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
