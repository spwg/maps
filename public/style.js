// Tri-State Atlas map style — a dense, atlas-inspired cartographic style for NY / NJ / CT / PA.
// Base data: OpenMapTiles schema served by OpenFreeMap. Overlay: USGS GNIS names + Census counties (data/atlas.pmtiles).
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
    halo: 'rgba(251,249,243,0.92)', text: '#2a2521', muted: '#6a5f55',
    park: '#cfe4b8', wood: '#dce8cb', grass: '#e7eed2', farmland: '#f2efdc', wetland: '#d6e7de', sand: '#f4ead0',
    rock: '#e7e3dc', ice: '#f5f9fb', residential: '#ede7dc', commercial: '#f0e0d8', industrial: '#e8e2e8',
    military: '#f1dcd6', cemetery: '#d9e4cf', school: '#f1e8d2', hospital: '#f4dfdc', airport: '#e8e5ec',
    stadium: '#e6e0d0', quarry: '#e2ddd6', building: '#ddd4c6', buildingLine: '#cbbfae',
    peak: '#5b4029', relief: '#7c5e40', parkText: '#3b6b2b', boundary: '#9f86a1',
    motorway: '#d9794f', motorwayCase: '#9c4a2c', trunk: '#e8a15e', trunkCase: '#a4683a',
    primary: '#f2c56c', primaryCase: '#a88540', secondary: '#f7e0a0', secondaryCase: '#b59f68',
    minor: '#ffffff', minorCase: '#c9bfae', path: '#8a5a3a', rail: '#7a6f63',
  };
  const Z = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];
  const E = (...stops) => ['interpolate', ['exponential', 1.55], ['zoom'], ...stops];
  const eq = (k, v) => ['==', ['get', k], v];
  const inn = (k, ...vs) => ['in', ['get', k], ['literal', vs]];
  const all = (...xs) => ['all', ...xs];
  const NAME = ['coalesce', ['get', 'name:en'], ['get', 'name']];
  const OMT = 'omt', ATL = 'atlas';
  const L = [];
  const add = (l) => { L.push(l); return l; };
  const sym = (id, source, srcLayer, filter, layout, paint, extra = {}) => add(Object.assign({
    id, type: 'symbol', source, ...(srcLayer ? { 'source-layer': srcLayer } : {}), ...(filter ? { filter } : {}),
    layout: Object.assign({ 'text-padding': 1, 'text-max-width': 8, 'icon-padding': 0 }, layout),
    paint: Object.assign({ 'text-color': C.text, 'text-halo-color': C.halo, 'text-halo-width': 1.4, 'text-halo-blur': 0.3 }, paint),
  }, extra));

  // ---------------------------------------------------------------- base fills
  add({ id: 'background', type: 'background', paint: { 'background-color': C.land } });
  const cover = (id, filter, color, opacity = 1, minzoom = 0) => add({
    id, type: 'fill', source: OMT, 'source-layer': 'landcover', minzoom, filter,
    paint: { 'fill-color': color, 'fill-opacity': opacity },
  });
  cover('lu-farmland', eq('class', 'farmland'), C.farmland);
  cover('lu-grass', all(eq('class', 'grass'), ['!', inn('subclass', 'park', 'garden', 'golf_course')]), C.grass);
  cover('lu-wood', eq('class', 'wood'), C.wood, Z(5, 0.7, 10, 1));
  cover('lu-wetland', eq('class', 'wetland'), C.wetland);
  cover('lu-sand', eq('class', 'sand'), C.sand);
  cover('lu-rock', eq('class', 'rock'), C.rock);
  cover('lu-ice', eq('class', 'ice'), C.ice);
  cover('lu-parkgrass', inn('subclass', 'park', 'garden'), C.park);
  cover('lu-golf', eq('subclass', 'golf_course'), '#d3e7bf');
  add({ id: 'lu-wetland-pattern', type: 'line', source: OMT, 'source-layer': 'landcover', minzoom: 11, filter: eq('class', 'wetland'),
    paint: { 'line-color': '#8fb8a6', 'line-width': 0.6, 'line-dasharray': [1, 2], 'line-opacity': 0.8 } });

  const use = (id, classes, color, opacity = 1, minzoom = 0) => add({
    id, type: 'fill', source: OMT, 'source-layer': 'landuse', minzoom, filter: inn('class', ...classes),
    paint: { 'fill-color': color, 'fill-opacity': opacity },
  });
  use('lu-residential', ['residential', 'suburb', 'quarter', 'neighbourhood'], C.residential, Z(6, 0.5, 11, 0.85, 14, 0.6));
  use('lu-commercial', ['commercial', 'retail'], C.commercial, Z(9, 0.5, 12, 1));
  use('lu-industrial', ['industrial', 'garages', 'dam', 'railway'], C.industrial, Z(9, 0.5, 12, 1));
  use('lu-quarry', ['quarry'], C.quarry);
  use('lu-military', ['military'], C.military, 0.8);
  use('lu-cemetery', ['cemetery'], C.cemetery);
  use('lu-school', ['school', 'university', 'college', 'kindergarten', 'library'], C.school);
  use('lu-hospital', ['hospital'], C.hospital);
  use('lu-stadium', ['stadium', 'pitch', 'track', 'playground'], C.stadium);
  use('lu-zoo', ['zoo', 'theme_park'], '#e3ebcf');

  // parks & protected land
  add({ id: 'lu-park', type: 'fill', source: OMT, 'source-layer': 'park',
    paint: { 'fill-color': '#cfe4b8', 'fill-opacity': Z(5, 0.5, 9, 0.55, 13, 0.45) } });
  add({ id: 'lu-park-line', type: 'line', source: OMT, 'source-layer': 'park', minzoom: 8,
    paint: { 'line-color': '#8db478', 'line-width': Z(8, 0.6, 12, 1.4, 15, 2.2), 'line-opacity': 0.65, 'line-dasharray': [3, 1.5] } });
  add({ id: 'lu-military-line', type: 'line', source: OMT, 'source-layer': 'landuse', minzoom: 10,
    filter: eq('class', 'military'), paint: { 'line-color': '#c99a90', 'line-width': 0.8, 'line-dasharray': [4, 2] } });
  add({ id: 'lu-airport', type: 'fill', source: OMT, 'source-layer': 'aeroway', filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': C.airport } });

  // ---------------------------------------------------------------- relief
  add({ id: 'hillshade', type: 'hillshade', source: 'dem', maxzoom: 17,
    paint: { 'hillshade-exaggeration': Z(5, 0.5, 9, 0.42, 12, 0.32, 15, 0.22), 'hillshade-shadow-color': '#5b4a3b',
      'hillshade-highlight-color': 'rgba(255,253,245,0.9)', 'hillshade-accent-color': '#7c6a58',
      'hillshade-illumination-direction': 315 } });
  add({ id: 'contour-minor', type: 'line', source: 'contours', 'source-layer': 'contours', filter: ['!=', ['get', 'level'], 1],
    paint: { 'line-color': '#a8875f', 'line-width': Z(9, 0.35, 14, 0.6), 'line-opacity': Z(9, 0.2, 12, 0.3) } });
  add({ id: 'contour-major', type: 'line', source: 'contours', 'source-layer': 'contours', filter: ['==', ['get', 'level'], 1],
    paint: { 'line-color': '#9a7650', 'line-width': Z(9, 0.6, 14, 1.1), 'line-opacity': Z(9, 0.3, 12, 0.45) } });

  // ---------------------------------------------------------------- water
  add({ id: 'water', type: 'fill', source: OMT, 'source-layer': 'water', filter: ['!=', ['get', 'brunnel'], 'tunnel'],
    paint: { 'fill-color': C.water } });
  add({ id: 'water-edge', type: 'line', source: OMT, 'source-layer': 'water', minzoom: 9, filter: ['!=', ['get', 'class'], 'swimming_pool'],
    paint: { 'line-color': C.waterLine, 'line-width': Z(9, 0.4, 14, 1), 'line-opacity': 0.7 } });
  add({ id: 'waterway-intermittent', type: 'line', source: OMT, 'source-layer': 'waterway', minzoom: 11, filter: eq('intermittent', 1),
    paint: { 'line-color': C.waterLine, 'line-width': Z(11, 0.5, 15, 1.2), 'line-dasharray': [3, 2] } });
  add({ id: 'waterway-stream', type: 'line', source: OMT, 'source-layer': 'waterway', minzoom: 9,
    filter: all(inn('class', 'stream', 'ditch', 'drain'), ['!=', ['get', 'intermittent'], 1]),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': C.waterLine, 'line-width': Z(9, 0.35, 12, 0.8, 15, 1.6), 'line-opacity': Z(9, 0.6, 12, 1) } });
  add({ id: 'waterway-river', type: 'line', source: OMT, 'source-layer': 'waterway', filter: inn('class', 'river', 'canal'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': C.waterLine, 'line-width': Z(6, 0.6, 10, 1.3, 14, 3) } });

  // ---------------------------------------------------------------- airports, buildings
  add({ id: 'aeroway-runway', type: 'line', source: OMT, 'source-layer': 'aeroway', minzoom: 10,
    filter: all(['==', ['geometry-type'], 'LineString'], eq('class', 'runway')),
    paint: { 'line-color': '#c4bfcc', 'line-width': E(10, 1, 14, 8, 17, 40) } });
  add({ id: 'aeroway-taxiway', type: 'line', source: OMT, 'source-layer': 'aeroway', minzoom: 12,
    filter: all(['==', ['geometry-type'], 'LineString'], eq('class', 'taxiway')),
    paint: { 'line-color': '#d2cdd8', 'line-width': E(12, 0.5, 17, 10) } });
  add({ id: 'building', type: 'fill', source: OMT, 'source-layer': 'building', minzoom: 13,
    paint: { 'fill-color': C.building, 'fill-outline-color': C.buildingLine, 'fill-opacity': Z(13, 0.5, 15, 1) } });

  // ---------------------------------------------------------------- roads
  const ROAD = OMT;
  const cls = (...c) => inn('class', ...c);
  const notBrunnel = ['!', inn('brunnel', 'bridge', 'tunnel')];
  // width stops per class; casings add a zoom-dependent margin at the same stops
  const W = {
    motorway: [5, 0.8, 9, 1.8, 12, 3.2, 14, 6, 17, 20],
    trunk: [5, 0.6, 9, 1.4, 12, 2.8, 14, 5, 17, 18],
    primary: [6, 0.4, 9, 1.1, 12, 2.4, 14, 4.5, 17, 16],
    secondary: [8, 0.4, 10, 0.9, 12, 1.9, 14, 3.8, 17, 14],
    tertiary: [9, 0.4, 12, 1.5, 14, 3.2, 17, 12],
    minor: [11, 0.3, 13, 0.9, 14, 2.4, 17, 10],
    service: [13, 0.4, 15, 1.2, 17, 5],
    track: [11, 0.5, 14, 0.9, 17, 2],
    path: [12, 0.5, 15, 1, 17, 2],
  };
  const caseMargin = (z) => z <= 8 ? 0.6 : z >= 14 ? 1.6 : 0.6 + (z - 8) / 6;
  const widthExpr = (stops, casing) => E(...stops.map((v, i) => (i % 2 && casing) ? v + caseMargin(stops[i - 1]) : v));
  const roadGroup = (suffix, brunnelFilter, caseColorOverride) => {
    const mk = (id, filter, stops, color, casing, caseColor, minzoom, dash) => {
      const width = widthExpr(stops, false);
      if (casing) add({ id: `road-${id}-case${suffix}`, type: 'line', source: ROAD, 'source-layer': 'transportation', minzoom,
        filter: all(filter, brunnelFilter), layout: { 'line-cap': suffix ? 'butt' : 'round', 'line-join': 'round' },
        paint: { 'line-color': caseColorOverride || caseColor, 'line-width': widthExpr(stops, true),
          ...(suffix === '-tunnel' ? { 'line-dasharray': [2, 1.5] } : {}) } });
      add({ id: `road-${id}${suffix}`, type: 'line', source: ROAD, 'source-layer': 'transportation', minzoom,
        filter: all(filter, brunnelFilter), layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': width, ...(dash ? { 'line-dasharray': dash } : {}),
          ...(suffix === '-tunnel' ? { 'line-opacity': 0.6 } : {}) } });
    };
    mk('path', all(cls('path'), ['!', inn('subclass', 'footway', 'pedestrian', 'steps', 'cycleway')]), W.path, C.path, false, null, 12, [2.5, 1.5]);
    mk('footway', all(cls('path'), inn('subclass', 'footway', 'pedestrian', 'steps', 'cycleway')), W.path, '#9e8c7a', false, null, 14, [1.5, 1.2]);
    mk('track', cls('track'), W.track, '#9a7a5a', false, null, 11, [4, 1.5]);
    mk('service', cls('service'), W.service, C.minor, true, C.minorCase, 13);
    mk('minor', cls('minor'), W.minor, C.minor, true, C.minorCase, 11);
    mk('tertiary', cls('tertiary'), W.tertiary, '#fffaf0', true, C.minorCase, 9);
    mk('secondary', cls('secondary'), W.secondary, C.secondary, true, C.secondaryCase, 8);
    mk('primary', cls('primary'), W.primary, C.primary, true, C.primaryCase, 6);
    mk('trunk', cls('trunk'), W.trunk, C.trunk, true, C.trunkCase, 5);
    mk('motorway', cls('motorway'), W.motorway, C.motorway, true, C.motorwayCase, 5);
  };
  roadGroup('-tunnel', eq('brunnel', 'tunnel'), '#b8ad9d');
  roadGroup('', notBrunnel);
  add({ id: 'rail', type: 'line', source: ROAD, 'source-layer': 'transportation', minzoom: 8,
    filter: all(cls('rail'), ['!', inn('service', 'yard', 'siding', 'spur')], ['!=', ['get', 'brunnel'], 'tunnel']),
    paint: { 'line-color': C.rail, 'line-width': Z(8, 0.6, 14, 1.4) } });
  add({ id: 'rail-hatch', type: 'line', source: ROAD, 'source-layer': 'transportation', minzoom: 12,
    filter: all(cls('rail'), ['!', inn('service', 'yard', 'siding', 'spur')], ['!=', ['get', 'brunnel'], 'tunnel']),
    paint: { 'line-color': C.rail, 'line-width': Z(12, 3, 16, 6), 'line-dasharray': [0.2, 3] } });
  add({ id: 'transit', type: 'line', source: ROAD, 'source-layer': 'transportation', minzoom: 12,
    filter: all(cls('transit'), ['!=', ['get', 'brunnel'], 'tunnel']),
    paint: { 'line-color': '#8a7fa0', 'line-width': Z(12, 0.8, 16, 1.8) } });
  add({ id: 'ferry', type: 'line', source: ROAD, 'source-layer': 'transportation', minzoom: 9, filter: cls('ferry'),
    paint: { 'line-color': '#5a86ad', 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.8 } });
  roadGroup('-bridge', eq('brunnel', 'bridge'), '#6d6158');

  // ---------------------------------------------------------------- boundaries
  add({ id: 'bnd-county', type: 'line', source: ATL, 'source-layer': 'county', minzoom: 7,
    paint: { 'line-color': C.boundary, 'line-width': Z(7, 0.6, 12, 1.4), 'line-dasharray': [5, 2, 1, 2], 'line-opacity': 0.75 } });
  add({ id: 'bnd-state-halo', type: 'line', source: OMT, 'source-layer': 'boundary', filter: all(eq('admin_level', 4), ['!=', ['get', 'maritime'], 1]),
    paint: { 'line-color': '#d9cfe0', 'line-width': Z(5, 2, 10, 6), 'line-opacity': 0.6 } });
  add({ id: 'bnd-state', type: 'line', source: OMT, 'source-layer': 'boundary', filter: all(eq('admin_level', 4), ['!=', ['get', 'maritime'], 1]),
    paint: { 'line-color': '#7d6484', 'line-width': Z(5, 0.8, 10, 1.6), 'line-dasharray': [6, 2, 1.5, 2] } });

  // ---------------------------------------------------------------- mask outside region
  add({ id: 'mask-soft', type: 'fill', source: 'region', filter: eq('k', 'soft'), paint: { 'fill-color': '#ebe6da', 'fill-opacity': 0.35 } });
  add({ id: 'mask-hard', type: 'fill', source: 'region', filter: eq('k', 'hard'), paint: { 'fill-color': '#ebe6da', 'fill-opacity': 0.72 } });

  // ================================================================ labels
  sym('contour-label', 'contours', 'contours', ['==', ['get', 'level'], 1],
    { 'symbol-placement': 'line', 'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ''], 'text-font': F.sansI,
      'text-size': Z(12, 9, 15, 10.5), 'symbol-spacing': 360, 'text-max-angle': 25, 'text-padding': 4 },
    { 'text-color': '#8e6d49', 'text-halo-width': 1.6 }, { minzoom: 12 });

  // waterways
  sym('waterway-name', OMT, 'waterway', inn('class', 'river', 'canal', 'stream'),
    { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': F.sansI, 'symbol-spacing': 320, 'text-max-angle': 30,
      'text-size': Z(9, ['match', ['get', 'class'], 'river', 10.5, 8.5], 13, ['match', ['get', 'class'], 'river', 13, 10.5], 15, ['match', ['get', 'class'], 'river', 14, 11.5]), 'text-letter-spacing': 0.04 },
    { 'text-color': C.waterText, 'text-halo-color': C.waterHalo }, { minzoom: 10 });

  // water bodies
  sym('water-name-lake', OMT, 'water_name', all(['!', inn('class', 'ocean', 'sea', 'bay', 'strait')], ['==', ['geometry-type'], 'Point']),
    { 'text-field': NAME, 'text-font': F.serifI, 'text-size': Z(8, 10, 13, 13), 'text-max-width': 7 },
    { 'text-color': C.waterText, 'text-halo-color': C.waterHalo }, { minzoom: 8 });
  sym('water-name-lake-line', OMT, 'water_name', all(['!', inn('class', 'ocean', 'sea')], ['==', ['geometry-type'], 'LineString']),
    { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': F.serifI, 'text-size': Z(8, 10, 13, 14), 'text-letter-spacing': 0.1 },
    { 'text-color': C.waterText, 'text-halo-color': C.waterHalo }, { minzoom: 7 });
  sym('water-name-bay', OMT, 'water_name', all(inn('class', 'bay', 'strait'), ['==', ['geometry-type'], 'Point']),
    { 'text-field': NAME, 'text-font': F.serifI, 'text-size': Z(7, 10.5, 12, 14), 'text-letter-spacing': 0.06 },
    { 'text-color': C.waterText, 'text-halo-color': C.waterHalo }, { minzoom: 7 });

  // road names & shields
  sym('road-name-minor', OMT, 'transportation_name', cls('minor', 'service', 'tertiary', 'track', 'path'),
    { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': F.sans, 'text-size': Z(13, 9.5, 16, 12), 'symbol-spacing': 280,
      'text-max-angle': 30 }, { 'text-color': '#4a423a', 'text-halo-width': 1.6 }, { minzoom: 13 });
  sym('road-name-major', OMT, 'transportation_name', cls('primary', 'secondary', 'trunk', 'motorway'),
    { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': F.sansM, 'text-size': Z(11, 10, 16, 13), 'symbol-spacing': 360,
      'text-max-angle': 30 }, { 'text-color': '#3d3630', 'text-halo-width': 1.7 }, { minzoom: 11 });
  const shieldImage = ['match', ['get', 'network'], 'us-interstate', 'shield-interstate', 'us-highway', 'shield-us', 'us-state', 'shield-state', 'shield-other'];
  sym('road-shield', OMT, 'transportation_name',
    all(['has', 'ref'], ['<=', ['get', 'ref_length'], 5], cls('motorway', 'trunk', 'primary', 'secondary')),
    { 'symbol-placement': 'line', 'symbol-spacing': Z(7, 180, 12, 420), 'icon-image': shieldImage, 'icon-text-fit': 'both',
      'icon-rotation-alignment': 'viewport', 'text-rotation-alignment': 'viewport', 'text-field': ['get', 'ref'],
      'text-font': F.sansB, 'text-size': Z(7, 9, 12, 10.5), 'text-padding': 4, 'icon-padding': 2,
      'symbol-sort-key': ['match', ['get', 'network'], 'us-interstate', 0, 'us-highway', 1, 2] },
    { 'text-color': ['match', ['get', 'network'], 'us-interstate', '#fff', 'us-state', '#fff', '#2a2521'], 'text-halo-width': 0 },
    { minzoom: 7 });

  // parks
  sym('park-label', OMT, 'park', all(['has', 'name'], ['==', ['geometry-type'], 'Point']),
    { 'text-field': NAME, 'text-font': F.sansI, 'text-size': Z(8, 10, 12, 12.5, 15, 14), 'text-max-width': 8,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] }, { 'text-color': C.parkText, 'text-halo-width': 1.5 }, { minzoom: 8 });
  sym('landcover-park-label', OMT, 'poi', all(inn('class', 'park', 'golf', 'cemetery', 'garden', 'campsite'), ['has', 'name']),
    { 'text-field': NAME, 'text-font': F.sansI, 'text-size': 11.5, 'text-max-width': 8, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] },
    { 'text-color': C.parkText }, { minzoom: 14 });

  // GNIS physical features (valleys, ridges, gaps, islands, capes, swamps, falls, springs…)
  const G = (id, kinds, layout, paint, extra) => sym(id, ATL, 'names', inn('kind', ...kinds),
    Object.assign({ 'text-field': ['get', 'name'], 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] }, layout), paint, extra);
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

  // summits: name + elevation in feet
  G('gnis-peak', ['peak'], {
    'icon-image': ['step', ['zoom'], ['case', ['>=', ['coalesce', ['get', 'ele_ft'], 0], 2500], 'peak', 'peak-sm'], 12, 'peak'],
    'text-field': ['step', ['zoom'], ['get', 'name'], 10,
      ['format', ['get', 'name'], { 'text-font': ['literal', F.serifBI] }, '\n', {},
        ['case', ['has', 'ele_ft'], ['number-format', ['get', 'ele_ft'], { locale: 'en-US' }], ''], { 'font-scale': 0.78, 'text-font': ['literal', F.sansI] }]],
    'text-font': F.serifBI, 'text-size': Z(8, 10, 12, 11.5, 15, 13), 'text-anchor': 'top', 'text-offset': [0, 0.45],
    'text-line-height': 1.05, 'text-max-width': 7, 'icon-allow-overlap': false, 'text-optional': false,
  }, { 'text-color': C.peak, 'text-halo-width': 1.5 });

  // POIs (z14+)
  sym('poi', OMT, 'poi', all(['has', 'name'], ['<=', ['get', 'rank'], 25],
    inn('class', 'attraction', 'museum', 'castle', 'monument', 'college', 'hospital', 'stadium', 'zoo', 'lighthouse',
      'campsite', 'town_hall', 'library', 'railway', 'harbor', 'ferry_terminal', 'theatre', 'aquarium', 'art_gallery',
      'school', 'place_of_worship', 'golf', 'viewpoint', 'ruins', 'fort')),
    { 'icon-image': 'dot-poi', 'text-field': NAME, 'text-font': F.sans, 'text-size': 11, 'text-anchor': 'left',
      'text-offset': [0.6, 0], 'text-max-width': 9, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] },
    { 'text-color': '#6b5641' }, { minzoom: 14 });
  sym('airport-label', OMT, 'aerodrome_label', ['has', 'name'],
    { 'text-field': ['step', ['zoom'], ['coalesce', ['get', 'iata'], ''], 11, NAME], 'text-font': F.sansSB, 'text-size': Z(9, 10, 13, 12),
      'text-max-width': 9 }, { 'text-color': '#56506a' }, { minzoom: 9 });

  // GNIS localities (hamlets, crossroads, subdivisions) — below OSM places in priority
  G('gnis-locality', ['locality'], { 'icon-image': 'dot-hamlet', 'text-font': F.sans, 'text-size': Z(11, 10, 14, 12),
    'text-anchor': 'left', 'text-offset': [0.55, 0], 'text-max-width': 9, 'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
    'text-radial-offset': 0.55 }, { 'text-color': '#4a423a' });

  // OSM places
  const PS = { city: [12, 15, 20, 24], town: [10, 12.5, 15, 17], village: [9, 11, 13, 14.5], suburb: [9, 10, 13, 15],
    quarter: [9, 9.5, 12, 13.5], neighbourhood: [9, 9.5, 11.5, 13], other: [9, 9.5, 11.5, 12.5] };
  const PLACE_SIZE = Z(...[6, 9, 12, 15].flatMap((z, i) => [z,
    ['match', ['get', 'class'], ...Object.entries(PS).filter(([k]) => k !== 'other').flatMap(([k, v]) => [k, v[i]]), PS.other[i]]]));
  sym('place-neighbourhood', OMT, 'place', inn('class', 'suburb', 'quarter', 'neighbourhood'),
    { 'text-field': NAME, 'text-font': ['match', ['get', 'class'], 'suburb', ['literal', F.sansSB], ['literal', F.sansM]],
      'text-size': PLACE_SIZE, 'text-transform': 'uppercase', 'text-letter-spacing': 0.1, 'text-max-width': 7,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] }, { 'text-color': '#6e5f55', 'text-halo-width': 1.6 }, { minzoom: 11 });
  sym('place-hamlet', OMT, 'place', inn('class', 'hamlet', 'isolated_dwelling', 'locality', 'farm'),
    { 'icon-image': 'dot-hamlet', 'text-field': NAME, 'text-font': F.sans, 'text-size': PLACE_SIZE, 'text-anchor': 'left',
      'text-offset': [0.55, 0], 'text-max-width': 9, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.55 },
    { 'text-color': '#4a423a' }, { minzoom: 11 });
  sym('place-village', OMT, 'place', eq('class', 'village'),
    { 'icon-image': 'dot-village', 'text-field': NAME, 'text-font': F.sansM, 'text-size': PLACE_SIZE,
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.5, 'text-max-width': 9,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] }, {}, { minzoom: 9 });
  sym('place-town', OMT, 'place', eq('class', 'town'),
    { 'icon-image': 'dot-town', 'text-field': NAME, 'text-font': F.sansSB, 'text-size': PLACE_SIZE,
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.55, 'text-max-width': 9,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] }, { 'text-halo-width': 1.6 }, { minzoom: 7 });
  sym('place-city', OMT, 'place', eq('class', 'city'),
    { 'icon-image': ['case', ['has', 'capital'], 'capital', 'dot-city'], 'text-field': NAME, 'text-font': F.serifB,
      'text-size': PLACE_SIZE, 'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.6,
      'text-max-width': 9, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] }, { 'text-halo-width': 1.8 }, { minzoom: 5 });

  // counties & states
  sym('county-label', ATL, 'county_label', null,
    { 'text-field': ['step', ['zoom'], ['upcase', ['get', 'name']], 9, ['concat', ['upcase', ['get', 'name']], '\n', ['upcase', ['get', 'suffix']]]],
      'text-font': F.sansM, 'text-size': Z(7, 9.5, 10, 12), 'text-letter-spacing': 0.22, 'text-line-height': 1.3,
      'text-max-width': 20, 'symbol-sort-key': ['-', 0, ['get', 'area']], 'text-padding': 12 },
    { 'text-color': '#8d7a92', 'text-halo-width': 1.6 }, { maxzoom: 11.5 });
  sym('ocean-label', 'labels', null, eq('k', 'sea'),
    { 'text-field': ['get', 'name'], 'text-font': F.serifI, 'text-size': ['get', 'size'], 'text-letter-spacing': 0.3,
      'text-max-width': 30, 'text-line-height': 1.4 }, { 'text-color': C.waterText, 'text-halo-color': C.waterHalo },
    { minzoom: 5 });
  sym('state-label', 'labels', null, eq('k', 'state'),
    { 'text-field': ['get', 'name'], 'text-font': F.serifB, 'text-size': Z(5, 12, 8, 20), 'text-letter-spacing': 0.35,
      'text-max-width': 30 }, { 'text-color': 'rgba(125,100,132,0.8)', 'text-halo-width': 2 }, { minzoom: 5, maxzoom: 9 });

  return {
    version: 8,
    name: 'Tri-State Atlas',
    glyphs: ORIGIN + '/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet',
        attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
      atlas: { type: 'vector', url: 'pmtiles://' + ORIGIN + '/data/atlas.pmtiles',
        attribution: 'Names: <a href="https://www.usgs.gov/tools/geographic-names-information-system-gnis">USGS GNIS</a> · Counties: US Census' },
      dem: { type: 'raster-dem', tiles: [opts.demUrl], tileSize: 256, maxzoom: 13, encoding: 'terrarium',
        attribution: '<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>' },
      contours: { type: 'vector', tiles: [opts.contourUrl], maxzoom: 15 },
      region: { type: 'geojson', data: opts.region },
      labels: { type: 'geojson', data: opts.labels },
    },
    layers: L,
  };
}
