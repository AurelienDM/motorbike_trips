(function () {
  "use strict";

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const cards = Array.from(document.querySelectorAll(".card[id^='day']"));

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

  function dayData(card, index) {
    const stops = cardStops(card);
    return {
      index,
      id: card.id,
      label: `Day ${String(index + 1).padStart(2, "0")}`,
      title: clean(card.querySelector("h2")?.textContent),
      meta: clean(card.querySelector(".card-header div[style*='font-weight']")?.textContent),
      stats: cardStats(card),
      google: card.querySelector(".btn.blue[href^='https://www.google.com/maps']")?.getAttribute("href") || "",
      camp: card.querySelector(".btn.green[href^='http']")?.getAttribute("href") || "",
      gpx: card.querySelector("a[download][href$='.gpx']")?.getAttribute("href") || "",
      fuel: sectionText(card, "Fuel"),
      food: sectionText(card, "Eat / nature stop"),
      night: sectionText(card, "Night"),
      note: sectionText(card, "Road book note"),
      fuelStops: stops.filter((stop) => /fuel/i.test(`${stop.name} ${stop.type}`)),
      breakStops: stops.filter((stop) => /break|coffee|nature/i.test(`${stop.name} ${stop.type}`)),
      campStops: stops.filter((stop) => /camp|night|home|friends/i.test(`${stop.name} ${stop.type}`))
    };
  }

  const days = cards.map(dayData);

  function addNavLinks() {
    document.querySelectorAll(".ridebar").forEach((bar) => {
      if (!bar.querySelector("[href='#ride']")) {
        const link = document.createElement("a");
        link.className = "daypill";
        link.href = "#ride";
        link.textContent = "Ride Mode";
        bar.insertBefore(link, bar.children[1] || null);
      }
    });

    const heroPills = document.querySelector(".hero .pillrow");
    if (heroPills && !heroPills.querySelector("[href='#ride']")) {
      const link = document.createElement("a");
      link.className = "pill primary";
      link.href = "#ride";
      link.textContent = "Ride Mode";
      heroPills.insertBefore(link, heroPills.firstChild);
    }
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

  function addInstallTroubleshooting() {
    const panel = document.getElementById("iphone");
    if (!panel || panel.querySelector(".install-troubleshooting")) return;

    const localPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const box = document.createElement("div");
    box.className = localPreview ? "warning install-troubleshooting" : "safe install-troubleshooting";
    box.innerHTML = [
      `<strong>${localPreview ? "Local preview detected:" : "Install checklist:"}</strong>`,
      '<div class="install-list">',
      "<p>Use Safari on the iPhone, not Chrome, GitHub preview, Google Drive, or an in-app browser.</p>",
      '<p>Open <span class="kbd">https://aureliendm.github.io/motorbike_trips/</span> directly in Safari.</p>',
      "<p>If that URL shows 404, enable GitHub Pages: Settings -> Pages -> Deploy from a branch -> main -> /docs, then wait a few minutes.</p>",
      "<p>Do not install this Mac preview URL. On an iPhone, 127.0.0.1 points to the phone itself, and HTTP previews do not give the full offline PWA behavior.</p>",
      "<p>In Safari, tap Share, scroll the action list if needed, then tap Add to Home Screen.</p>",
      "</div>"
    ].join("");

    panel.insertBefore(box, panel.children[1] || null);
  }

  function listMarkup(items, fallback) {
    if (!items.length) return `<p class="ride-muted">${htmlEscape(fallback)}</p>`;
    return `<ul class="ride-list">${items.slice(0, 4).map((item) => (
      `<li><strong>${htmlEscape(item.name)}</strong><span>${htmlEscape(item.type)}</span></li>`
    )).join("")}</ul>`;
  }

  function actionMarkup(day) {
    const google = day.google
      ? `<a class="btn blue" href="${htmlEscape(day.google)}" target="_blank" rel="noopener">Google Maps</a>`
      : "";
    const osmand = day.gpx
      ? `<a class="btn osmand" href="${htmlEscape(day.gpx)}" target="_blank" rel="noopener">OsmAnd GPX</a>`
      : "";
    const gpx = day.gpx
      ? `<a class="btn" href="${htmlEscape(day.gpx)}" download>Download GPX</a>`
      : "";
    const camp = day.camp
      ? `<a class="btn green" href="${htmlEscape(day.camp)}" target="_blank" rel="noopener">Camp info</a>`
      : "";
    return `${google}${osmand}${gpx}${camp}<a class="btn wide" href="#${htmlEscape(day.id)}">Open day card</a>`;
  }

  function chipMarkup(stats) {
    return stats.map((stat) => (
      `<div class="ride-chip"><span>${htmlEscape(stat.label)}</span><b>${htmlEscape(stat.value)}</b></div>`
    )).join("");
  }

  function buildRideMode() {
    if (!days.length || document.getElementById("ride")) return;

    const section = document.createElement("section");
    section.id = "ride";
    section.className = "panel ride-mode";
    section.innerHTML = [
      '<div class="ride-mode-head">',
      '<div><div class="section-title">Ride Mode</div><h2>Roadside controls</h2></div>',
      '<select id="ride-day-select" class="ride-select" aria-label="Choose riding day"></select>',
      '</div>',
      '<div id="ride-card" class="ride-card"></div>'
    ].join("");

    const target = document.getElementById("iphone") || document.getElementById("days");
    target.parentNode.insertBefore(section, target);

    const select = section.querySelector("#ride-day-select");
    days.forEach((day, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${day.label} - ${day.title}`;
      select.appendChild(option);
    });

    const saved = Number(window.localStorage.getItem("roadbookRideDay") || 0);
    let current = Number.isInteger(saved) && saved >= 0 && saved < days.length ? saved : 0;

    function render(index) {
      current = Math.max(0, Math.min(days.length - 1, index));
      window.localStorage.setItem("roadbookRideDay", String(current));
      select.value = String(current);

      const day = days[current];
      const prevDisabled = current === 0 ? " disabled" : "";
      const nextDisabled = current === days.length - 1 ? " disabled" : "";
      const gravelNote = day.note || "Easy gravel only. Skip anything wet, private, closed, rocky or tiring.";

      section.querySelector("#ride-card").innerHTML = [
        '<div class="ride-card-main">',
        `<h3 class="ride-title">${htmlEscape(day.label)} - ${htmlEscape(day.title)}</h3>`,
        `<div class="ride-meta">${htmlEscape(day.meta)}</div>`,
        `<div class="ride-chips">${chipMarkup(day.stats)}</div>`,
        '</div>',
        `<div class="ride-block"><h3>Fuel plan</h3><p>${htmlEscape(day.fuel || "Fuel before 180-200 km and never arrive at camp on reserve.")}</p></div>`,
        `<div class="ride-block"><h3>Fuel stops</h3>${listMarkup(day.fuelStops, "No named fuel stop in this day card.")}</div>`,
        `<div class="ride-block"><h3>Nature breaks</h3><p>${htmlEscape(day.food || "Use the listed coffee, lake or river stop for a quiet break.")}</p>${listMarkup(day.breakStops, "No named break stop in this day card.")}</div>`,
        `<div class="ride-block"><h3>Camp or night</h3><p>${htmlEscape(day.night || "Check the day card for tonight's base.")}</p>${listMarkup(day.campStops, "No named camp stop in this day card.")}</div>`,
        `<div class="ride-block"><h3>Easy gravel</h3><p>${htmlEscape(gravelNote)}</p></div>`,
        `<div class="ride-actions">${actionMarkup(day)}</div>`,
        '<div class="ride-nav">',
        `<button class="btn" type="button" data-ride-prev${prevDisabled}>Prev day</button>`,
        `<button class="btn" type="button" data-ride-next${nextDisabled}>Next day</button>`,
        '</div>'
      ].join("");
    }

    select.addEventListener("change", () => render(Number(select.value)));
    section.addEventListener("click", (event) => {
      if (event.target.matches("[data-ride-prev]")) render(current - 1);
      if (event.target.matches("[data-ride-next]")) render(current + 1);
    });

    render(current);
  }

  addNavLinks();
  addOsmAndButtons();
  addFullGpxButtons();
  addInstallTroubleshooting();
  buildRideMode();
}());
