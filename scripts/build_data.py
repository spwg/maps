"""Build the overlay data for Tri-State Atlas.

Inputs (downloaded into build/raw by scripts/fetch.sh):
  - USGS GNIS Domestic Names for NY, NJ, CT, PA
  - Census cartographic boundary files (states, counties)
  - AWS terrain tiles (terrarium), sampled for summit elevations

Outputs:
  - build/names.geojsonl   -> tippecanoe -> public/data/atlas.pmtiles (layer "names")
  - build/county.geojsonl  -> tippecanoe -> public/data/atlas.pmtiles (layers "county", "county_label")
  - public/data/region.geojson  (outer mask + state outline)
  - public/data/search.json     (compact search index)
"""
import csv, glob, io, json, math, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import shapefile
from PIL import Image
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW = os.path.join(ROOT, 'build', 'raw')
BUILD = os.path.join(ROOT, 'build')
PUB = os.path.join(ROOT, 'public', 'data')
os.makedirs(PUB, exist_ok=True)

STATES = {'36': 'NY', '34': 'NJ', '09': 'CT', '42': 'PA'}

# ------------------------------------------------------------------ boundaries
def shapes(name, keep):
    r = shapefile.Reader(os.path.join(RAW, name))
    fields = [f[0] for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        rec = dict(zip(fields, sr.record))
        if keep(rec):
            yield rec, shape(sr.shape.__geo_interface__)

states = {rec['STUSPS']: g for rec, g in shapes('cb_2023_us_state_500k', lambda r: r['STATEFP'] in STATES)}
region = unary_union(list(states.values()))
M_PER_DEG = 111_320

def ring_coords(g, tol):
    g = g.simplify(tol, preserve_topology=True)
    polys = [g] if isinstance(g, Polygon) else list(g.geoms)
    return [[[round(x, 4), round(y, 4)] for x, y in p.exterior.coords] for p in polys if p.area > 1e-4]

inner = region.buffer(0.02).buffer(-0.01)                  # hug the coast a little
outer = region.buffer(0.12)
world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
hard = [world] + [list(reversed(r)) for r in ring_coords(outer, 0.01)]
soft_outer = ring_coords(outer, 0.01)
soft_inner = ring_coords(inner, 0.005)
region_fc = {'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'properties': {'k': 'hard'}, 'geometry': {'type': 'Polygon', 'coordinates': hard}},
    {'type': 'Feature', 'properties': {'k': 'soft'}, 'geometry': {'type': 'MultiPolygon',
        'coordinates': [[o] + [list(reversed(i)) for i in soft_inner if Polygon(i).within(Polygon(o))] for o in soft_outer]}},
]}
with open(os.path.join(PUB, 'region.geojson'), 'w') as f:
    json.dump(region_fc, f, separators=(',', ':'))
print('region: bounds', [round(v, 2) for v in region.bounds])

# counties: boundary lines + label points (planning regions for CT)
with open(os.path.join(BUILD, 'county.geojsonl'), 'w') as f:
    for rec, g in shapes('cb_2023_us_county_500k', lambda r: r['STATEFP'] in STATES):
        name = rec['NAME'] if rec['STUSPS'] != 'CT' else rec['NAMELSAD'].replace(' Planning Region', '')
        suffix = 'Planning Region' if rec['STUSPS'] == 'CT' else 'County'
        area_km2 = rec['ALAND'] / 1e6
        g2 = g.simplify(0.0005, preserve_topology=True)
        f.write(json.dumps({'type': 'Feature', 'tippecanoe': {'layer': 'county', 'minzoom': 6},
                            'properties': {'name': name}, 'geometry': mapping(g2.boundary)}) + '\n')
        pt = g.representative_point() if not g.contains(g.centroid) else g.centroid
        f.write(json.dumps({'type': 'Feature', 'tippecanoe': {'layer': 'county_label', 'minzoom': 7 if area_km2 > 600 else 8},
                            'properties': {'name': name, 'suffix': suffix, 'state': rec['STUSPS'], 'area': round(area_km2)},
                            'geometry': {'type': 'Point', 'coordinates': [round(pt.x, 5), round(pt.y, 5)]}}) + '\n')

# ------------------------------------------------------------------ GNIS
KIND = {
    'Populated Place': 'locality', 'Summit': 'peak', 'Valley': 'valley', 'Ridge': 'ridge', 'Gap': 'saddle',
    'Island': 'island', 'Cape': 'cape', 'Bay': 'bay', 'Swamp': 'swamp', 'Falls': 'waterfall', 'Spring': 'spring',
    'Cliff': 'cliff', 'Pillar': 'rock', 'Range': 'range', 'Flat': 'flat', 'Beach': 'beach', 'Bar': 'bar',
    'Basin': 'basin', 'Bend': 'bend', 'Rapids': 'rapids', 'Woods': 'woods', 'Gut': 'gut', 'Arch': 'arch',
    'Bench': 'bench', 'Slope': 'slope', 'Isthmus': 'isthmus', 'Plain': 'flat', 'Crossing': 'crossing',
    'Military': 'military', 'Lake': 'lake', 'Reservoir': 'lake', 'Stream': 'stream', 'Canal': 'canal',
    'Channel': 'channel', 'Sea': 'sea', 'Area': 'area', 'Levee': 'levee',
}
# classes that get labels from GNIS (lakes, streams etc. already come from OSM geometry)
LABELLED = {'locality', 'peak', 'valley', 'ridge', 'saddle', 'island', 'cape', 'bay', 'swamp', 'waterfall', 'spring',
            'cliff', 'rock', 'range', 'flat', 'beach', 'bar', 'basin', 'bend', 'rapids', 'woods', 'gut', 'arch',
            'bench', 'slope', 'isthmus', 'channel'}
