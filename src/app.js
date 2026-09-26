// Merced Bike Map
// Route styling and the legend are both generated from data/routes.config.json.

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

(async function main() {
  const [config, routes, pois] = await Promise.all([
    fetchJson('data/routes.config.json'),
    fetchJson('data/routes.geojson'),
    fetchJson('data/pois.geojson'),
  ]);

  document.getElementById('map-title').textContent = config.map.title;
  document.title = config.map.title;

  const categories = [...config.categories].sort((a, b) => a.order - b.order);
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  const map = new maplibregl.Map({
    container: 'map',
    style: BASEMAP_STYLE,
    bounds: config.map.homeBounds,
    fitBoundsOptions: { padding: 20 },
    maxBounds: config.map.maxBounds,
    minZoom: 11,
    maxZoom: 18,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');
  map.addControl(new maplibregl.FullscreenControl(), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right');

  map.on('load', () => {
    map.addSource('routes', { type: 'geojson', data: routes, promoteId: 'id' });
    map.addSource('pois', { type: 'geojson', data: pois });

    // Draw lowest-priority categories first so higher-priority lines sit on top.
    const drawOrder = [...categories].reverse();

    // White casing under every route so lines read clearly over the basemap.
    for (const cat of drawOrder) {
      map.addLayer({
        id: `casing-${cat.id}`,
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'category'], cat.id],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': zoomWidth(cat.width + 3),
          'line-opacity': 0.9,
        },
      });
    }

    for (const cat of drawOrder) {
      const paint = {
        'line-color': cat.color,
        'line-width': zoomWidth(cat.width, 2),
      };
      if (cat.dash) paint['line-dasharray'] = cat.dash;

      map.addLayer({
        id: `route-${cat.id}`,
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'category'], cat.id],
        layout: { 'line-join': 'round', 'line-cap': cat.dash ? 'butt' : 'round' },
        paint,
      });
    }

    const poiTypes = config.poiTypes;
    map.addLayer({
      id: 'pois',
      type: 'circle',
      source: 'pois',
      minzoom: 13,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 17, 8],
        'circle-color': [
          'match', ['get', 'type'],
          ...poiTypes.flatMap((t) => [t.id, t.color]),
          '#555555',
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    });

    for (const cat of categories) {
      if (cat.visibleByDefault === false) setCategoryVisible(map, cat.id, false);
    }

    buildRouteLegend(map, categories);
    buildPoiLegend(map, poiTypes);
    wireInteractions(map, categories, categoryById, poiTypes);
  });

  wirePanel();
})().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<p style="position:absolute;top:50%;width:100%;text-align:center">Could not load the map: ${escapeHtml(err.message)}</p>`,
  );
});

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// Scale a line width (defined at zoom 14) up and down with zoom. If hoverBoost is
// given, hovered features get that many extra pixels. MapLibre requires the zoom
// interpolation to be the outermost expression, so the hover check goes inside each stop.
function zoomWidth(w, hoverBoost = 0) {
  const stop = (px) => (hoverBoost
    ? ['case', ['boolean', ['feature-state', 'hover'], false], px + hoverBoost, px]
    : px);
  return ['interpolate', ['exponential', 1.5], ['zoom'], 11, stop(w * 0.6), 14, stop(w), 18, stop(w * 3)];
}

function setCategoryVisible(map, id, visible) {
  const v = visible ? 'visible' : 'none';
  map.setLayoutProperty(`route-${id}`, 'visibility', v);
  map.setLayoutProperty(`casing-${id}`, 'visibility', v);
}

function lineSwatch(cat) {
  const dash = cat.dash ? `stroke-dasharray="${cat.dash.map((d) => d * cat.width).join(' ')}"` : '';
  return `<svg width="36" height="12" aria-hidden="true">
    <line x1="2" y1="6" x2="34" y2="6" stroke="#fff" stroke-width="${cat.width + 3}" stroke-linecap="round"/>
    <line x1="2" y1="6" x2="34" y2="6" stroke="${cat.color}" stroke-width="${cat.width}" ${dash}/>
  </svg>`;
}

function dotSwatch(color) {
  return `<svg width="36" height="12" aria-hidden="true">
    <circle cx="18" cy="6" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"/>
  </svg>`;
}

function buildRouteLegend(map, categories) {
  const ul = document.getElementById('legend');
  for (const cat of categories) {
    const li = document.createElement('li');
    li.innerHTML = `<label>
      <input type="checkbox" ${cat.visibleByDefault === false ? '' : 'checked'}>
      ${lineSwatch(cat)}
      <span>${escapeHtml(cat.label)}</span>
    </label>`;
    li.querySelector('input').addEventListener('change', (e) => {
      setCategoryVisible(map, cat.id, e.target.checked);
    });
    ul.appendChild(li);
  }
}

function buildPoiLegend(map, poiTypes) {
  const ul = document.getElementById('poi-legend');
  const hidden = new Set();
  const applyFilter = () => {
    map.setFilter('pois', hidden.size ? ['!', ['in', ['get', 'type'], ['literal', [...hidden]]]] : null);
  };
  for (const t of poiTypes) {
    const li = document.createElement('li');
    li.innerHTML = `<label>
      <input type="checkbox" checked>
      ${dotSwatch(t.color)}
      <span>${escapeHtml(t.label)}</span>
    </label>`;
    li.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) hidden.delete(t.id); else hidden.add(t.id);
      applyFilter();
    });
    ul.appendChild(li);
  }
}

function wireInteractions(map, categories, categoryById, poiTypes) {
  const routeLayers = categories.map((c) => `route-${c.id}`);
  let hoveredId = null;

  const clearHover = () => {
    if (hoveredId !== null) map.setFeatureState({ source: 'routes', id: hoveredId }, { hover: false });
    hoveredId = null;
  };

  map.on('mousemove', routeLayers, (e) => {
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features[0].id;
    if (id === hoveredId) return;
    clearHover();
    hoveredId = id;
    if (id !== undefined) map.setFeatureState({ source: 'routes', id }, { hover: true });
  });
  map.on('mouseleave', routeLayers, () => {
    map.getCanvas().style.cursor = '';
    clearHover();
  });

  map.on('click', (e) => {
    // Use a small box around the click so thin lines are easy to tap on phones.
    const pad = 8;
    const box = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
    const visibleLayers = [...routeLayers, 'pois'].filter(
      (id) => map.getLayoutProperty(id, 'visibility') !== 'none',
    );
    const [f] = map.queryRenderedFeatures(box, { layers: visibleLayers });
    if (!f) return;

    const html = f.layer.id === 'pois'
      ? poiPopup(f.properties, poiTypes)
      : routePopup(f.properties, categoryById);
    new maplibregl.Popup({ maxWidth: '280px' }).setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  map.on('mousemove', 'pois', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'pois', () => { map.getCanvas().style.cursor = ''; });
}

function routePopup(p, categoryById) {
  const cat = categoryById[p.category];
  return `<div class="popup">
    <p class="popup-title">${escapeHtml(p.name)}</p>
    ${cat ? `<div class="popup-cat"><span class="popup-swatch" style="background:${cat.color}"></span>${escapeHtml(cat.label)}</div>` : ''}
    ${p.surface ? `<p class="popup-row">Surface: ${escapeHtml(p.surface)}</p>` : ''}
    ${p.notes ? `<p class="popup-row">${escapeHtml(p.notes)}</p>` : ''}
    ${safeUrl(p.url) ? `<p class="popup-row"><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">More info</a></p>` : ''}
  </div>`;
}

function poiPopup(p, poiTypes) {
  const type = poiTypes.find((t) => t.id === p.type);
  return `<div class="popup">
    <p class="popup-title">${escapeHtml(p.name)}</p>
    ${type ? `<div class="popup-cat">${escapeHtml(type.label)}</div>` : ''}
    ${p.address ? `<p class="popup-row">${escapeHtml(p.address)}</p>` : ''}
    ${p.hours ? `<p class="popup-row">Hours: ${escapeHtml(p.hours)}</p>` : ''}
    ${p.notes ? `<p class="popup-row">${escapeHtml(p.notes)}</p>` : ''}
    ${safeUrl(p.url) ? `<p class="popup-row"><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Website</a></p>` : ''}
  </div>`;
}

function wirePanel() {
  const panel = document.getElementById('panel');
  const toggle = document.getElementById('panel-toggle');
  const setOpen = (open) => {
    panel.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.hidden = open;
  };
  // Start collapsed on phones so the map is visible.
  setOpen(!window.matchMedia('(max-width: 640px)').matches);
  toggle.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
  document.getElementById('panel-close').addEventListener('click', () => setOpen(false));
}

function safeUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
