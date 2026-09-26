// Shared helpers for the data scripts. No dependencies.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'data', 'routes.config.json');
const ROUTES_PATH = path.join(ROOT, 'data', 'routes.geojson');
const POIS_PATH = path.join(ROOT, 'data', 'pois.geojson');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// One feature per line keeps git diffs readable when routes are added or edited.
function writeFeatureCollection(p, fc) {
  const lines = fc.features.map((f) => '    ' + JSON.stringify(f));
  const body = `{\n  "type": "FeatureCollection",\n  "features": [\n${lines.join(',\n')}\n  ]\n}\n`;
  fs.writeFileSync(p, body);
}

module.exports = { ROOT, CONFIG_PATH, ROUTES_PATH, POIS_PATH, readJson, writeFeatureCollection };