MINZOOM = {'range': 8, 'valley': 10, 'ridge': 10, 'island': 10, 'bay': 10, 'swamp': 11, 'cape': 11, 'saddle': 11,
           'locality': 11, 'waterfall': 11, 'channel': 11, 'beach': 12, 'cliff': 12, 'flat': 12, 'basin': 12,
           'woods': 12, 'rock': 12, 'bar': 12, 'gut': 12, 'rapids': 12, 'isthmus': 12, 'arch': 12,
           'spring': 13, 'bend': 13, 'bench': 13, 'slope': 13}

rows = []
seen = set()
for fn in sorted(glob.glob(os.path.join(RAW, 'Text', 'DomesticNames_*.txt'))):
    for r in csv.DictReader(open(fn, encoding='utf-8-sig'), delimiter='|'):
        if r['state_numeric'] not in STATES:
            continue
        name = r['feature_name'].strip()
        if '(historical)' in name or not name:
            continue
        kind = KIND.get(r['feature_class'])
        if not kind:
            continue
        try:
            lat, lon = float(r['prim_lat_dec']), float(r['prim_long_dec'])
        except ValueError:
            continue
        if lat == 0 or lon == 0:
            continue
        key = (name, kind, round(lon, 3), round(lat, 3))
        if key in seen:
            continue
        seen.add(key)
        rows.append({'id': int(r['feature_id']), 'name': name, 'kind': kind, 'lon': lon, 'lat': lat,
                     'county': r['county_name'], 'state': STATES[r['state_numeric']]})
print('gnis rows', len(rows))

# ------------------------------------------------------------------ summit elevations from terrarium DEM
Z = 12
TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
CACHE = os.path.join(BUILD, 'dem')
os.makedirs(CACHE, exist_ok=True)

def tile_px(lon, lat, z=Z):
    n = 2 ** z * 256
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def load_tile(xy):
    x, y = xy
    p = os.path.join(CACHE, f'{Z}_{x}_{y}.npy')
    if os.path.exists(p):
        return xy, np.load(p)
    for attempt in range(4):
        try:
            data = urllib.request.urlopen(TILE_URL.format(z=Z, x=x, y=y), timeout=60).read()
            break
        except Exception:
            if attempt == 3:
                raise
    a = np.asarray(Image.open(io.BytesIO(data)).convert('RGB')).astype(np.float32)
    ele = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    np.save(p, ele.astype(np.float32))
    return xy, ele

peaks = [r for r in rows if r['kind'] in ('peak', 'saddle')]
need = set()
for r in peaks:
    px, py = tile_px(r['lon'], r['lat'])
    for dx in (-4, 0, 4):
        for dy in (-4, 0, 4):
            need.add((int((px + dx) // 256), int((py + dy) // 256)))
print('dem tiles', len(need))
tiles = {}
with ThreadPoolExecutor(16) as ex:
    for i, (xy, ele) in enumerate(ex.map(load_tile, sorted(need))):
        tiles[xy] = ele

def sample(lon, lat, radius):
    px, py = tile_px(lon, lat)
    vals = []
    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            if dx * dx + dy * dy > radius * radius:
                continue
            X, Y = int(px) + dx, int(py) + dy
            t = tiles.get((X // 256, Y // 256))
            if t is not None:
                vals.append(t[Y % 256, X % 256])
    return vals

for r in peaks:
    # GNIS summit points are often a little off the true top; take the local max (~100 m radius at z12)
    v = sample(r['lon'], r['lat'], 4 if r['kind'] == 'peak' else 0)
    if v:
        m = max(v) if r['kind'] == 'peak' else v[0]
        r['ele'] = round(float(m))
        r['ele_ft'] = round(float(m) * 3.28084)

def peak_minzoom(ft):
    return 8 if ft >= 3500 else 9 if ft >= 2500 else 10 if ft >= 1600 else 11 if ft >= 800 else 12

# ------------------------------------------------------------------ write names layer + search index
search = []
with open(os.path.join(BUILD, 'names.geojsonl'), 'w') as f:
    for r in rows:
        kind = r['kind']
        if kind == 'peak':
            ele_ft = r.get('ele_ft', 0)
            rank = -ele_ft
            mz = peak_minzoom(ele_ft)
        else:
            rank = {'range': -9000, 'valley': -500, 'ridge': -400, 'island': -300, 'bay': -300}.get(kind, 0)
            mz = MINZOOM.get(kind, 13)
        search.append([r['name'], kind, round(r['lon'], 5), round(r['lat'], 5), rank, r['state']])
        if kind not in LABELLED:
            continue
        props = {'name': r['name'], 'kind': kind, 'rank': rank, 'county': r['county'], 'state': r['state']}
        if 'ele_ft' in r:
            props['ele'] = r['ele']
            props['ele_ft'] = r['ele_ft']
        f.write(json.dumps({'type': 'Feature', 'tippecanoe': {'layer': 'names', 'minzoom': mz},
                            'properties': props,
                            'geometry': {'type': 'Point', 'coordinates': [round(r['lon'], 6), round(r['lat'], 6)]}}) + '\n')

# counties in search too
for rec, g in shapes('cb_2023_us_county_500k', lambda r: r['STATEFP'] in STATES):
    pt = g.representative_point()
    nm = rec['NAMELSAD']
    search.append([nm, 'county', round(pt.x, 5), round(pt.y, 5), -20000, rec['STUSPS']])

search.sort(key=lambda s: s[4])
with open(os.path.join(PUB, 'search.json'), 'w') as f:
    json.dump(search, f, separators=(',', ':'), ensure_ascii=False)
print('search entries', len(search))
