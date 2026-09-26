# Merced Bike Map — Design Spec

An interactive web map of bike routes in the City of Merced, CA, modeled on the
BikePGH Pittsburgh bike map: a clean basemap, bike facilities color‑coded by
type, a legend, and points of interest (bike shops, parking, repair stations).

The key requirement: **you define route categories and their colors**, and every
route line on the map picks up its style from those definitions.

---

## 1. Goals and non-goals

**Goals (v1)**
- Pan/zoom map of Merced, centered on downtown, covering the city limits and UC Merced.
- Route lines styled by category (e.g. off-street path, protected lane, bike lane,
  bike route/sharrow, "use caution") using colors you choose.
- A legend generated from the same color definitions, with toggles to show/hide each category.
- Click/tap a route for a popup: name, category, surface, notes.
- Points of interest layer: bike shops, bike parking, repair stations, water.
- Works well on phones (most people will look at it while riding or planning a ride).
- Free to host, no server to maintain.

**Nice to have (later)**
- "Locate me" button (browser geolocation).
- Search for an address.
- Printable/PDF version of the map.
- Elevation hints (less important than in Pittsburgh — Merced is flat).
- Hazard / construction notices layer.
- Feedback link ("report a problem with this route").

**Non-goals (v1)**
- Turn-by-turn routing / directions.
- User accounts or user-submitted edits in the app.

---

## 2. What the BikePGH map does that we're copying

| BikePGH feature | Merced equivalent |
|---|---|
| Color-coded facility types (trails, bike lanes, sharrows, "cautionary" streets) | Your category list in `routes.config.json` (see §5) |
| Muted basemap so bike lines stand out | Light/grey vector basemap |
| Legend with line samples | Legend auto-built from config |
| Bike shops and other POIs | `pois.geojson` layer with icons |
| Clickable features with details | Popups from feature properties |
| Printed map | Optional later: export view at high resolution |

---

## 3. Recommended tools

