// Tri-State Atlas — "Atlas" style: dense, atlas-inspired cartography for the 200 miles around New York City.
// Sources: custom OSM tiles (osm.pmtiles, schema in scripts/build_osm.py), GNIS names + Census boundaries
// (atlas.pmtiles), AWS terrain tiles for relief/contours, OpenFreeMap only for building footprints at z14+.
function buildAtlasStyle(opts) {
  const ORIGIN = location.origin;
  const F = {
    serif: ['PT Serif Regular'], serifB: ['PT Serif Bold'], serifI: ['PT Serif Italic'], serifBI: ['PT Serif Bold Italic'],
    sans: ['Fira Sans Condensed Regular'], sansI: ['Fira Sans Condensed Italic'], sansM: ['Fira Sans Condensed Medium'],
    sansMI: ['Fira Sans Condensed Medium Italic'], sansSB: ['Fira Sans Condensed SemiBold'],
    sansSBI: ['Fira Sans Condensed SemiBold Italic'], sansB: ['Fira Sans Condensed Bold'],
  };
  const C = {
    land: '#f6f3ea', water: '#b3d2e6', waterLine: '#86b3d4', waterText: '#3e6d96', waterHalo: 'rgba(220,235,245,0.8)',
    halo: 'rgba(251,249,243,0.92)', text: '#2a2521',
    park: '#cfe4b8', wood: '#dce8cb', scrub: '#e5ebce', grass: '#e9efd4', farmland: '#f2efdc', orchard: '#e4ecd0',
    vineyard: '#ebe2dc', wetland: '#d6e7de', sand: '#f4ead0', rock: '#e7e3dc', ice: '#f5f9fb',
    residential: '#ede7dc', commercial: '#f0e0d8', industrial: '#e8e2e8', military: '#f1dcd6', cemetery: '#d9e4cf',
    school: '#f1e8d2', hospital: '#f4dfdc', airport: '#e8e5ec', golf: '#d3e7bf', quarry: '#e2ddd6', stadium: '#e6e0d0',
    building: '#ddd4c6', buildingLine: '#cbbfae',
    peak: '#5b4029', relief: '#7c5e40', parkText: '#3b6b2b', boundary: '#9f86a1',
    motorway: '#d9794f', motorwayCase: '#9c4a2c', trunk: '#e8a15e', trunkCase: '#a4683a',
    primary: '#f2c56c', primaryCase: '#a88540', secondary: '#f7e0a0', secondaryCase: '#b59f68',
    minor: '#ffffff', minorCase: '#c9bfae', path: '#8a5a3a', rail: '#7a6f63',
  };
  const Z = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
  const E = (...stops) => ['interpolate', ['exponential', 1.55], ['zoom'], ...stops];
  const eq = (k, v) => ['==', ['get', k], v];
  const has = (k) => ['has', k];
  const not = (x) => ['!', x];
  const inn = (k, ...vs) => ['in', ['get', k], ['literal', vs]];
  const all = (...xs) => ['all', ...xs];
  const RANK = ['coalesce', ['get', 'rank'], 99];
  const OSM = 'osm', ATL = 'atlas';
  const L = [];
  const add = (l) => { L.push(l); return l; };
  const sym = (id, source, srcLayer, filter, layout, paint, extra = {}) => add(Object.assign({
    id, type: 'symbol', source, ...(srcLayer ? { 'source-layer': srcLayer } : {}), ...(filter ? { filter } : {}),
    layout: Object.assign({ 'text-padding': 1, 'text-max-width': 8, 'icon-padding': 0 }, layout),
    paint: Object.assign({ 'text-color': C.text, 'text-halo-color': C.halo, 'text-halo-width': 1.4, 'text-halo-blur': 0.3 }, paint),
  }, extra));

  // ---------------------------------------------------------------- land cover & land use
  add({ id: 'background', type: 'background', paint: { 'background-color': C.land } });
  const landFill = (id, classes, color, opacity = 1, minzoom = 0) => add({
    id, type: 'fill', source: OSM, 'source-layer': 'landuse', minzoom, filter: inn('class', ...classes),
    paint: { 'fill-color': color, 'fill-opacity': opacity },
  });
  landFill('lu-farmland', ['farmland'], C.farmland);
  landFill('lu-orchard', ['orchard'], C.orchard);
  landFill('lu-vineyard', ['vineyard'], C.vineyard);
  landFill('lu-grass', ['grass'], C.grass);
  landFill('lu-scrub', ['scrub'], C.scrub);
  landFill('lu-wood', ['wood'], C.wood);
  landFill('lu-wetland', ['wetland'], C.wetland);
  landFill('lu-sand', ['sand'], C.sand);
  landFill('lu-rock', ['rock', 'quarry'], C.rock);
  landFill('lu-ice', ['ice'], C.ice);
  landFill('lu-residential', ['residential'], C.residential, Z(8, 0.6, 12, 1));
  landFill('lu-commercial', ['commercial'], C.commercial, Z(8, 0.5, 12, 1));
  landFill('lu-industrial', ['industrial'], C.industrial, Z(8, 0.5, 12, 1));
  landFill('lu-military', ['military'], C.military, 0.8);
  landFill('lu-cemetery', ['cemetery'], C.cemetery);
  landFill('lu-school', ['school'], C.school);
  landFill('lu-hospital', ['hospital'], C.hospital);
  landFill('lu-airport', ['airport'], C.airport);
  landFill('lu-apron', ['apron'], '#dcd8e2');
  landFill('lu-stadium', ['stadium'], C.stadium);
  landFill('lu-prison', ['prison'], '#e6dcdc');
  landFill('lu-zoo', ['zoo'], '#e3ebcf');
  landFill('lu-protected', ['protected'], '#d4e6bf', Z(6, 0.45, 12, 0.35));
  landFill('lu-park', ['park'], C.park);
  landFill('lu-golf', ['golf'], C.golf);
  const pattern = (id, classes, image, minzoom, opacity = 1) => add({ id, type: 'fill', source: OSM, 'source-layer': 'landuse',
    minzoom, filter: inn('class', ...classes), paint: { 'fill-pattern': image, 'fill-opacity': opacity } });
  pattern('lu-wetland-pattern', ['wetland'], 'pat-marsh', 11);
  pattern('lu-orchard-pattern', ['orchard'], 'pat-orchard', 12);
  pattern('lu-vineyard-pattern', ['vineyard'], 'pat-vineyard', 12);
  pattern('lu-rock-pattern', ['rock', 'quarry'], 'pat-rock', 12);
  add({ id: 'lu-protected-line', type: 'line', source: OSM, 'source-layer': 'landuse', minzoom: 8, filter: eq('class', 'protected'),
    paint: { 'line-color': '#8db478', 'line-width': Z(8, 0.6, 12, 1.4, 15, 2.2), 'line-opacity': 0.6, 'line-dasharray': [3, 1.5] } });
  add({ id: 'lu-military-line', type: 'line', source: OSM, 'source-layer': 'landuse', minzoom: 10, filter: eq('class', 'military'),
    paint: { 'line-color': '#c99a90', 'line-width': 0.8, 'line-dasharray': [4, 2] } });

  // ---------------------------------------------------------------- relief
  add({ id: 'hillshade', type: 'hillshade', source: 'dem', maxzoom: 17,
    paint: { 'hillshade-exaggeration': Z(6, 0.45, 10, 0.36, 14, 0.24), 'hillshade-shadow-color': '#5b4a3b',
      'hillshade-highlight-color': 'rgba(255,253,245,0.9)', 'hillshade-accent-color': '#7c6a58',
      'hillshade-illumination-direction': 315 } });
  add({ id: 'contour-minor', type: 'line', source: 'contours', 'source-layer': 'contours', filter: ['!=', ['get', 'level'], 1],
    paint: { 'line-color': '#a8875f', 'line-width': Z(9, 0.35, 14, 0.6), 'line-opacity': Z(9, 0.18, 12, 0.28) } });
  add({ id: 'contour-major', type: 'line', source: 'contours', 'source-layer': 'contours', filter: ['==', ['get', 'level'], 1],
    paint: { 'line-color': '#9a7650', 'line-width': Z(9, 0.6, 14, 1.1), 'line-opacity': Z(9, 0.3, 12, 0.45) } });

  // ---------------------------------------------------------------- water
  add({ id: 'water', type: 'fill', source: OSM, 'source-layer': 'water', filter: not(has('inter')), paint: { 'fill-color': C.water } });
  add({ id: 'water-inter', type: 'fill', source: OSM, 'source-layer': 'water', filter: has('inter'),
    paint: { 'fill-color': C.water, 'fill-opacity': 0.5 } });
  add({ id: 'water-edge', type: 'line', source: OSM, 'source-layer': 'water', minzoom: 9, filter: ['!=', ['get', 'class'], 'ocean'],
    paint: { 'line-color': C.waterLine, 'line-width': Z(9, 0.4, 14, 1), 'line-opacity': 0.7 } });
  add({ id: 'coast-edge', type: 'line', source: OSM, 'source-layer': 'water', minzoom: 6, filter: eq('class', 'ocean'),
    paint: { 'line-color': C.waterLine, 'line-width': Z(6, 0.5, 14, 1.4), 'line-opacity': 0.8 } });
  add({ id: 'waterway-inter', type: 'line', source: OSM, 'source-layer': 'waterway', filter: has('inter'),
    paint: { 'line-color': C.waterLine, 'line-width': Z(10, 0.5, 15, 1.2), 'line-dasharray': [3, 2] } });
  add({ id: 'waterway-stream', type: 'line', source: OSM, 'source-layer': 'waterway',
    filter: all(inn('class', 'stream', 'drain'), not(has('inter'))), layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': C.waterLine, 'line-width': Z(10, 0.45, 12, 0.8, 15, 1.6), 'line-opacity': Z(10, 0.7, 12, 1) } });
  add({ id: 'waterway-river', type: 'line', source: OSM, 'source-layer': 'waterway', filter: inn('class', 'river', 'canal'),
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.waterLine, 'line-width': Z(6, 0.6, 10, 1.3, 14, 3) } });

  // ---------------------------------------------------------------- cliffs, buildings
  add({ id: 'cliff', type: 'line', source: OSM, 'source-layer': 'label_line', minzoom: 12, filter: eq('kind', 'cliff'),
    paint: { 'line-pattern': 'pat-cliff', 'line-width': 5 } });
  add({ id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
    paint: { 'fill-color': C.building, 'fill-outline-color': C.buildingLine, 'fill-opacity': Z(14, 0.6, 15, 1) } });

  // ---------------------------------------------------------------- roads
  const cls = (...c) => inn('class', ...c);
  const W = {
    motorway: [5, 0.8, 9, 1.8, 12, 3.2, 14, 6, 17, 20], trunk: [5, 0.6, 9, 1.4, 12, 2.8, 14, 5, 17, 18],
    primary: [7, 0.5, 9, 1.1, 12, 2.4, 14, 4.5, 17, 16], secondary: [8, 0.4, 10, 0.9, 12, 1.9, 14, 3.8, 17, 14],
    tertiary: [9, 0.4, 12, 1.5, 14, 3.2, 17, 12], minor: [10, 0.3, 12, 0.7, 13, 1, 14, 2.4, 17, 10],
    service: [13, 0.4, 15, 1.2, 17, 5], track: [11, 0.5, 14, 0.9, 17, 2], path: [11, 0.5, 15, 1, 17, 2],
    pedestrian: [13, 0.8, 15, 2, 17, 6],
  };
  const caseMargin = (z) => z <= 8 ? 0.6 : z >= 14 ? 1.6 : 0.6 + (z - 8) / 6;
  const widthExpr = (stops, casing) => E(...stops.map((v, i) => (i % 2 && casing) ? v + caseMargin(stops[i - 1]) : v));
  const sortKey = ['coalesce', ['get', 'layer'], 0];
  const roadGroup = (suffix, brunnelFilter, caseOverride) => {
    const mk = (id, filter, stops, color, casing, caseColor, dash) => {
      if (casing) add({ id: `road-${id}-case${suffix}`, type: 'line', source: OSM, 'source-layer': 'road',
        filter: all(filter, brunnelFilter), layout: { 'line-cap': suffix ? 'butt' : 'round', 'line-join': 'round', 'line-sort-key': sortKey },
        paint: { 'line-color': caseOverride || caseColor, 'line-width': widthExpr(stops, true),
          ...(suffix === '-tunnel' ? { 'line-dasharray': [2, 1.5] } : {}) } });
      add({ id: `road-${id}${suffix}`, type: 'line', source: OSM, 'source-layer': 'road', filter: all(filter, brunnelFilter),
        layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': sortKey },
        paint: { 'line-color': color, 'line-width': widthExpr(stops, false), ...(dash ? { 'line-dasharray': dash } : {}),
          ...(suffix === '-tunnel' ? { 'line-opacity': 0.55 } : {}) } });
    };
    mk('path', all(cls('path'), not(has('rough'))), W.path, C.path, false, null, [2.5, 1.5]);
    mk('path-rough', all(cls('path'), has('rough')), W.path, '#9b4f3a', false, null, [1, 1.5]);
    mk('track', all(cls('track'), not(has('rough'))), W.track, '#9a7a5a', false, null, [4, 1.5]);
    mk('track-rough', all(cls('track'), has('rough')), W.track, '#9a7a5a', false, null, [2, 2]);
    mk('pedestrian', cls('pedestrian'), W.pedestrian, '#f4efe6', true, '#cfc4b3');
    mk('service', cls('service'), W.service, C.minor, true, C.minorCase);
    mk('minor', cls('minor'), W.minor, C.minor, true, C.minorCase);
    mk('tertiary', cls('tertiary'), W.tertiary, '#fffaf0', true, C.minorCase);
    mk('secondary', cls('secondary'), W.secondary, C.secondary, true, C.secondaryCase);
    mk('primary', cls('primary'), W.primary, C.primary, true, C.primaryCase);
    mk('trunk', cls('trunk'), W.trunk, C.trunk, true, C.trunkCase);
    mk('motorway', cls('motorway'), W.motorway, C.motorway, true, C.motorwayCase);
  };
  add({ id: 'runway', type: 'line', source: OSM, 'source-layer': 'road', filter: cls('runway'),
    paint: { 'line-color': '#c4bfcc', 'line-width': E(10, 1, 14, 8, 17, 40) } });
  add({ id: 'taxiway', type: 'line', source: OSM, 'source-layer': 'road', filter: cls('taxiway'),
    paint: { 'line-color': '#d2cdd8', 'line-width': E(12, 0.5, 17, 10) } });
  add({ id: 'pier', type: 'line', source: OSM, 'source-layer': 'road', filter: cls('pier'),
    paint: { 'line-color': '#ebe4d6', 'line-width': E(13, 1.5, 17, 10) } });
  roadGroup('-tunnel', has('tunnel'), '#b8ad9d');
  add({ id: 'subway', type: 'line', source: OSM, 'source-layer': 'road', minzoom: 12, filter: cls('subway'),
    paint: { 'line-color': '#8a7fa0', 'line-width': Z(12, 0.8, 16, 1.8), 'line-dasharray': [3, 1.5], 'line-opacity': 0.6 } });
  roadGroup('', all(not(has('tunnel')), not(has('bridge'))));
  const railF = (extra) => all(cls('rail', 'light'), not(has('tunnel')), extra);
  add({ id: 'rail', type: 'line', source: OSM, 'source-layer': 'road', filter: railF(not(has('minor'))),
    paint: { 'line-color': C.rail, 'line-width': Z(7, 0.5, 14, 1.4) } });
  add({ id: 'rail-minor', type: 'line', source: OSM, 'source-layer': 'road', filter: railF(has('minor')),
    paint: { 'line-color': C.rail, 'line-width': 0.7, 'line-opacity': 0.7 } });
  add({ id: 'rail-hatch', type: 'line', source: OSM, 'source-layer': 'road', minzoom: 12, filter: railF(not(has('minor'))),
    paint: { 'line-color': C.rail, 'line-width': Z(12, 3, 16, 6), 'line-dasharray': [0.2, 3] } });
  add({ id: 'ferry', type: 'line', source: OSM, 'source-layer': 'road', filter: cls('ferry'),
    paint: { 'line-color': '#5a86ad', 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.8 } });
  roadGroup('-bridge', has('bridge'), '#6d6158');

  // ---------------------------------------------------------------- boundaries
  add({ id: 'bnd-town', type: 'line', source: ATL, 'source-layer': 'town', minzoom: 10,
    paint: { 'line-color': C.boundary, 'line-width': Z(10, 0.5, 14, 1), 'line-dasharray': [2, 2], 'line-opacity': 0.55 } });
  add({ id: 'bnd-county', type: 'line', source: ATL, 'source-layer': 'county', minzoom: 7,
    paint: { 'line-color': C.boundary, 'line-width': Z(7, 0.6, 12, 1.4), 'line-dasharray': [5, 2, 1, 2], 'line-opacity': 0.75 } });
  add({ id: 'bnd-state-halo', type: 'line', source: ATL, 'source-layer': 'state',
    paint: { 'line-color': '#d9cfe0', 'line-width': Z(5, 2, 10, 6), 'line-opacity': 0.6 } });
  add({ id: 'bnd-state', type: 'line', source: ATL, 'source-layer': 'state',
    paint: { 'line-color': '#7d6484', 'line-width': Z(5, 0.8, 10, 1.6), 'line-dasharray': [6, 2, 1.5, 2] } });

  // ---------------------------------------------------------------- mask outside region
  add({ id: 'mask-soft', type: 'fill', source: 'region', filter: eq('k', 'soft'), paint: { 'fill-color': '#ebe6da', 'fill-opacity': 0.45 } });
  add({ id: 'mask-hard', type: 'fill', source: 'region', filter: eq('k', 'hard'), paint: { 'fill-color': '#ebe6da', 'fill-opacity': 0.88 } });
  add({ id: 'mask-edge', type: 'line', source: 'region', filter: eq('k', 'edge'), maxzoom: 9,
    paint: { 'line-color': '#b5a894', 'line-width': 0.8, 'line-dasharray': [4, 3], 'line-opacity': 0.6 } });

  // ================================================================ labels (later layers win collisions)
  sym('contour-label', 'contours', 'contours', ['==', ['get', 'level'], 1],
    { 'symbol-placement': 'line', 'text-field': ['number-format', ['get', 'ele'], {}], 'text-font': F.sansI,
      'text-size': Z(12, 9, 15, 10.5), 'symbol-spacing': 360, 'text-max-angle': 25, 'text-padding': 4 },
    { 'text-color': '#8e6d49', 'text-halo-width': 1.6 }, { minzoom: 12 });
  sym('waterway-name', OSM, 'waterway', has('name'),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.sansI, 'symbol-spacing': 320, 'text-max-angle': 30,
      'text-letter-spacing': 0.04, 'text-size': Z(9, ['match', ['get', 'class'], 'river', 10.5, 8.5], 13,
        ['match', ['get', 'class'], 'river', 13, 10.5], 15, ['match', ['get', 'class'], 'river', 14, 11.5]) },
    { 'text-color': C.waterText, 'text-halo-color': C.waterHalo }, { minzoom: 10 });
  sym('road-name-minor', OSM, 'road', all(cls('minor', 'service', 'tertiary', 'track', 'path', 'pedestrian'), has('name')),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.sans, 'text-size': Z(13, 9.5, 16, 12),
      'symbol-spacing': 280, 'text-max-angle': 30 },
    { 'text-color': ['match', ['get', 'class'], 'path', '#6e4a2e', 'track', '#6e4a2e', '#4a423a'], 'text-halo-width': 1.6 }, { minzoom: 13 });
  sym('road-name-major', OSM, 'road', all(cls('primary', 'secondary', 'trunk', 'motorway'), has('name'), not(has('link'))),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.sansM, 'text-size': Z(11, 10, 16, 13),
      'symbol-spacing': 360, 'text-max-angle': 30 }, { 'text-color': '#3d3630', 'text-halo-width': 1.7 }, { minzoom: 11 });
  sym('junction', OSM, 'junction', null,
    { 'icon-image': 'exit', 'icon-text-fit': 'both', 'text-field': ['get', 'ref'], 'text-font': F.sansSB, 'text-size': 9.5,
      'text-padding': 4 }, { 'text-color': '#9c4a2c', 'text-halo-width': 0 }, { minzoom: 13 });
  const SHIELD = ['match', ['get', 'net'], 'i', 'shield-interstate', 'us', 'shield-us', 'st', 'shield-state', 'shield-other'];
  sym('road-shield', OSM, 'road', has('num'),
    { 'symbol-placement': 'line', 'symbol-spacing': Z(6, 160, 12, 420), 'icon-image': SHIELD, 'icon-text-fit': 'both',
      'icon-rotation-alignment': 'viewport', 'text-rotation-alignment': 'viewport', 'text-field': ['get', 'num'],
      'text-font': F.sansB, 'text-size': Z(7, 9, 12, 10.5), 'text-padding': 4, 'icon-padding': 2,
      'symbol-sort-key': ['match', ['get', 'net'], 'i', 0, 'us', 1, 'st', 2, 3] },
    { 'text-color': ['match', ['get', 'net'], 'i', '#fff', 'st', '#fff', '#2a2521'], 'text-halo-width': 0 }, { minzoom: 6 });

  // water body names
  sym('label-lake', OSM, 'label', inn('kind', 'lake'),
    { 'text-field': ['get', 'name'], 'text-font': F.serifI, 'text-max-width': 7, 'symbol-sort-key': RANK,
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'size'], 2, 12, 1, 10.5, 9.5], 14, ['match', ['get', 'size'], 2, 16, 1, 14, 12]] },
    { 'text-color': C.waterText, 'text-halo-color': C.waterHalo });
  sym('label-bay', OSM, 'label', inn('kind', 'bay', 'strait'),
    { 'text-field': ['get', 'name'], 'text-font': F.serifI, 'text-letter-spacing': 0.06, 'symbol-sort-key': RANK,
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, ['match', ['get', 'size'], 2, 13, 1, 11, 10], 13, ['match', ['get', 'size'], 2, 17, 1, 14, 12]] },
    { 'text-color': C.waterText, 'text-halo-color': C.waterHalo });
  sym('label-line-water', OSM, 'label_line', inn('kind', 'bay', 'strait'),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.serifI, 'text-size': Z(8, 11, 13, 15),
      'text-letter-spacing': 0.15, 'text-max-angle': 25 }, { 'text-color': C.waterText, 'text-halo-color': C.waterHalo });

  // parks & open space
  sym('label-park', OSM, 'label', inn('kind', 'park', 'golf', 'cemetery', 'woods'),
    { 'text-field': ['get', 'name'], 'text-font': F.sansI, 'text-size': Z(8, 10, 12, 12, 15, 13.5), 'text-max-width': 8,
      'symbol-sort-key': RANK }, { 'text-color': C.parkText, 'text-halo-width': 1.5 });
  sym('label-swamp', OSM, 'label', eq('kind', 'swamp'),
    { 'text-field': ['get', 'name'], 'text-font': F.sansI, 'text-size': Z(10, 10.5, 14, 12), 'symbol-sort-key': RANK },
    { 'text-color': '#3f7a6a' });

  // relief names along ridges & valleys (curved), then GNIS point features
  sym('label-line-relief', OSM, 'label_line', all(inn('kind', 'ridge', 'valley'), has('name')),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.serifI, 'text-size': Z(9, 10.5, 13, 13.5),
      'text-letter-spacing': 0.22, 'text-max-angle': 35, 'symbol-spacing': 600, 'text-keep-upright': true,
      'symbol-sort-key': RANK }, { 'text-color': C.relief, 'text-halo-width': 1.5 });
  sym('label-line-cliff', OSM, 'label_line', all(eq('kind', 'cliff'), has('name')),
    { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': F.sansI, 'text-size': 11, 'text-letter-spacing': 0.08,
      'text-offset': [0, -0.9], 'text-max-angle': 30 }, { 'text-color': C.relief }, { minzoom: 12 });
  const G = (id, kinds, layout, paint, extra) => sym(id, ATL, 'names', inn('kind', ...kinds),
    Object.assign({ 'text-field': ['get', 'name'], 'symbol-sort-key': RANK }, layout), paint, extra);
  G('gnis-range', ['range'], { 'text-font': F.serifI, 'text-size': Z(8, 11, 12, 15), 'text-letter-spacing': 0.25,
    'text-transform': 'uppercase', 'text-max-width': 12 }, { 'text-color': C.relief, 'text-halo-width': 1.6 });
  G('gnis-valley', ['valley', 'basin', 'flat', 'slope', 'bench'], { 'text-font': F.serifI, 'text-size': Z(10, 10.5, 14, 13),
    'text-letter-spacing': 0.08 }, { 'text-color': C.relief });
  G('gnis-ridge', ['ridge', 'cliff', 'arch', 'rock'], { 'text-font': F.serifI, 'text-size': Z(10, 10, 14, 12.5),
    'text-letter-spacing': 0.12, 'icon-image': ['match', ['get', 'kind'], 'cliff', 'cliff', ''], 'text-offset': [0, 0.8],
    'text-anchor': 'top', 'icon-optional': true }, { 'text-color': C.relief });
  G('gnis-saddle', ['saddle'], { 'icon-image': 'saddle', 'text-font': F.sansI, 'text-size': 11, 'text-anchor': 'left',
    'text-offset': [0.7, 0] }, { 'text-color': C.relief });
  G('gnis-water-feature', ['bay', 'gut', 'channel', 'rapids', 'bend', 'bar'], { 'text-font': F.serifI, 'text-size': Z(10, 10.5, 14, 12.5) },
    { 'text-color': C.waterText, 'text-halo-color': C.waterHalo });
  G('gnis-falls', ['waterfall', 'spring'], { 'icon-image': ['match', ['get', 'kind'], 'waterfall', 'waterfall', 'spring'],
    'text-font': F.sansI, 'text-size': 11, 'text-anchor': 'left', 'text-offset': [0.8, 0] }, { 'text-color': C.waterText });
  G('gnis-island', ['island', 'cape', 'beach', 'isthmus'], { 'text-font': F.sansMI, 'text-size': Z(10, 10.5, 14, 12.5) },
    { 'text-color': '#4a423a' });
  G('gnis-swamp', ['swamp', 'woods'], { 'text-font': F.sansI, 'text-size': Z(11, 10.5, 14, 12) },
    { 'text-color': ['match', ['get', 'kind'], 'swamp', '#3f7a6a', C.parkText] });

  // OSM natural points not in GNIS (islands, capes, beaches, springs, waterfalls, caves, peaks…)
  sym('label-natural', OSM, 'label', inn('kind', 'island', 'cape', 'beach', 'cave', 'rock', 'spring', 'waterfall', 'valley', 'ridge'),
    { 'icon-image': ['match', ['get', 'kind'], 'waterfall', 'waterfall', 'spring', 'spring', 'cave', 'dot-poi', ''],
      'text-field': ['get', 'name'], 'text-font': ['match', ['get', 'kind'], 'island', ['literal', F.sansMI], 'cape', ['literal', F.sansMI], ['literal', F.sansI]],
      'text-size': Z(10, 10.5, 14, 12.5), 'text-anchor': 'left', 'text-offset': [0.7, 0], 'icon-optional': true, 'symbol-sort-key': RANK },
    { 'text-color': ['match', ['get', 'kind'], 'waterfall', C.waterText, 'spring', C.waterText, 'valley', C.relief, 'ridge', C.relief, '#4a423a'] });
  const PEAK_TEXT = ['step', ['zoom'], ['get', 'name'], 10,
    ['case', has('ele_ft'),
      ['format', ['get', 'name'], { 'text-font': ['literal', F.serifBI] }, '\n', {},
        ['number-format', ['get', 'ele_ft'], { locale: 'en-US' }], { 'font-scale': 0.78, 'text-font': ['literal', F.sansI] }],
      ['get', 'name']]];
  const peakLayout = {
    'text-field': PEAK_TEXT, 'text-font': F.serifBI, 'text-size': Z(8, 10, 12, 11.5, 15, 13), 'text-anchor': 'top',
    'text-offset': [0, 0.45], 'text-line-height': 1.05, 'text-max-width': 7, 'symbol-sort-key': RANK,
  };
  sym('label-peak-osm', OSM, 'label', inn('kind', 'peak', 'hill', 'saddle'),
    Object.assign({ 'icon-image': ['match', ['get', 'kind'], 'saddle', 'saddle', 'peak-sm'] }, peakLayout),
    { 'text-color': C.peak, 'text-halo-width': 1.5 });
  G('gnis-peak', ['peak'], Object.assign({
    'icon-image': ['step', ['zoom'], ['case', ['>=', ['coalesce', ['get', 'ele_ft'], 0], 2500], 'peak', 'peak-sm'], 12, 'peak'] }, peakLayout),
    { 'text-color': C.peak, 'text-halo-width': 1.5 });

  // points of interest
  const POI_COLOR = ['match', ['get', 'kind'], 'historic', '#7d4a3a', 'lighthouse', '#7d4a3a', 'camp', C.parkText,
    'viewpoint', C.relief, 'winery', '#7a3d5a', '#6b5641'];
  sym('label-poi', OSM, 'label', inn('kind', 'museum', 'attraction', 'historic', 'lighthouse', 'observatory', 'viewpoint', 'camp',
    'zoo', 'themepark', 'aquarium', 'library', 'townhall', 'courthouse', 'hospital', 'prison', 'stadium', 'marina', 'winery',
    'ferry', 'college', 'university', 'military'),
    { 'icon-image': 'dot-poi', 'text-field': ['get', 'name'], 'text-font': ['match', ['get', 'kind'], 'university', ['literal', F.sansM],
      'college', ['literal', F.sansM], ['literal', F.sans]], 'text-size': Z(11, 10.5, 15, 12), 'text-anchor': 'left',
      'text-offset': [0.6, 0], 'text-max-width': 9, 'symbol-sort-key': RANK, 'icon-optional': true },
    { 'text-color': POI_COLOR });
  sym('label-station', OSM, 'label', eq('kind', 'station'),
    { 'icon-image': ['match', ['get', 'sub'], 'subway', 'dot-subway', 'dot-station'], 'text-field': ['get', 'name'],
      'text-font': F.sansM, 'text-size': Z(11, 10, 15, 12), 'text-anchor': 'left', 'text-offset': [0.6, 0], 'text-max-width': 9,
      'text-optional': true }, { 'text-color': '#5d4e7d' });
  sym('label-airport', OSM, 'label', eq('kind', 'airport'),
    { 'text-field': ['step', ['zoom'], ['coalesce', ['get', 'iata'], ''], 11, ['get', 'name']], 'text-font': F.sansSB,
      'text-size': Z(8, 10, 13, 12), 'text-max-width': 9, 'symbol-sort-key': RANK }, { 'text-color': '#56506a' });

  // places: GNIS localities first (lowest priority), then OSM hierarchy
  G('gnis-locality', ['locality'], { 'icon-image': 'dot-hamlet', 'text-font': F.sans, 'text-size': Z(11, 10, 14, 12),
    'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.55, 'text-max-width': 9 },
    { 'text-color': '#4a423a' });
  const PS = { city: [12, 15, 20, 24], town: [10, 12.5, 15, 17], village: [9, 11, 13, 14.5], suburb: [9, 10, 13, 15],
    quarter: [9, 9.5, 12, 13.5], neighbourhood: [9, 9.5, 11.5, 13], other: [9, 9.5, 11.5, 12.5] };
  const PLACE_SIZE = Z(...[6, 9, 12, 15].flatMap((z, i) => [z,
    ['match', ['get', 'class'], ...Object.entries(PS).filter(([k]) => k !== 'other').flatMap(([k, v]) => [k, v[i]]), PS.other[i]]]));
  const place = (id, classes, layout, paint) => sym(id, OSM, 'place', inn('class', ...classes),
    Object.assign({ 'text-field': ['get', 'name'], 'text-size': PLACE_SIZE, 'symbol-sort-key': RANK, 'text-max-width': 9,
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.55 }, layout), paint);
  place('place-neighbourhood', ['suburb', 'quarter', 'neighbourhood'],
    { 'text-font': ['match', ['get', 'class'], 'suburb', ['literal', F.sansSB], ['literal', F.sansM]], 'text-transform': 'uppercase',
      'text-letter-spacing': 0.1, 'text-max-width': 7, 'text-variable-anchor': ['center'], 'text-radial-offset': 0 },
    { 'text-color': '#6e5f55', 'text-halo-width': 1.6 });
  place('place-hamlet', ['hamlet', 'isolated_dwelling', 'locality', 'farm'], { 'icon-image': 'dot-hamlet', 'text-font': F.sans },
    { 'text-color': '#4a423a' });
  place('place-village', ['village'], { 'icon-image': 'dot-village', 'text-font': F.sansM }, {});
  place('place-town', ['town'], { 'icon-image': 'dot-town', 'text-font': F.sansSB }, { 'text-halo-width': 1.6 });
  place('place-city', ['city'], { 'icon-image': 'dot-city', 'text-font': F.serifB, 'text-radial-offset': 0.6 }, { 'text-halo-width': 1.8 });

  // counties, states, seas
  sym('county-label', ATL, 'county_label', null,
    { 'text-field': ['step', ['zoom'], ['upcase', ['get', 'name']], 9, ['concat', ['upcase', ['get', 'name']], '\n', ['upcase', ['get', 'suffix']]]],
      'text-font': F.sansM, 'text-size': Z(7, 9.5, 10, 12), 'text-letter-spacing': 0.22, 'text-line-height': 1.3,
      'text-max-width': 20, 'symbol-sort-key': ['-', 0, ['get', 'area']], 'text-padding': 12 },
    { 'text-color': '#8d7a92', 'text-halo-width': 1.6 }, { maxzoom: 11.5 });
  sym('ocean-label', 'labels', null, eq('k', 'sea'),
    { 'text-field': ['get', 'name'], 'text-font': F.serifI, 'text-size': ['get', 'size'], 'text-letter-spacing': 0.3,
      'text-max-width': 30, 'text-line-height': 1.4 }, { 'text-color': C.waterText, 'text-halo-color': C.waterHalo });
  sym('state-label', 'labels', null, eq('k', 'state'),
    { 'text-field': ['get', 'name'], 'text-font': F.serifB, 'text-size': Z(5, 12, 8, 19), 'text-letter-spacing': 0.35,
      'text-max-width': 30 }, { 'text-color': 'rgba(125,100,132,0.8)', 'text-halo-width': 2 }, { maxzoom: 9 });

  return {
    version: 8, name: 'Tri-State Atlas',
    glyphs: ORIGIN + '/fonts/{fontstack}/{range}.pbf',
    sources: atlasSources(opts),
    layers: L,
  };
}

// Sources shared by both styles
function atlasSources(opts) {
  const ORIGIN = location.origin;
  const abs = (u) => /^https?:/.test(u) ? u : ORIGIN + '/' + u.replace(/^\//, '');
  return {
    osm: { type: 'vector', url: 'pmtiles://' + abs(opts.osmTiles),
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
    atlas: { type: 'vector', url: 'pmtiles://' + abs('data/atlas.pmtiles?v=' + (window.ATLAS_V || '0')),
      attribution: 'Names: <a href="https://www.usgs.gov/tools/geographic-names-information-system-gnis">USGS GNIS</a> · Boundaries: US Census' },
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: 'Buildings: <a href="https://openfreemap.org">OpenFreeMap</a>' },
    dem: { type: 'raster-dem', tiles: [opts.demUrl], tileSize: 256, maxzoom: 13, encoding: 'terrarium',
      attribution: '<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>' },
    contours: { type: 'vector', tiles: [opts.contourUrl], maxzoom: 15 },
    region: { type: 'geojson', data: opts.region },
    labels: { type: 'geojson', data: opts.labels },
  };
}
