# Ducati Alps Road Book PWA

This repository is set up to publish a mobile-first Progressive Web App from the `docs/` folder.

User app URL, not the GitHub source-code page:

`https://aureliendm.github.io/motorbike_trips/`

Do not install from `https://github.com/AurelienDM/motorbike_trips` on iPhone. That is the repository page, so Add to Home Screen will install GitHub instead of the road book app.

## GitHub Pages setup

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Branch: `main`. Folder: `/docs`.
4. Save.

Your app should become available at:

`https://aureliendm.github.io/motorbike_trips/`

## iPhone install

First make sure GitHub Pages is enabled for **main** / **docs** and that this URL loads:

`https://aureliendm.github.io/motorbike_trips/`

Then open that HTTPS URL in **Safari on the iPhone**, tap **Share**, scroll the action list if needed, then tap **Add to Home Screen**.

Do not install from the local preview URL such as `http://127.0.0.1:8765/`. On an iPhone, `127.0.0.1` points to the phone itself, and HTTP previews do not give the full offline PWA behavior.

## Files

- `docs/index.html` — the mobile-first road book
- `docs/app.css` — mobile and Ride Mode styling
- `docs/app.js` — Ride Mode and GPX import enhancements
- `docs/manifest.webmanifest` — PWA app metadata
- `docs/service-worker.js` — offline caching
- `docs/icons/` — Home Screen icons
- `docs/gpx/` — daily and full-trip GPX routepoint files
- `docs/data/` — route CSV and iPhone GPX notes

## Trip design

- Motorcycle-first day lengths, with the long riding days kept around the 5h50-6h00 ceiling.
- Ducati Scrambler fuel discipline: plan a stop every 180-200 km instead of relying on theoretical range.
- Offline schematic maps are built into the page; Google Maps links are optional launch buttons, not page dependencies.
- GPX files are routepoints, not fake straight-line tracks, so OsmAnd/Kurviger/Calimoto/Garmin can calculate roads.
