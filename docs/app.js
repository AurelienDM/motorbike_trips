(function () {
  "use strict";

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const cards = Array.from(document.querySelectorAll(".card[id^='day']"));
  const THEME_KEY = "roadbookThemeMode";
  const DAY_KEY = "roadbookActiveDay";

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

  function parseKm(value) {
    const match = clean(value).match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function dayData(card, index) {
    const stops = cardStops(card);
    const stats = cardStats(card);
    const distance = statValue(stats, "Distance");
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
      google: card.querySelector(".btn.blue[href^='https://www.google.com/maps']")?.getAttribute("href") || "",
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
      trip: '<path d="M4 17.5 13.5 4l6.5 13.5-6.5-3-9.5 3Z"/><path d="M13.5 4v10.5"/>',
      fuel: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h7A1.5 1.5 0 0 1 16 4.5V21"/><path d="M5 21h12"/><path d="M8 7h5"/><path d="M16 8h1.4L20 10.6V17a2 2 0 0 1-4 0v-2"/>',
      settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 0 1-2.97 2.97l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.1 2.1 0 0 1-4.2 0v-.06a1.8 1.8 0 0 0-1.1-1.66 1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 0 1-2.97-2.97l.04-.04A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.66-1.1H3a2.1 2.1 0 0 1 0-4.2h.06A1.8 1.8 0 0 0 4.72 8.6a1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.1 2.1 0 0 1 2.97-2.97l.04.04A1.8 1.8 0 0 0 9.3 4a1.8 1.8 0 0 0 1.1-1.66V2.3a2.1 2.1 0 0 1 4.2 0v.06A1.8 1.8 0 0 0 15.7 4a1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 0 1 2.97 2.97l-.04.04A1.8 1.8 0 0 0 19.28 8.6a1.8 1.8 0 0 0 1.66 1.1H21a2.1 2.1 0 0 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15Z"/>',
      map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
      sun: '<path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
      moon: '<path d="M21 14.2A7.8 7.8 0 0 1 9.8 3a8 8 0 1 0 11.2 11.2Z"/>',
      awake: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>'
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
    renderTrip();
    renderFuel();
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

  function appActions(day, compact = false) {
    const actions = [];
    if (day.google) {
      actions.push(`<a class="action primary" href="${htmlEscape(day.google)}" target="_blank" rel="noopener">${icon("map")}<span>Maps</span></a>`);
    }
    if (day.gpx) {
      actions.push(`<a class="action" href="${htmlEscape(day.gpx)}" target="_blank" rel="noopener">${icon("trip")}<span>OsmAnd</span></a>`);
      actions.push(`<a class="action" href="${htmlEscape(day.gpx)}" download>${icon("file")}<span>GPX</span></a>`);
    }
    if (!compact && day.camp) {
      actions.push(`<a class="action" href="${htmlEscape(day.camp)}" target="_blank" rel="noopener"><span class="action-letter">C</span><span>Camp</span></a>`);
    }
    return actions.join("");
  }

  function fuelWindows(day) {
    if (!day.distanceKm) return "Use the 180-200 km rhythm.";
    const windows = Math.max(1, Math.ceil(day.distanceKm / 190));
    return `${windows} fuel window${windows > 1 ? "s" : ""} for ${day.distanceKm} km`;
  }

  function buildAppShell() {
    if (!days.length || document.querySelector(".bottom-glass-nav")) return;

    document.body.classList.add("app-shell-ready");
    removeInstallSurface();
    tuneStaticCopy();
    buildTripPanel();
    buildFuelPanel();
    buildSettingsPanel();
    buildBottomNav();
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
    if (heroText) heroText.textContent = "Ducati route, fuel rhythm, camps and GPX. Pick a day and ride light.";
    if (heroPills) {
      heroPills.innerHTML = [
        '<a class="pill primary" href="#trip">Trip</a>',
        '<a class="pill" href="#fuel">Fuel</a>',
        '<a class="pill" href="#days">Days</a>'
      ].join("");
    }
    if (dayHeading) dayHeading.textContent = "All days";
  }

  function buildTripPanel() {
    const section = document.createElement("section");
    section.id = "trip";
    section.className = "panel app-panel trip-panel";
    section.innerHTML = [
      '<div class="app-panel-head">',
      '<div><span class="eyebrow">Trip</span><h2>Today on the bike</h2></div>',
      `<select class="app-select" data-day-select aria-label="Choose day">${dayOptions()}</select>`,
      '</div>',
      '<div id="trip-card" class="app-card"></div>'
    ].join("");

    const overview = document.querySelector("main > .panel.grid");
    (overview || document.getElementById("days")).before(section);
  }

  function buildFuelPanel() {
    const section = document.createElement("section");
    section.id = "fuel";
    section.className = "panel app-panel fuel-panel";
    section.innerHTML = [
      '<div class="app-panel-head">',
      '<div><span class="eyebrow">Fuel</span><h2>180-200 km rhythm</h2></div>',
      `<select class="app-select" data-day-select aria-label="Choose fuel day">${dayOptions()}</select>`,
      '</div>',
      '<div id="fuel-card" class="app-card"></div>'
    ].join("");

    document.getElementById("days").before(section);
  }

  function buildSettingsPanel() {
    const section = document.createElement("section");
    section.id = "settings";
    section.className = "panel app-panel settings-panel";
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

  function renderTrip() {
    const target = document.getElementById("trip-card");
    if (!target || !days.length) return;
    const day = days[currentDay];
    target.innerHTML = [
      `<div class="app-day-kicker">${htmlEscape(day.label)} / ${htmlEscape(day.meta)}</div>`,
      `<h3>${htmlEscape(day.title)}</h3>`,
      `<div class="metric-row">${chipMarkup(day)}</div>`,
      `<p class="lead">${htmlEscape(day.ridePlan || day.note || "Keep the day simple and ride within the plan.")}</p>`,
      '<div class="action-grid">',
      appActions(day),
      '</div>',
      '<div class="mini-grid">',
      `<div class="mini-block"><span>Fuel</span><p>${htmlEscape(day.fuel || "Top up before 180-200 km.")}</p></div>`,
      `<div class="mini-block"><span>Break</span><p>${htmlEscape(day.food || "Use the listed quiet stop.")}</p></div>`,
      `<div class="mini-block"><span>Night</span><p>${htmlEscape(day.night || "See day card.")}</p></div>`,
      '</div>',
      '<div class="pager">',
      `<button class="btn" type="button" data-prev-day${currentDay === 0 ? " disabled" : ""}>Previous</button>`,
      '<button class="btn blue" type="button" data-open-day>Open Day Card</button>',
      `<button class="btn" type="button" data-next-day${currentDay === days.length - 1 ? " disabled" : ""}>Next</button>`,
      '</div>'
    ].join("");
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
      '<div class="action-grid compact">',
      appActions(day, true),
      '</div>'
    ].join("");
  }

  function buildBottomNav() {
    const nav = document.createElement("nav");
    nav.className = "bottom-glass-nav";
    nav.setAttribute("aria-label", "Main app navigation");
    nav.innerHTML = [
      `<a href="#trip" data-tab="trip">${icon("trip")}<span>Trip</span></a>`,
      `<a href="#fuel" data-tab="fuel">${icon("fuel")}<span>Fuel</span></a>`,
      `<a href="#settings" data-tab="settings">${icon("settings")}<span>Settings</span></a>`
    ].join("");
    document.body.appendChild(nav);
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

      if (event.target.closest("[data-prev-day]")) setCurrentDay(currentDay - 1);
      if (event.target.closest("[data-next-day]")) setCurrentDay(currentDay + 1);
      if (event.target.closest("[data-open-day]")) setCurrentDay(currentDay, { scrollCard: true });

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
    const active = hash === "fuel" ? "fuel" : hash === "settings" ? "settings" : "trip";
    document.querySelectorAll("[data-tab]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.tab === active);
    });
  }

  function addOsmAndButtons() {
    document.querySelectorAll("a[download][href$='.gpx']").forEach((link) => {
      if (link.dataset.osmandEnhanced === "true") return;
      const gpxHref = link.getAttribute("href");
      const osmand = document.createElement("a");
      osmand.className = "btn osmand";
      osmand.href = gpxHref;
      osmand.target = "_blank";
      osmand.rel = "noopener";
      osmand.textContent = "OsmAnd GPX";
      osmand.title = "Open the local GPX file, then share or open it in OsmAnd.";
      link.textContent = "Download GPX";
      link.dataset.osmandEnhanced = "true";
      link.parentNode.insertBefore(osmand, link);
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

  addOsmAndButtons();
  addFullGpxButtons();
  buildAppShell();
}());
