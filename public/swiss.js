// Tri-State Atlas — "Swiss" style: the same data drawn in the manner of the swisstopo national map
// (white ground, green forest with darker edges, red motorways, yellow main roads, black-cased minor roads,
// bluish-grey relief shading, brown metric contours, magenta boundaries). Open fonts and our own symbols.
function buildSwissStyle(opts) {
  const F = {
    cr: ['Fira Sans Condensed Regular'], cm: ['Fira Sans Condensed Medium'], csb: ['Fira Sans Condensed SemiBold'],
    it: ['Fira Sans Condensed Italic'], mi: ['Fira Sans Condensed Medium Italic'], b: ['Fira Sans Condensed Bold'],
  };
  const C = {
    bg: '#fdfdfe', ink: '#202020', halo: 'rgba(250,250,250,0.9)', peak: '#1b243e',
    water: '#d2eeff', waterLine: '#4da4da', waterText: '#2f86bc',
    forest: '#c3ddb4', forestEdge: '#8ac66c', green: '#d3ebc7', parkLine: '#70b446',
    settlement: '#f6e6c4', industry: '#e9e1d8', rail: '#cb4d4d', contour: 'rgba(180,110,13,0.38)', contourText: '#ab7e40',
    canton: '#c35591', rock: '#ece8e2', wetland: '#dff0f5',
  };
  const Z = (...s) => ['interpolate', ['linear'], ['zoom'], ...s];
  const X2 = (...s) => ['interpolate', ['exponential', 1.6], ['zoom'], ...s];
  const eq = (k, v) => ['==', ['get', k], v];
  const has = (k) => ['has', k];
  const not = (x) => ['!', x];
  const inn = (k, ...vs) => ['in', ['get', k], ['literal', vs]];
  const all = (...xs) => ['all', ...xs];
  const RANK = ['coalesce', ['get', 'rank'], 99];
  const OSM = 'osm', ATL = 'atlas';
  const L = [];
  const add = (l) => (L.push(l), l);
  const sym = (id, source, srcLayer, filter, layout, paint, extra = {}) => add(Object.assign({
    id, type: 'symbol', source, ...(srcLayer ? { 'source-layer': srcLayer } : {}), ...(filter ? { filter } : {}),
    layout: Object.assign({ 'text-padding': 1, 'text-max-width': 8, 'icon-padding': 0, 'text-letter-spacing': 0.025 }, layout),
    paint: Object.assign({ 'text-color': C.ink, 'text-halo-color': C.halo, 'text-halo-width': Z(10, 0.9, 14, 1.3), 'text-halo-blur': 0.25 }, paint),
  }, extra));
  const fill = (id, classes, paint, minzoom = 0) => add({ id, type: 'fill', source: OSM, 'source-layer': 'landuse', minzoom,
    filter: inn('class', ...classes), paint });

  // ---------------------------------------------------------------- ground
  add({ id: 'background', type: 'background', paint: { 'background-color': C.bg } });
  fill('lu-farmland', ['farmland'], { 'fill-color': '#fbfbf2' });
  fill('lu-grass', ['grass', 'scrub'], { 'fill-color': C.green, 'fill-opacity': 0.55 });
  fill('lu-orchard', ['orchard'], { 'fill-pattern': 'pat-orchard' }, 11);
  fill('lu-vineyard', ['vineyard'], { 'fill-pattern': 'pat-vineyard' }, 11);
  fill('lu-residential', ['residential'], { 'fill-color': C.settlement, 'fill-opacity': Z(7, 0.7, 13, 0.55) });
  fill('lu-commercial', ['commercial', 'industrial', 'airport', 'apron', 'quarry', 'military', 'prison'], { 'fill-color': C.industry });
  fill('lu-civic', ['school', 'hospital', 'stadium'], { 'fill-color': '#f0e8dc' });
  fill('lu-park', ['park', 'golf', 'cemetery', 'zoo'], { 'fill-color': C.green });
  fill('lu-wetland', ['wetland'], { 'fill-color': C.wetland });
  fill('lu-wetland-pattern', ['wetland'], { 'fill-pattern': 'pat-marsh' }, 11);
  fill('lu-rock', ['rock', 'sand'], { 'fill-color': C.rock });
  fill('lu-wood', ['wood'], { 'fill-color': C.forest, 'fill-opacity': 0.95 });
  add({ id: 'lu-wood-edge', type: 'line', source: OSM, 'source-layer': 'landuse', minzoom: 11, filter: eq('class', 'wood'),
    paint: { 'line-color': C.forestEdge, 'line-width': Z(11, 0.4, 15, 1), 'line-opacity': 0.8 } });
  add({ id: 'lu-protected-line', type: 'line', source: OSM, 'source-layer': 'landuse', minzoom: 8, filter: eq('class', 'protected'),
    paint: { 'line-color': C.parkLine, 'line-width': Z(8, 0.8, 13, 1.6), 'line-opacity': Z(8, 0.45, 13, 0.3) } });

  // ---------------------------------------------------------------- relief (swiss shading: blue-grey shadow, warm light)
  add({ id: 'hillshade', type: 'hillshade', source: 'dem', maxzoom: 17,
    paint: { 'hillshade-exaggeration': Z(6, 0.5, 11, 0.4, 15, 0.28), 'hillshade-shadow-color': '#4e5a74',
      'hillshade-highlight-color': 'rgba(255,250,225,0.55)', 'hillshade-accent-color': '#5d6680',
      'hillshade-illumination-direction': 315, 'hillshade-illumination-anchor': 'map' } });
  add({ id: 'contour', type: 'line', source: 'contours', 'source-layer': 'contours', minzoom: 11,
    paint: { 'line-color': C.contour, 'line-width': Z(11, ['match', ['get', 'level'], 1, 0.6, 0.3], 15, ['match', ['get', 'level'], 1, 1.1, 0.6]) } });

  // ---------------------------------------------------------------- water
  add({ id: 'water', type: 'fill', source: OSM, 'source-layer': 'water', paint: { 'fill-color': C.water } });
  add({ id: 'water-edge', type: 'line', source: OSM, 'source-layer': 'water', minzoom: 8,
    paint: { 'line-color': C.waterLine, 'line-width': Z(8, 0.4, 14, 1), 'line-opacity': 0.8 } });
  const wwWidth = Z(6, ['match', ['get', 'class'], 'river', 0.7, 0.3], 10, ['match', ['get', 'class'], 'river', 1.4, 'canal', 1, 0.4],
    13, ['match', ['get', 'class'], 'river', 2.4, 'canal', 1.6, 0.8], 16, ['match', ['get', 'class'], 'river', 4, 'canal', 2.4, 1.5]);
  add({ id: 'waterway', type: 'line', source: OSM, 'source-layer': 'waterway', filter: not(has('inter')),
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.waterLine, 'line-width': wwWidth } });
  add({ id: 'waterway-inter', type: 'line', source: OSM, 'source-layer': 'waterway', filter: has('inter'),
    paint: { 'line-color': C.waterLine, 'line-width': wwWidth, 'line-dasharray': [3, 2] } });

  // ---------------------------------------------------------------- rock, buildings
  add({ id: 'cliff', type: 'line', source: OSM, 'source-layer': 'label_line', minzoom: 12, filter: eq('kind', 'cliff'),
    paint: { 'line-pattern': 'pat-cliff-swiss', 'line-width': 5 } });
  add({ id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
    paint: { 'fill-color': '#9e9a95', 'fill-outline-color': '#6e6a66' } });

  // ---------------------------------------------------------------- roads (black casings, colour by class)
  const cls = (...c) => inn('class', ...c);
  const road = (id, filter, stops, color, caseColor, caseW, minzoom = 0, extra = {}) => {
    const sort = { 'line-sort-key': ['coalesce', ['get', 'layer'], 0] };
    if (caseColor) add({ id: id + '-case', type: 'line', source: OSM, 'source-layer': 'road', minzoom, filter,
      layout: Object.assign({ 'line-cap': 'butt', 'line-join': 'round' }, sort),
      paint: { 'line-color': caseColor, 'line-width': X2(...stops.map((v, i) => i % 2 ? v + caseW * Math.min(1, v) : v)) } });
    add({ id, type: 'line', source: OSM, 'source-layer': 'road', minzoom, filter,
      layout: Object.assign({ 'line-cap': 'round', 'line-join': 'round' }, sort),
      paint: Object.assign({ 'line-color': color, 'line-width': X2(...stops) }, extra) });
  };
  const notT = not(has('tunnel'));
  road('sw-path', all(cls('path'), notT), [11, 0.6, 16, 1.4], '#2a2a2a', null, 0, 0, { 'line-dasharray': [3, 2] });
  road('sw-track', all(cls('track'), notT), [11, 0.6, 16, 1.6], '#2a2a2a', null, 0, 0, { 'line-dasharray': [5, 2] });
  road('sw-service', all(cls('service', 'pedestrian'), notT), [13, 0.6, 17, 5], '#ffffff', '#555', 0.8);
  road('sw-minor', all(cls('minor'), notT), [10, 0.5, 13, 1.2, 17, 8], '#ffffff', '#3a3a3a', 1);
  road('sw-tertiary', all(cls('tertiary'), notT), [9, 0.6, 13, 2, 17, 10], '#ffffff', '#202020', 1.2);
  road('sw-secondary', all(cls('secondary'), notT), [8, 0.8, 13, 2.6, 17, 12], '#fde98a', '#202020', 1.2);
  road('sw-primary', all(cls('primary'), notT), [7, 1, 13, 3.2, 17, 14], '#f8c95a', '#202020', 1.3);
  road('sw-trunk', all(cls('trunk'), notT), [5, 1, 13, 3.6, 17, 16], '#ef8d45', '#202020', 1.3);
  road('sw-motorway', all(cls('motorway'), notT), [5, 1.2, 13, 4.2, 17, 18], '#e0453a', '#202020', 1.4);
  add({ id: 'sw-tunnel', type: 'line', source: OSM, 'source-layer': 'road', filter: all(has('tunnel'), cls('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor')),
    paint: { 'line-color': '#555', 'line-width': X2(9, 0.5, 15, 2), 'line-dasharray': [2, 1.5], 'line-opacity': 0.6 } });
  add({ id: 'sw-rail', type: 'line', source: OSM, 'source-layer': 'road', filter: all(cls('rail', 'light'), notT),
    paint: { 'line-color': C.rail, 'line-width': Z(7, ['case', has('minor'), 0.6, 0.8], 14, ['case', has('minor'), 0.9, 2]) } });
  add({ id: 'sw-subway', type: 'line', source: OSM, 'source-layer': 'road', minzoom: 12, filter: cls('subway'),
    paint: { 'line-color': C.rail, 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.6 } });
  add({ id: 'sw-ferry', type: 'line', source: OSM, 'source-layer': 'road', filter: cls('ferry'),
    paint: { 'line-color': C.waterLine, 'line-width': 1, 'line-dasharray': [4, 3] } });
  add({ id: 'sw-runway', type: 'line', source: OSM, 'source-layer': 'road', filter: cls('runway', 'taxiway'),
    paint: { 'line-color': '#b8b3bd', 'line-width': X2(10, ['match', ['get', 'class'], 'runway', 1, 0.3], 17, ['match', ['get', 'class'], 'runway', 40, 10]) } });

  // ---------------------------------------------------------------- boundaries
  add({ id: 'bnd-town', type: 'line', source: ATL, 'source-layer': 'town', minzoom: 11,
    paint: { 'line-color': C.canton, 'line-width': 0.6, 'line-dasharray': [4, 2], 'line-opacity': 0.28 } });
  add({ id: 'bnd-county', type: 'line', source: ATL, 'source-layer': 'county', minzoom: 7,
    paint: { 'line-color': C.canton, 'line-width': Z(7, 0.8, 12, 1.6), 'line-dasharray': [6, 2, 1, 2], 'line-opacity': 0.55 } });
  add({ id: 'bnd-state', type: 'line', source: ATL, 'source-layer': 'state',
    paint: { 'line-color': C.canton, 'line-width': Z(5, 1.2, 10, 2.6), 'line-opacity': 0.75 } });
  add({ id: 'mask-soft', type: 'fill', source: 'region', filter: eq('k', 'soft'), paint: { 'fill-color': '#f2f2f2', 'fill-opacity': 0.5 } });
  add({ id: 'mask-hard', type: 'fill', source: 'region', filter: eq('k', 'hard'), paint: { 'fill-color': '#f2f2f2', 'fill-opacity': 0.9 } });

  // ================================================================ labels
  sym('contour-label', 'contours', 'contours', eq('level', 1),
    { 'symbol-placement': 'line', 'text-field': ['number-format', ['get', 'ele'], {}], 'text-font': F.cr, 'text-size': 9.5,
      'symbol-spacing': 400, 'text-max-angle': 25 }, { 'text-color': C.contourText }, { minzoom: 13 });
  sym('waterway-name', OSM, 'waterway', has('name'),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.it, 'symbol-spacing': 350,
      'text-size': ['match', ['get', 'class'], 'river', 12, 10.5] }, { 'text-color': C.waterText }, { minzoom: 10 });
  sym('road-name', OSM, 'road', all(has('name'), cls('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'track', 'path')),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.cr, 'text-size': Z(13, 9.5, 16, 12), 'symbol-spacing': 300 },
    { 'text-color': '#3a3a3a' }, { minzoom: 13 });
  sym('road-shield', OSM, 'road', has('num'),
    { 'symbol-placement': 'line', 'symbol-spacing': Z(6, 180, 12, 450), 'icon-image': ['match', ['get', 'net'], 'i', 'sw-shield-motorway', 'sw-shield'],
      'icon-text-fit': 'both', 'icon-rotation-alignment': 'viewport', 'text-rotation-alignment': 'viewport', 'text-field': ['get', 'num'],
      'text-font': F.b, 'text-size': 9.5, 'text-padding': 4, 'symbol-sort-key': ['match', ['get', 'net'], 'i', 0, 'us', 1, 2] },
    { 'text-color': ['match', ['get', 'net'], 'i', '#fff', C.ink], 'text-halo-width': 0 }, { minzoom: 7 });
  sym('junction', OSM, 'junction', null,
    { 'icon-image': 'sw-shield', 'icon-text-fit': 'both', 'text-field': ['get', 'ref'], 'text-font': F.cm, 'text-size': 9 },
    { 'text-halo-width': 0 }, { minzoom: 13 });
  sym('label-water', OSM, 'label', inn('kind', 'lake', 'bay', 'strait'),
    { 'text-field': ['get', 'name'], 'text-font': F.it, 'symbol-sort-key': RANK,
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'size'], 2, 13, 1, 11, 10], 14, ['match', ['get', 'size'], 2, 17, 1, 14, 12]] },
    { 'text-color': C.waterText });
  sym('label-line-water', OSM, 'label_line', inn('kind', 'bay', 'strait'),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.it, 'text-size': 13, 'text-letter-spacing': 0.2 },
    { 'text-color': C.waterText });
  sym('label-park', OSM, 'label', inn('kind', 'park', 'golf', 'cemetery', 'woods', 'swamp'),
    { 'text-field': ['get', 'name'], 'text-font': F.it, 'text-size': Z(9, 10, 14, 12), 'symbol-sort-key': RANK },
    { 'text-color': '#3f7f2a' });
  // relief names: widely spaced along ridges (the swisstopo convention for Grat / Tal names)
  sym('label-line-relief', OSM, 'label_line', all(inn('kind', 'ridge', 'valley'), has('name')),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.mi, 'text-size': Z(9, 10.5, 13, 13),
      'text-letter-spacing': 0.3, 'text-max-angle': 35, 'symbol-spacing': 600, 'symbol-sort-key': RANK },
    { 'text-color': C.peak });
  const G = (id, kinds, layout, paint) => sym(id, ATL, 'names', inn('kind', ...kinds),
    Object.assign({ 'text-field': ['get', 'name'], 'symbol-sort-key': RANK }, layout), paint);
  G('gnis-range', ['range'], { 'text-font': F.cm, 'text-size': Z(8, 11, 12, 14), 'text-letter-spacing': 0.3, 'text-transform': 'uppercase',
    'text-max-width': 12 }, { 'text-color': C.peak });
  G('gnis-relief', ['valley', 'ridge', 'basin', 'flat', 'slope', 'bench', 'cliff', 'rock', 'arch'],
    { 'text-font': F.mi, 'text-size': Z(10, 10.5, 14, 12.5), 'text-letter-spacing': 0.1 }, { 'text-color': C.peak });
  G('gnis-saddle', ['saddle'], { 'icon-image': 'saddle', 'text-font': F.it, 'text-size': 11, 'text-anchor': 'left', 'text-offset': [0.7, 0] },
    { 'text-color': C.peak });
  G('gnis-water', ['bay', 'gut', 'channel', 'rapids', 'bend', 'bar', 'waterfall', 'spring'], { 'text-font': F.it, 'text-size': 11.5 },
    { 'text-color': C.waterText });
  G('gnis-other', ['island', 'cape', 'beach', 'isthmus', 'swamp', 'woods'], { 'text-font': F.it, 'text-size': Z(10, 10.5, 14, 12) }, {});
  const PEAK = {
    'text-field': ['step', ['zoom'], ['get', 'name'], 10, ['case', has('ele'),
      ['format', ['get', 'name'], {}, '\n', {}, ['number-format', ['get', 'ele'], { locale: 'de-CH' }], { 'font-scale': 0.85 }], ['get', 'name']]],
    'text-font': F.cm, 'text-size': Z(8, 10, 13, 12), 'text-anchor': 'top', 'text-offset': [0, 0.5], 'text-max-width': 8,
    'text-line-height': 1.05, 'symbol-sort-key': RANK,
  };
  sym('label-peak-osm', OSM, 'label', inn('kind', 'peak', 'hill'), Object.assign({ 'icon-image': 'sw-hill' }, PEAK), { 'text-color': C.peak });
  G('gnis-peak', ['peak'], Object.assign({ 'icon-image': ['case', ['>=', ['coalesce', ['get', 'ele'], 0], 600], 'sw-peak', 'sw-hill'] }, PEAK),
    { 'text-color': C.peak });
  sym('label-poi', OSM, 'label', not(inn('kind', 'lake', 'bay', 'strait', 'park', 'golf', 'cemetery', 'woods', 'swamp', 'peak', 'hill',
    'saddle', 'station', 'airport', 'island', 'cape', 'beach')),
    { 'icon-image': 'sw-poi', 'text-field': ['get', 'name'], 'text-font': F.cr, 'text-size': 11, 'text-anchor': 'left',
      'text-offset': [0.6, 0], 'symbol-sort-key': RANK, 'icon-optional': true }, { 'text-color': '#3a3a3a' });
  sym('label-station', OSM, 'label', eq('kind', 'station'),
    { 'icon-image': 'sw-station', 'text-field': ['get', 'name'], 'text-font': F.cm, 'text-size': 11, 'text-anchor': 'left',
      'text-offset': [0.7, 0], 'text-optional': true }, { 'text-color': C.rail });
  sym('label-airport', OSM, 'label', eq('kind', 'airport'),
    { 'text-field': ['step', ['zoom'], ['coalesce', ['get', 'iata'], ''], 11, ['get', 'name']], 'text-font': F.csb, 'text-size': 11.5 }, {});
  sym('county-label', ATL, 'county_label', null,
    { 'text-field': ['upcase', ['get', 'name']], 'text-font': F.cm, 'text-size': Z(7, 9.5, 10, 12), 'text-letter-spacing': 0.2,
      'symbol-sort-key': ['-', 0, ['get', 'area']], 'text-padding': 12 }, { 'text-color': C.canton }, { maxzoom: 11 });
  G('gnis-locality', ['locality'], { 'text-font': F.cr, 'text-size': Z(11, 10, 14, 11.5) }, { 'text-color': '#3a3a3a' });
  const PSZ = ['match', ['get', 'class'], 'city', Z(6, 13, 10, 18, 14, 24), 'town', Z(7, 10.5, 11, 14, 14, 17),
    'village', Z(9, 10, 13, 13), 'suburb', Z(11, 11, 15, 14), Z(11, 9.5, 15, 12)];
  sym('place-minor', OSM, 'place', not(inn('class', 'city', 'town')),
    { 'text-field': ['get', 'name'], 'text-font': ['match', ['get', 'class'], 'village', ['literal', F.cm], ['literal', F.cr]],
      'text-size': ['step', ['zoom'], 10, 12, 11.5, 14, 13], 'symbol-sort-key': RANK }, {});
  sym('place-town', OSM, 'place', eq('class', 'town'),
    { 'icon-image': ['step', ['zoom'], 'sw-town', 11, ''], 'text-field': ['get', 'name'], 'text-font': F.csb,
      'text-size': Z(7, 10.5, 11, 14, 14, 17), 'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.5,
      'symbol-sort-key': RANK }, {});
  sym('place-city', OSM, 'place', eq('class', 'city'),
    { 'icon-image': ['step', ['zoom'], 'sw-city', 11, ''], 'text-field': ['get', 'name'], 'text-font': F.b,
      'text-size': Z(6, 13, 10, 18, 14, 24), 'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.6,
      'symbol-sort-key': RANK }, { 'text-halo-width': 1.6 });
  sym('ocean-label', 'labels', null, eq('k', 'sea'),
    { 'text-field': ['get', 'name'], 'text-font': F.it, 'text-size': ['get', 'size'], 'text-letter-spacing': 0.3, 'text-max-width': 30 },
    { 'text-color': C.waterText });
  sym('state-label', 'labels', null, eq('k', 'state'),
    { 'text-field': ['get', 'name'], 'text-font': F.csb, 'text-size': Z(5, 12, 8, 18), 'text-letter-spacing': 0.4 },
    { 'text-color': C.canton }, { maxzoom: 9 });

  return { version: 8, name: 'Tri-State Atlas (Swiss)', glyphs: location.origin + '/fonts/{fontstack}/{range}.pbf',
    sources: atlasSources(opts), layers: L };
}
