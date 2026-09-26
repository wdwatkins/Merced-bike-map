#!/usr/bin/env node
// Add (or replace) a route in data/routes.geojson from a GPX or GeoJSON file,
// e.g. one exported from Ride with GPS, Strava, Komoot, or brouter-web.
//
// Usage:
//   node scripts/add-route.js <file.gpx|file.geojson> --category lane --name "G Street" [options]
//
// Options:
//   --category <id>   required; must match an id in data/routes.config.json
//   --name <text>     required; shown in the popup
//   --id <slug>       defaults to a slug of the name; an existing route with this id is replaced
//   --surface <text>  e.g. paved, gravel
//   --notes <text>    free text shown in the popup
//   --url <https://>  "More info" link
//   --tolerance <m>   simplification tolerance in meters (default 3; 0 disables)

const fs = require('fs');
const path = require('path');
const { CONFIG_PATH, ROUTES_PATH, readJson, writeFeatureCollection } = require('./lib');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) fail(`Missing value for --${key}`);
      args[key] = val;
      i++;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// Returns an array of lines (each an array of [lon, lat]).
function readGpx(text) {
  const lines = [];
  // Each <trkseg> or <rte> becomes its own line.
  const blocks = text.match(/<trkseg[\s\S]*?<\/trkseg>|<rte[\s>][\s\S]*?<\/rte>/g) || [];
  for (const block of blocks) {
    const pts = [];
    const re = /<(?:trkpt|rtept)\b([^>]*)>/g;
    let m;
    while ((m = re.exec(block))) {
      const lat = /\blat\s*=\s*["']([-\d.]+)["']/.exec(m[1]);
      const lon = /\blon\s*=\s*["']([-\d.]+)["']/.exec(m[1]);
      if (lat && lon) pts.push([parseFloat(lon[1]), parseFloat(lat[1])]);
    }
    if (pts.length >= 2) lines.push(pts);
  }
  return lines;
}

function readGeoJson(obj) {
  const lines = [];
  const visit = (g) => {
    if (!g) return;
    if (g.type === 'FeatureCollection') g.features.forEach((f) => visit(f.geometry));
    else if (g.type === 'Feature') visit(g.geometry);
    else if (g.type === 'LineString') lines.push(g.coordinates.map((c) => [c[0], c[1]]));
    else if (g.type === 'MultiLineString') g.coordinates.forEach((l) => lines.push(l.map((c) => [c[0], c[1]])));
  };
  visit(obj);
  return lines;
}

// Douglas–Peucker simplification using a local equirectangular projection (meters).
function simplify(points, toleranceM) {
  if (toleranceM <= 0 || points.length < 3) return points;
  const lat0 = (points[0][1] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0);
  const ky = 110540;
  const xy = points.map(([lon, lat]) => [lon * kx, lat * ky]);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(xy[i], xy[s], xy[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function segDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args._[0];
  if (!file) fail('Provide an input file. See the usage notes at the top of scripts/add-route.js.');
  if (!args.category) fail('--category is required');
  if (!args.name) fail('--name is required');

  const config = readJson(CONFIG_PATH);
  const ids = config.categories.map((c) => c.id);
  if (!ids.includes(args.category)) {
    fail(`Unknown category "${args.category}". Known categories: ${ids.join(', ')}`);
  }

  const text = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  let lines;
  if (ext === '.gpx') lines = readGpx(text);
  else if (ext === '.geojson' || ext === '.json') lines = readGeoJson(JSON.parse(text));
  else fail(`Unsupported file type "${ext}". Export GPX (or GeoJSON) instead.`);
  if (!lines.length) fail('No track or route lines found in the file.');

  const tolerance = args.tolerance !== undefined ? Number(args.tolerance) : 3;
  const before = lines.reduce((n, l) => n + l.length, 0);
  lines = lines
    .map((l) => simplify(l, tolerance).map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]))
    .filter((l) => l.length >= 2);
  const after = lines.reduce((n, l) => n + l.length, 0);

  const id = args.id || slugify(args.name);
  const properties = { id, name: args.name, category: args.category };
  for (const key of ['surface', 'notes', 'url']) if (args[key]) properties[key] = args[key];

  const feature = {
    type: 'Feature',
    properties,
    geometry: lines.length === 1
      ? { type: 'LineString', coordinates: lines[0] }
      : { type: 'MultiLineString', coordinates: lines },
  };

  const routes = readJson(ROUTES_PATH);
  const existing = routes.features.findIndex((f) => f.properties && f.properties.id === id);
  if (existing >= 0) routes.features[existing] = feature;
  else routes.features.push(feature);
  writeFeatureCollection(ROUTES_PATH, routes);

  console.log(`${existing >= 0 ? 'Replaced' : 'Added'} route "${args.name}" (id: ${id}, category: ${args.category})`);
  console.log(`${lines.length} line(s), ${before} points simplified to ${after}`);
}

main();