### Front end (the map itself)
- **[MapLibre GL JS](https://maplibre.org/)** — free, open-source vector map library.
  Supports *data-driven styling*, so line color/width/dash can come straight from a
  lookup table keyed on each route's category. Smooth on mobile.
  - Alternative: **Leaflet** — simpler, huge plugin ecosystem, raster tiles. Fine if you
    prefer simplicity; styling per-category is still easy. MapLibre is recommended for the
    crisper look BikePGH-style maps have.
- **Plain HTML + JavaScript** (no framework needed for v1). One `index.html`, one `app.js`,
  one `style.css`. Add Vite later only if the app grows.

### Basemap
- **[OpenFreeMap](https://openfreemap.org/)** "positron" or "bright" style — free vector
  tiles, no API key. Good muted look.
- Alternatives: **Protomaps** (self-host a single `.pmtiles` file of the Merced area — fully
  offline-capable and free), or **MapTiler / Stadia** (free tiers, need an API key).

### Authoring route geometry (drawing the lines)
Drawing lines freehand gives wobbly routes that don't follow streets. Better options:
1. **[brouter-web](https://brouter.de/brouter-web/)** — click start/end/waypoints and it
   snaps the line to real streets and paths from OpenStreetMap. Export as GeoJSON or GPX.
   **Best choice for tracing each route.**
2. **[geojson.io](https://geojson.io)** — quick editing of properties (name, category) and
   small fixes; also good for placing POIs.
3. **[QGIS](https://qgis.org/)** (free desktop GIS) — best if you'll import City/County GIS
   data, clip it, clean it, and bulk-edit attributes.
4. **Overpass Turbo** (overpass-turbo.eu) — pull existing bike infrastructure already
   mapped in OpenStreetMap for Merced as a starting point (queries in §6).

### Hosting
- **GitHub Pages** from this repo — free, deploys on push. Custom domain optional.
- Alternatives: Netlify / Cloudflare Pages (same idea).

### Helpful dev tools
- `npx serve` or `python3 -m http.server` for local preview.
- A small Node validation script (optional, see §8) run in GitHub Actions to catch
  routes with a missing/unknown category before they're published.

---

## 4. Architecture

```
┌──────────────────────── Browser ────────────────────────┐
│  index.html                                             │
│   └─ app.js                                             │
│       ├─ loads routes.config.json  (categories + colors)│
│       ├─ loads routes.geojson      (line geometry)      │
│       ├─ loads pois.geojson        (points)             │
│       ├─ builds MapLibre style expressions from config  │
│       ├─ builds legend + toggles from config            │
│       └─ popups on click                                │
│  Basemap tiles ← OpenFreeMap (or local .pmtiles)        │
└─────────────────────────────────────────────────────────┘
          All files static, served by GitHub Pages
```

Proposed repo layout:

```
/
├─ index.html
├─ src/
│  ├─ app.js
│  └─ style.css
├─ data/
│  ├─ routes.config.json   ← YOU edit: categories, colors, line styles
│  ├─ routes.geojson       ← YOU edit: the route lines
│  └─ pois.geojson         ← YOU edit: shops, parking, repair stations
├─ icons/                  ← POI icons (SVG)
├─ scripts/
│  └─ validate.js          ← optional data checker
└─ docs/SPEC.md
```

---

## 5. Defining routes and colors (the core input)

Colors live in **one config file**; route lines only reference a category ID.
Change a color once and every route in that category updates, along with the legend.

### `data/routes.config.json`

```json
{
  "map": {
    "title": "Merced Bike Map",
    "center": [-120.4830, 37.3022],
    "zoom": 13,
    "bounds": [[-120.56, 37.25], [-120.39, 37.39]]
  },
  "categories": [
    {
      "id": "trail",
      "label": "Off-street path / creek trail",
      "color": "#1b7837",
      "width": 5,
      "dash": null,
      "order": 1
    },
    {
      "id": "protected",
      "label": "Protected / buffered bike lane",
      "color": "#2166ac",
      "width": 4,
      "dash": null,
      "order": 2
    },
    {
      "id": "lane",
      "label": "Painted bike lane",
      "color": "#4393c3",
      "width": 3,
      "dash": null,
      "order": 3
    },
    {
      "id": "route",
      "label": "Signed bike route / sharrows",
      "color": "#9970ab",
      "width": 3,
      "dash": [2, 1.5],
      "order": 4
    },
    {
      "id": "caution",
      "label": "Use caution — busy, no facility",
      "color": "#d6604d",
      "width": 3,
      "dash": [1, 1],
      "order": 5
    },
    {
      "id": "planned",
      "label": "Planned / proposed",
      "color": "#999999",
      "width": 2,
      "dash": [3, 2],
      "order": 6,
      "visibleByDefault": false
    }
  ]
}
```

Fields:
| Field | Meaning |
|---|---|
| `id` | Short key used by route features. Never shown to users. |
| `label` | Text shown in the legend. |
| `color` | Any CSS hex color. |
| `width` | Line width in pixels at the default zoom (scaled up/down with zoom). |
| `dash` | `null` for solid, or a dash pattern like `[2, 1.5]` (dash, gap in line-widths). |
| `order` | Legend order and draw order (higher numbers drawn underneath). |
| `visibleByDefault` | Optional; `false` hides the category until toggled on. |

> **Colors that can't collide with the basemap:** avoid pure greys and the basemap's water
> blue/park green shades. Check the palette with a color-blindness simulator
> (e.g. Coblis) — don't rely on red vs. green alone; the dash patterns help here.

### Want each *named route* to have its own color instead?
Some maps color by route ("Bear Creek Loop" = orange, "UC Merced Connector" = teal) rather
than by facility type. The same design supports that: add an optional `color` property on
an individual feature. The map uses **feature color if present, otherwise the category
color**. Decide which model you want as the primary one (see §10 questions).

### `data/routes.geojson` — one Feature per segment

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "bear-creek-01",
        "name": "Bear Creek Bike Path",
        "category": "trail",
        "surface": "paved",
        "notes": "Runs along Bear Creek; lighting varies.",
        "color": null
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-120.4950, 37.3050], [-120.4800, 37.3070]]
      }
    }
  ]
}
```

Required properties: `id`, `name`, `category` (must match a config `id`).
Optional: `surface`, `notes`, `color` (override), `url` (link for more info),
`status` (`existing` / `planned`).

**Segment rule:** a route that changes facility type partway (e.g. trail → bike lane) is
split into separate features, one per category. Features can share the same `name`.

### `data/pois.geojson`

Point features with `type` in: `shop`, `parking`, `repair`, `water`, `restroom`,
`transit` (bike-friendly bus stop / Amtrak / Merced transit center), plus `name`,
`address`, `hours`, `url`.

---

## 6. Inputs you'll need to gather

### 6.1 Route data (the big one)
Candidate sources, best first — verify currency of each:
1. **City of Merced GIS / Engineering** — ask for bikeway shapefiles or a feature service
   (the City maintains GIS data and publishes maps on its site). Ask Public Works /
   Engineering or the GIS coordinator directly if it's not on the public portal.
2. **Merced County Association of Governments (MCAG)** — regional Active Transportation
   Plan / bicycle plan layers, including existing vs. proposed facilities.
3. **City of Merced bicycle / active transportation master plan** (PDF maps) — use to check
   categories and identify planned facilities.
4. **OpenStreetMap** — often already has the creek trails (Bear Creek, Black Rascal Creek,
   Cottonwood Creek, Fahrens Park area) and some bike lanes. Starting query for
   overpass-turbo.eu:
   ```
   [out:json][timeout:60];
   {{geocodeArea:Merced, California}}->.a;
   (
     way["highway"="cycleway"](area.a);
     way["cycleway"~"lane|track|shared_lane"](area.a);
     way["cycleway:left"~"lane|track|shared_lane"](area.a);
     way["cycleway:right"~"lane|track|shared_lane"](area.a);
     way["cycleway:both"~"lane|track|shared_lane"](area.a);
     way["bicycle"="designated"](area.a);
   );
   out geom;
   ```
   Export → GeoJSON, then assign `category` values in QGIS or geojson.io.
5. **Local knowledge / ground truth** — ride or Street View the network. Official data
   often misses the "use caution" judgment calls that make BikePGH's map useful; that
   layer is yours to define.

**License check:** OSM data is ODbL — fine to use with attribution
("© OpenStreetMap contributors"). Confirm terms for any City/MCAG data you import.

### 6.2 Your decisions
- Final category list, labels, and **hex colors** (fill in `routes.config.json`).
- Coloring model: by facility type, by named route, or both (feature override).
- Criteria for the "use caution" category (e.g. arterials with ≥ 35 mph and no bike lane).
- Map extent: city limits only, or include UC Merced, Atwater, Lake Yosemite?
- Whether to show planned facilities.

### 6.3 Points of interest
- Bike shops (name, address, hours, website).
- Bike parking and repair stations (UC Merced, downtown, Merced College, transit center).
- Water / restrooms along trails (parks).

### 6.4 Branding / content
- Map title, logo (if any), about text, contact / "report a problem" link or email.
- Disclaimer text ("Conditions change; ride at your own risk").

---

## 7. UI spec

**Desktop:** full-screen map, collapsible side panel on the left containing title,
legend (with checkbox toggle per category), POI toggles, and an "About" link.

**Mobile:** full-screen map; a floating "Legend" button opens a bottom sheet with the same
content. Popups are compact and dismissable.

**Map behavior**
- Initial view: `map.center` / `map.zoom` from config; pan limited to `map.bounds`.
- Line widths scale with zoom (thin when zoomed out, thicker zoomed in).
- Each route line drawn with a thin white casing underneath so it reads clearly over the
  basemap (the BikePGH look).
- Hover (desktop) highlights a segment; click opens popup: **name**, category label with
  color swatch, surface, notes, link.
- POIs appear at zoom ≥ 14 to avoid clutter; icons per `type`.
- Controls: zoom +/−, locate-me, fullscreen, scale bar. Attribution for basemap + OSM.

**Accessibility**
- Legend keyboard-navigable; toggles are real `<input type="checkbox">`.
- Categories distinguished by dash pattern as well as color.
- Contrast ≥ 3:1 between each line color and the basemap.

---

## 8. Implementation notes

How colors from config drive the map (MapLibre):

```js
const cfg = await (await fetch('data/routes.config.json')).json();

