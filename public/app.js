(async function () {
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const demSource = new mlcontour.DemSource({
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    encoding: 'terrarium', maxzoom: 13, worker: true, cacheSize: 200, timeoutMs: 30000,
  });
  demSource.setupMaplibre(maplibregl);

  const region = await fetch('data/region.geojson').then(r => r.json());
  const pt = (props, coords) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coords } });
  const labels = { type: 'FeatureCollection', features: [
    pt({ k: 'sea', name: 'A T L A N T I C\nO C E A N', size: 20 }, [-72.3, 39.6]),
    pt({ k: 'sea', name: 'ATLANTIC OCEAN', size: 14 }, [-73.3, 40.45]),
    pt({ k: 'sea', name: 'New York Bight', size: 13 }, [-73.72, 40.2]),
    pt({ k: 'sea', name: 'Long Island Sound', size: 14 }, [-73.05, 41.08]),
    pt({ k: 'sea', name: 'Block Island Sound', size: 12 }, [-71.85, 41.2]),
    pt({ k: 'sea', name: 'Rhode Island Sound', size: 12 }, [-71.3, 41.33]),
    pt({ k: 'sea', name: 'Delaware Bay', size: 13 }, [-75.15, 39.08]),
    pt({ k: 'sea', name: 'Chesapeake Bay', size: 13 }, [-76.25, 38.9]),
    pt({ k: 'state', name: 'NEW YORK' }, [-74.9, 42.35]),
    pt({ k: 'state', name: 'PENNSYLVANIA' }, [-76.4, 40.75]),
    pt({ k: 'state', name: 'NEW JERSEY' }, [-74.55, 40.25]),
    pt({ k: 'state', name: 'CONNECTICUT' }, [-72.7, 41.62]),
    pt({ k: 'state', name: 'MASSACHUSETTS' }, [-72.3, 42.35]),
    pt({ k: 'state', name: 'RHODE ISLAND' }, [-71.55, 41.72]),
    pt({ k: 'state', name: 'VERMONT' }, [-72.8, 43.1]),
    pt({ k: 'state', name: 'NEW HAMPSHIRE' }, [-71.9, 43.0]),
    pt({ k: 'state', name: 'DELAWARE' }, [-75.5, 39.1]),
    pt({ k: 'state', name: 'MARYLAND' }, [-76.8, 39.45]),
  ] };

  // Where the big OSM basemap lives. Set window.ATLAS_CONFIG.osmTiles in config.js to an object-storage URL in production.
  const cfg = window.ATLAS_CONFIG || {};
  const common = { demUrl: demSource.sharedDemProtocolUrl, region, labels, osmTiles: cfg.osmTiles || 'data/osm.pmtiles' };
  const contourOpts = { contourLayer: 'contours', elevationKey: 'ele', levelKey: 'level', extent: 4096, buffer: 1 };
  const STYLES = {
    atlas: () => buildAtlasStyle(Object.assign({}, common, {
      contourUrl: demSource.contourProtocolUrl(Object.assign({ multiplier: 3.28084,
        thresholds: { 9: [500, 2500], 10: [400, 2000], 11: [200, 1000], 12: [100, 500], 13: [50, 250], 14: [40, 200], 15: [20, 100] } }, contourOpts)),
    })),
    swiss: () => buildSwissStyle(Object.assign({}, common, {
      contourUrl: demSource.contourProtocolUrl(Object.assign({ multiplier: 1,
        thresholds: { 11: [50, 250], 12: [20, 100], 13: [20, 100], 14: [10, 50], 15: [10, 50] } }, contourOpts)),
    })),
  };
  const qs = new URLSearchParams(location.search);
  const stored = (() => { try { return localStorage.getItem('atlasStyle'); } catch (e) { return null; } })();
  let styleName = STYLES[qs.get('style')] ? qs.get('style') : STYLES[stored] ? stored : 'atlas';

  const map = new maplibregl.Map({
    container: 'map', style: STYLES[styleName](), hash: true,
    center: [-74.1, 40.85], zoom: 8.3, minZoom: 5.5, maxZoom: 18.5,
    maxBounds: [[-82.0, 35.5], [-66.0, 46.0]],
    fadeDuration: 120, attributionControl: { compact: true },
  });
  window.map = map;
  map.on('style.load', () => installIcons(map));
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'top-right');
  const scale = new maplibregl.ScaleControl({ unit: styleName === 'swiss' ? 'metric' : 'imperial', maxWidth: 110 });
  map.addControl(scale, 'bottom-left');

  // coordinates readout
  const coords = document.getElementById('coords');
  const fmt = (v, p, n) => Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? p : n);
  map.on('mousemove', (e) => { coords.textContent = fmt(e.lngLat.lat, 'N', 'S') + '  ' + fmt(e.lngLat.lng, 'E', 'W') + '  ·  z' + map.getZoom().toFixed(1); });

  // layer toggles
  const setVis = (pred, on) => map.getStyle().layers.forEach(l => { if (pred(l)) map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none'); });
  const toggles = {
    't-hill': (l) => l.id === 'hillshade',
    't-contour': (l) => l.id.startsWith('contour'),
    't-land': (l) => l.id.startsWith('lu-'),
    't-bnd': (l) => l.id.startsWith('bnd-') || l.id === 'county-label',
    't-bld': (l) => l.id === 'building',
    't-mask': (l) => l.id.startsWith('mask-'),
  };
  for (const [id, pred] of Object.entries(toggles)) {
    const el = document.getElementById(id);
    el.addEventListener('change', () => setVis(pred, el.checked));
  }
  const applyToggles = () => {
    for (const [id, pred] of Object.entries(toggles)) if (!document.getElementById(id).checked) setVis(pred, false);
    if (document.getElementById('t-3d').checked) map.setTerrain({ source: 'dem', exaggeration: 1.6 });
  };

  const unitLabel = () => { document.getElementById('contour-unit').textContent = styleName === 'swiss' ? '(m)' : '(ft)'; };
  unitLabel();

  // style switcher (Atlas / Swiss)
  const switcher = document.getElementById('styles');
  const markStyle = () => switcher.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.style === styleName));
  markStyle();
  switcher.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.style === styleName) return;
    styleName = b.dataset.style;
    markStyle();
    try { localStorage.setItem('atlasStyle', styleName); } catch (err) {}
    const u = new URL(location.href); u.searchParams.set('style', styleName); history.replaceState(null, '', u);
    scale.setUnit(styleName === 'swiss' ? 'metric' : 'imperial');
    unitLabel();
    map.setStyle(STYLES[styleName](), { diff: false });
    map.once('style.load', applyToggles);
  });

  // 3D terrain toggle
  const t3d = document.getElementById('t-3d');
  t3d.addEventListener('change', () => {
    if (t3d.checked) {
      map.setTerrain({ source: 'dem', exaggeration: 1.6 });
      if (map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 800 });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, duration: 600 });
    }
  });

  // popups on click
  const KIND = { city: 'City', town: 'Town', village: 'Village', hamlet: 'Hamlet', suburb: 'District', quarter: 'District',
    neighbourhood: 'Neighborhood', locality: 'Locality', isolated_dwelling: 'Place', farm: 'Farm', peak: 'Summit',
    lake: 'Lake / reservoir', bay: 'Bay', park: 'Park', island: 'Island', range: 'Mountain range', ridge: 'Ridge',
    valley: 'Valley', cape: 'Point / cape', saddle: 'Gap / pass', beach: 'Beach', swamp: 'Swamp / marsh',
    waterfall: 'Waterfall', spring: 'Spring', cliff: 'Cliff', rock: 'Rock / pillar', flat: 'Flat', basin: 'Basin',
    bend: 'River bend', rapids: 'Rapids', woods: 'Woods', gut: 'Gut', arch: 'Arch', bench: 'Bench', slope: 'Slope',
    isthmus: 'Isthmus', crossing: 'Crossing', military: 'Military', stream: 'Stream', canal: 'Canal', channel: 'Channel',
    sea: 'Sea', area: 'Area', levee: 'Levee', bar: 'Bar / shoal', county: 'County', river: 'River', ditch: 'Ditch',
    drain: 'Drain', ocean: 'Ocean', pond: 'Pond', national_park: 'National park', nature_reserve: 'Nature reserve',
    protected_area: 'Protected area', state_park: 'State park', attraction: 'Attraction', museum: 'Museum',
    college: 'College', hospital: 'Hospital', stadium: 'Stadium', zoo: 'Zoo', lighthouse: 'Lighthouse', campsite: 'Campground',
    motorway: 'Highway', trunk: 'Highway', primary: 'Road', secondary: 'Road', tertiary: 'Road', minor: 'Street',
    service: 'Service road', track: 'Track', path: 'Trail', pedestrian: 'Pedestrian way', camp: 'Campground',
    themepark: 'Theme park', aquarium: 'Aquarium', historic: 'Historic site', observatory: 'Observatory',
    university: 'University', library: 'Library', townhall: 'Town hall', courthouse: 'Courthouse', ferry: 'Ferry terminal',
    airport: 'Airport', station: 'Station', marina: 'Marina', winery: 'Winery', golf: 'Golf course', cemetery: 'Cemetery',
    cave: 'Cave', hill: 'Hill', prison: 'Prison', strait: 'Strait', viewpoint: 'Viewpoint', rail: 'Railway',
    light: 'Light rail', subway: 'Subway', reservoir: 'Reservoir' };
  const LAYER_KIND = { waterway: 'Waterway', county_label: 'County', label_line: 'Landform', junction: 'Exit' };
  let popup;
  map.on('click', (e) => {
    const box = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
    const fs = map.queryRenderedFeatures(box).filter(f => f.layer.type === 'symbol' && f.properties && (f.properties.name || f.properties.ref));
    if (popup) popup.remove();
    if (!fs.length) return;
    const f = fs[0], p = f.properties;
    let kind = KIND[p.kind] || KIND[p.class] || LAYER_KIND[f.sourceLayer] || '';
    let d = '';
    const ft = p.ele_ft && Number(p.ele_ft).toLocaleString('en-US') + ' ft', m = p.ele && Number(p.ele).toLocaleString('en-US') + ' m';
    if (ft) d = styleName === 'swiss' ? m + ' · ' + ft : ft + ' · ' + m;
    if (p.pop) d = 'Population ' + Number(p.pop).toLocaleString('en-US');
    if (f.sourceLayer === 'junction') d = 'Exit ' + p.ref;
    if (p.iata) d = [p.iata, p.icao].filter(Boolean).join(' · ');
    const where = [p.county && (p.county + (p.state === 'CT' ? '' : ' Co.')), p.state].filter(Boolean).join(', ');
    let name = p.name || p.ref;
    if (f.sourceLayer === 'county_label') name = p.name + ' ' + p.suffix;
    popup = new maplibregl.Popup({ closeButton: false, offset: 8, maxWidth: '280px' }).setLngLat(e.lngLat)
      .setHTML('<div class="pop"><div class="n"></div><div class="k"></div><div class="d"></div><div class="w"></div></div>').addTo(map);
    const el = popup.getElement();
    el.querySelector('.n').textContent = name;
    el.querySelector('.k').textContent = kind;
    el.querySelector('.d').textContent = d;
    el.querySelector('.w').textContent = where;
  });
  map.on('mousemove', (e) => {
    const fs = map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]]);
    map.getCanvas().style.cursor = fs.some(f => f.layer.type === 'symbol' && f.properties.name) ? 'pointer' : '';
  });

  // search
  const q = document.getElementById('q'), results = document.getElementById('results');
  let index = null, sel = -1, items = [];
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let loading;
  function load() {
    if (!loading) loading = fetch('data/search.json?v=' + (window.ATLAS_V || '0')).then(r => r.json()).then(data => {
      index = data.map(r => ({ name: r[0], kind: r[1], lon: r[2], lat: r[3], rank: r[4], state: r[5], n: norm(r[0]) }));
    });
    return loading;
  }
  q.addEventListener('focus', load);
  function zoomFor(k) {
    return ({ county: 9, range: 10, valley: 12, bay: 11.5, lake: 13, island: 12.5, peak: 13.5, ridge: 12.5, locality: 14,
      stream: 13.5, swamp: 13.5 })[k] || 14.5;
  }
  function render() {
    results.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li'); if (i === sel) li.className = 'on';
      const n = document.createElement('span'); n.textContent = it.name;
      const s = document.createElement('small'); s.textContent = ' ' + it.state; n.appendChild(s);
      const k = document.createElement('span'); k.className = 'k'; k.textContent = KIND[it.kind] || it.kind;
      li.append(n, k);
      li.addEventListener('mousedown', (ev) => { ev.preventDefault(); go(it); });
      results.appendChild(li);
    });
  }
  let marker;
  function go(it) {
    results.innerHTML = ''; q.value = it.name; q.blur();
    map.flyTo({ center: [it.lon, it.lat], zoom: zoomFor(it.kind), speed: 1.6 });
    if (marker) marker.remove();
    marker = new maplibregl.Marker({ color: '#c0503a', scale: 0.7 }).setLngLat([it.lon, it.lat]).addTo(map);
  }
  q.addEventListener('input', async () => {
    const s = norm(q.value.trim()); sel = 0;
    if (!s) { items = []; return render(); }
    await load();
    if (norm(q.value.trim()) !== s) return;
    const seen = new Set(); const pre = [], sub = [];
    for (const it of index) {
      const i = it.n.indexOf(s);
      if (i < 0) continue;
      const key = it.n + '|' + it.kind + '|' + Math.round(it.lon * 20) + '|' + Math.round(it.lat * 20);
      if (seen.has(key)) continue; seen.add(key);
      (i === 0 || it.n[i - 1] === ' ' ? pre : sub).push(it);
      if (pre.length >= 60) break;
    }
    const sc = (it) => it.rank + (it.n === s ? -100000 : 0);
    items = pre.sort((a, b) => sc(a) - sc(b)).concat(sub.sort((a, b) => sc(a) - sc(b))).slice(0, 10);
    render();
  });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[sel]) go(items[sel]);
    else if (e.key === 'Escape') { results.innerHTML = ''; q.blur(); }
  });
  q.addEventListener('blur', () => setTimeout(() => { results.innerHTML = ''; }, 150));
  map.on('error', (e) => console.warn('map error', e.error && e.error.message));
})();
