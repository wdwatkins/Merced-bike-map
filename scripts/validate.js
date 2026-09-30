#!/usr/bin/env node
// Check data files for mistakes before publishing. Exits non-zero on errors.
//   node scripts/validate.js

const { CONFIG_PATH, ROUTES_PATH, POIS_PATH, readJson } = require('./lib');

const errors = [];
const warnings = [];
const HEX = /^#[0-9a-fA-F]{6}$/;

let config, routes, pois;
try {
  config = readJson(CONFIG_PATH);
  routes = readJson(ROUTES_PATH);
  pois = readJson(POIS_PATH);
} catch (e) {
  console.error(`Could not read data files: ${e.message}`);
  process.exit(1);
}

// Config
const catIds = new Set();
for (const c of config.categories || []) {
  if (!c.id) errors.push('A category is missing "id"');
  if (catIds.has(c.id)) errors.push(`Duplicate category id "${c.id}"`);
  catIds.add(c.id);
  if (!c.label) errors.push(`Category "${c.id}" is missing "label"`);
  if (!HEX.test(c.color || '')) errors.push(`Category "${c.id}" color "${c.color}" is not a #rrggbb hex color`);
  if (!(c.width > 0)) errors.push(`Category "${c.id}" needs a positive "width"`);
  if (c.dash != null && !(Array.isArray(c.dash) && c.dash.length >= 2 && c.dash.every((n) => n > 0))) {
    errors.push(`Category "${c.id}" dash must be null or an array of positive numbers like [2, 1.5]`);
  }
  if (typeof c.order !== 'number') errors.push(`Category "${c.id}" needs a numeric "order"`);
}
const poiIds = new Set((config.poiTypes || []).map((t) => t.id));
for (const t of config.poiTypes || []) {
  if (!HEX.test(t.color || '')) errors.push(`POI type "${t.id}" color "${t.color}" is not a #rrggbb hex color`);
}

const [[minX, minY], [maxX, maxY]] = config.map.maxBounds;
const inBounds = ([x, y]) => x >= minX && x <= maxX && y >= minY && y <= maxY;

// Routes
const routeIds = new Set();
const usedCats = new Set();
routes.features.forEach((f, i) => {
  const p = f.properties || {};
  const where = p.id ? `route "${p.id}"` : `route #${i + 1}`;
  if (!p.id) errors.push(`${where} is missing "id"`);
  else if (routeIds.has(p.id)) errors.push(`Duplicate route id "${p.id}"`);
  routeIds.add(p.id);
  if (!catIds.has(p.category)) errors.push(`${where} has unknown category "${p.category}"`);
  usedCats.add(p.category);

  const g = f.geometry || {};
  let lines;
  if (g.type === 'LineString') lines = [g.coordinates];
  else if (g.type === 'MultiLineString') lines = g.coordinates;
  else { errors.push(`${where} geometry must be LineString or MultiLineString (got ${g.type})`); return; }
  if (lines.some((l) => !Array.isArray(l) || l.length < 2)) errors.push(`${where} has a line with fewer than 2 points`);
  const outside = lines.flat().filter((c) => !inBounds(c)).length;
  if (outside) warnings.push(`${where} has ${outside} point(s) outside map.maxBounds`);
});
for (const id of catIds) if (!usedCats.has(id)) warnings.push(`Category "${id}" has no routes yet`);

// POIs
pois.features.forEach((f, i) => {
  const p = f.properties || {};
  const where = p.name ? `POI "${p.name}"` : `POI #${i + 1}`;
  if (!p.name) errors.push(`${where} is missing "name"`);
  if (!poiIds.has(p.type)) errors.push(`${where} has unknown type "${p.type}"`);
  if (!f.geometry || f.geometry.type !== 'Point') errors.push(`${where} geometry must be a Point`);
  else if (!inBounds(f.geometry.coordinates)) warnings.push(`${where} is outside map.maxBounds`);
});

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(`${routes.features.length} routes, ${pois.features.length} POIs, ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
