# Merced Bike Map

An interactive map of bike routes in Merced, CA, with routes color-coded by type.
It's a static site (HTML + JavaScript + GeoJSON) with no build step, so it can be
hosted free on GitHub Pages. See [docs/SPEC.md](docs/SPEC.md) for the full design.

## Files you edit

| File | What it holds |
|---|---|
| `data/routes.config.json` | Map title and extent, **route categories and their colors**, POI types |
| `data/routes.geojson` | Route lines. Each has a `category` that picks its color. |
| `data/pois.geojson` | Bike shops, parking, repair stations, water |

## Change a category's color or style

Edit its entry in `data/routes.config.json`:

```json
{ "id": "lane", "label": "Bike lane", "color": "#2166ac", "width": 4, "dash": null, "order": 2 }
```

- `color`: any `#rrggbb` hex color
- `width`: line width in pixels at a mid-level zoom (it scales with zoom)
- `dash`: `null` for solid, or a pattern like `[2, 1.5]` (dash and gap, in line widths)
- `order`: position in the legend; lower numbers are drawn on top

The map and legend update automatically. If you rename a category `id`, update
the routes that use it too (`npm run validate` will list any you miss).

## Add a route from Ride with GPS (or any GPX file)

1. In Ride with GPS, plan the route with **snap to roads/paths** turned on.
   Draw one route per stretch of a single category. If a ride goes from path
   to bike lane, split it into two routes.
2. Export it as **GPX Track** (`.gpx`).
3. Run:

   ```sh
   node scripts/add-route.js ~/Downloads/g-street.gpx --category lane --name "G Street"
   ```

   Optional flags: `--surface paved`, `--notes "..."`, `--url https://...`,
   `--id g-street-north` (to keep two segments with the same name distinct).
   Running it again with the same id (by default, the name in lowercase with
   dashes) replaces that route, so you can fix a route by re-exporting it.
   GeoJSON files (from brouter-web or geojson.io) work too.
4. Check your work: `npm run validate`, then preview locally (below).

The importer simplifies tracks (default 3 m tolerance), which removes GPS jitter
and keeps the data file small.

Delete the four "Sample … (replace me)" routes and the sample shop once you've
added real ones.

## Preview locally

```sh
npm run serve        # or: python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly as a file won't
work, because browsers block loading the data files that way.

## Publish with GitHub Pages

In the repo on GitHub: **Settings → Pages → Build and deployment → Deploy from a
branch**, choose `main` and `/ (root)`. The map will be at
`https://<username>.github.io/merced-bike-map/`.

## Credits

Map library: [MapLibre GL JS](https://maplibre.org/). Basemap:
[OpenFreeMap](https://openfreemap.org/), © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