// ["match", ["get","category"], "trail", "#1b7837", "lane", "#4393c3", ..., "#888"]
const colorByCategory = ['match', ['get', 'category'],
  ...cfg.categories.flatMap(c => [c.id, c.color]), '#888888'];

// Feature-level override, falling back to the category color
const lineColor = ['coalesce', ['get', 'color'], colorByCategory];
```

MapLibre can't vary `line-dasharray` per feature via expressions reliably, so create
**one line layer per category** (filtered on `category`), each with its own color, width,
and dash from config. That also makes legend toggles trivial: toggling a category sets
its layer's `visibility`.

**Validation script (optional, `scripts/validate.js`)**, run locally and in CI:
- every feature has `id`, `name`, `category`;
- every `category` exists in the config;
- `id`s are unique;
- colors are valid hex;
- geometries are LineString/MultiLineString inside `map.bounds`.

---

## 9. Milestones

1. **Skeleton** — `index.html` with MapLibre + OpenFreeMap basemap centered on Merced; deploy
   to GitHub Pages.
2. **Config-driven routes** — load `routes.config.json` + a few hand-drawn test routes;
   per-category layers; auto legend with toggles; popups.
3. **Real data** — import OSM / City / MCAG data, assign categories, trace missing routes in
   brouter-web, add "use caution" segments.
4. **POIs** — shops, parking, repair stations with icons.
5. **Polish** — mobile bottom sheet, locate-me, about panel, attribution, accessibility pass.
6. **Later** — search, print export, planned-facilities layer, feedback form.

---

## 10. Open questions for you

1. Color by **facility type**, by **named route**, or type with per-route overrides?
2. What categories do you want (start from the six in §5, or your own list)?
3. Your preferred colors for each category?
4. Extent: City of Merced only, or include UC Merced / Lake Yosemite / Atwater?
5. Do you already have any route data (GIS files, KML from Google My Maps, GPX rides)?
   All of those can be converted to GeoJSON.
6. Custom domain, or is `<username>.github.io/merced-bike-map` fine?
