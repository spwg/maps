"""Classify OpenStreetMap features into the Tri-State Atlas tile schema.

Input: build/osm/e_{roads,water,land,labels}.geojsonl (osmium export, see scripts/build_osm.sh)
Output: build/osm/t_*.geojsonl with per-feature tippecanoe layer + minzoom, ready for tippecanoe.

Density strategy: every feature gets a deliberately chosen minzoom (earlier than generic basemaps for the
things that make an atlas rich - minor roads, tracks, trails, streams, small lakes, named places) while
noise that bloats tiles without adding information (sidewalks, crossings, driveways, parking aisles)
is dropped or held to z14.

Layers
  water      polygons  class: ocean|lake|reservoir|river|pond                     inter
  landuse    polygons  class: wood|scrub|grass|farmland|orchard|vineyard|wetland|sand|rock|residential|
                              commercial|industrial|cemetery|park|golf|stadium|school|hospital|military|
                              airport|apron|pier|quarry|protected|prison|zoo           pc (protect class)
  road       lines     class: motorway|trunk|primary|secondary|tertiary|minor|service|track|path|
                              pedestrian|rail|light|subway|ferry|runway|taxiway
                       name, link, bridge, tunnel, layer, net (i|us|st|cr|x), num, rough, minor (service detail)
  waterway   lines     class: river|canal|stream|drain                             name, inter
  place      points    class, name, pop, rank
  label      points    kind, name, rank, ele, ele_ft, iata, sub, size
  label_line lines     kind: ridge|valley|cliff|arete, name, rank
  junction   points    ref
"""
import math, os, sys
import orjson
from shapely.geometry import shape, mapping

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OSM = os.path.join(ROOT, 'build', 'osm')
KM2 = 111.32 ** 2


def feats(name):
    with open(os.path.join(OSM, f'e_{name}.geojsonl'), 'rb') as f:
        for line in f:
            yield orjson.loads(line)


class Out:
    def __init__(self, name):
        self.f = open(os.path.join(OSM, f't_{name}.geojsonl'), 'wb')
        self.n = 0

    def write(self, layer, minzoom, props, geom):
        props = {k: v for k, v in props.items() if v is not None and v != ''}
        self.f.write(orjson.dumps({'type': 'Feature', 'tippecanoe': {'layer': layer, 'minzoom': int(minzoom)},
                                   'properties': props, 'geometry': geom}) + b'\n')
        self.n += 1


def area_km2(g):
    try:
        s = shape(g)
        c = s.centroid
        return s.area * KM2 * math.cos(math.radians(c.y)), s
    except Exception:
        return 0, None


def label_point(s):
    try:
        p = s.representative_point() if not s.contains(s.centroid) else s.centroid
        return {'type': 'Point', 'coordinates': [round(p.x, 6), round(p.y, 6)]}
    except Exception:
        return None


def by_area(a, table):
    for thresh, z in table:
        if a >= thresh:
            return z
    return table[-1][1] + 1


def yes(v):
    return v in ('yes', '1', 'true')


def num(v):
    try:
        return float(str(v).replace(',', '').split(';')[0].split(' ')[0])
    except Exception:
        return None


# ------------------------------------------------------------------ GNIS dedupe index (names already shown via overlay)
GNIS = {}
try:
    with open(os.path.join(ROOT, 'build', 'names.geojsonl'), 'rb') as f:
        for line in f:
            j = orjson.loads(line)
            n = j['properties']['name'].lower()
            GNIS.setdefault(n, []).append(j['geometry']['coordinates'])
except FileNotFoundError:
    pass


def in_gnis(name, x, y, tol=0.012):
    for gx, gy in GNIS.get(name.lower(), ()):
        if abs(gx - x) < tol and abs(gy - y) < tol:
            return True
    return False


# ------------------------------------------------------------------ roads
ROAD_MZ = {'motorway': 4, 'trunk': 5, 'primary': 7, 'secondary': 8, 'tertiary': 9,
           'unclassified': 10, 'residential': 11, 'living_street': 12, 'road': 12}
LINK_MZ = {'motorway': 9, 'trunk': 10, 'primary': 11, 'secondary': 12, 'tertiary': 12}
STATE_NETS = {'NY', 'NJ', 'PA', 'CT', 'MA', 'VT', 'RI', 'DE', 'MD', 'OH', 'WV', 'SR'}
SKIP_FOOT = {'sidewalk', 'crossing', 'traffic_island', 'access_aisle', 'link'}


def shield(ref):
    if not ref:
        return None, None
    first = ref.split(';')[0].strip()
    parts = first.replace('-', ' ').split()
    if len(parts) >= 2:
        pre, n = parts[0].upper(), parts[1]
        if pre == 'I':
            return 'i', n
        if pre == 'US':
            return 'us', n
        if pre in STATE_NETS:
            return 'st', n
        if pre in ('CR', 'CO'):
            return 'cr', n
    if len(first) <= 5:
        return 'x', first
    return None, None


def roads(out):
    for j in feats('roads'):
        p, g = j['properties'], j['geometry']
        gt = g['type']
        if gt == 'Point':
            if p.get('highway') == 'motorway_junction' and p.get('ref'):
                out.write('junction', 12, {'ref': p['ref'][:8]}, g)
            continue
        if gt not in ('LineString', 'MultiLineString'):
            continue
        h, rw = p.get('highway'), p.get('railway')
        props = {'name': p.get('name')}
        if p.get('bridge') and p.get('bridge') != 'no':
            props['bridge'] = 1
        if p.get('tunnel') and p.get('tunnel') != 'no' or p.get('covered') == 'yes' and h:
            props['tunnel'] = 1
        lay = num(p.get('layer'))
        if lay and lay != 0:
            props['layer'] = int(max(-5, min(5, lay)))
        mz = None
        if h:
            base = h[:-5] if h.endswith('_link') else h
            if base in ROAD_MZ:
                cls = base if base in ('motorway', 'trunk', 'primary', 'secondary', 'tertiary') else 'minor'
                props['class'] = cls
                if h.endswith('_link'):
                    props['link'] = 1
                    mz = LINK_MZ.get(base, 12)
                else:
                    mz = ROAD_MZ[base]
                net, n = shield(p.get('ref'))
                if net and base in ('motorway', 'trunk', 'primary', 'secondary', 'tertiary') and not h.endswith('_link'):
                    props['net'], props['num'] = net, n
            elif h == 'service':
                s = p.get('service')
                if s in ('emergency_access',):
                    continue
                props['class'] = 'service'
                if s in ('driveway', 'parking_aisle', 'drive-through'):
                    props['minor'] = 1
                    mz = 14
                else:
                    mz = 13
                if not p.get('name'):
                    props.pop('name', None)
            elif h == 'track':
                props['class'] = 'track'
                mz = 11
                if p.get('tracktype') in ('grade3', 'grade4', 'grade5') or p.get('4wd_only') == 'yes':
                    props['rough'] = 1
            elif h in ('path', 'footway', 'bridleway', 'cycleway', 'steps'):
                if p.get('footway') in SKIP_FOOT or p.get('path') in SKIP_FOOT:
                    continue
                if p.get('access') in ('private', 'no'):
                    continue
                props['class'] = 'path'
                trail = h in ('path', 'bridleway') or p.get('sac_scale') or p.get('trail_visibility')
                if p.get('name') and trail:
                    mz = 11
                elif trail:
                    mz = 12
                elif h == 'cycleway':
                    mz = 12
                elif h == 'steps':
                    mz = 14
                else:
                    mz = 13
                if p.get('sac_scale') and p['sac_scale'] not in ('hiking',):
                    props['rough'] = 1
            elif h == 'pedestrian':
                props['class'] = 'pedestrian'
                mz = 13
            else:
                continue
        elif rw:
            svc = p.get('service')
            if rw in ('rail', 'narrow_gauge'):
                props['class'] = 'rail'
                mz = 13 if svc in ('yard', 'siding', 'spur', 'crossover') else 7
                if svc:
                    props['minor'] = 1
            elif rw in ('light_rail', 'tram'):
                props['class'] = 'light'
                mz = 10
            elif rw == 'subway':
                props['class'] = 'subway'
                mz = 11
            else:
                continue
            if p.get('usage') in ('industrial',) and mz < 10:
                mz = 10
        elif p.get('route') == 'ferry':
            props['class'] = 'ferry'
            mz = 7
        elif p.get('aeroway') in ('runway', 'taxiway'):
            props['class'] = p['aeroway']
            mz = 10 if p['aeroway'] == 'runway' else 12
        else:
            continue
        if p.get('access') in ('private', 'no') and props['class'] in ('minor', 'service', 'track'):
            mz = max(mz, 13)
        out.write('road', mz, props, g)


# ------------------------------------------------------------------ water & waterways
WATER_AREA = [(40, 0), (5, 6), (1, 8), (0.1, 9), (0.02, 10), (0.004, 11), (0.001, 12), (0, 13)]
LAKE_LABEL = [(40, 7), (5, 8), (1, 10), (0.2, 11), (0.03, 12), (0.005, 13), (0, 14)]


def waters(out, labels_out):
    for j in feats('water'):
        p, g = j['properties'], j['geometry']
        gt = g['type']
        ww = p.get('waterway')
        if gt in ('LineString', 'MultiLineString'):
            if ww in ('river', 'canal', 'stream', 'drain', 'ditch'):
                cls = 'drain' if ww == 'ditch' else ww
                named = bool(p.get('name'))
                mz = {'river': 6, 'canal': 8, 'stream': 10 if named else 11, 'drain': 13}[cls]
                props = {'class': cls, 'name': p.get('name')}
                if p.get('intermittent') == 'yes' or p.get('seasonal') == 'yes':
                    props['inter'] = 1
                if p.get('tunnel') in ('culvert', 'yes'):
                    continue
                out.write('waterway', mz, props, g)
            elif p.get('natural') in ('bay', 'strait') and p.get('name'):
                labels_out.write('label_line', 9, {'kind': p['natural'], 'name': p['name'], 'rank': 5}, g)
            continue
        if gt == 'Point':
            if p.get('natural') in ('bay', 'strait') and p.get('name'):
                labels_out.write('label', 10, {'kind': p['natural'], 'name': p['name'], 'rank': 20}, g)
            continue
        if gt not in ('Polygon', 'MultiPolygon'):
            continue
        nat, wt = p.get('natural'), p.get('water')
        if nat == 'wetland':
            continue  # handled in landuse
        a, s = area_km2(g)
        if nat in ('bay', 'strait'):
            if p.get('name') and s is not None:
                lp = label_point(s)
                if lp:
                    labels_out.write('label', by_area(a, [(100, 6), (10, 8), (1, 10), (0, 12)]),
                                     {'kind': nat, 'name': p['name'], 'rank': int(20 - min(19, math.log10(a + 1) * 6)),
                                      'size': 2 if a > 50 else 1 if a > 5 else 0}, lp)
            continue
        if ww in ('dam', 'weir', 'lock_gate'):
            continue
        if ww == 'riverbank' or wt in ('river', 'canal', 'stream', 'oxbow'):
            cls = 'river'
        elif p.get('landuse') in ('reservoir', 'basin') or wt in ('reservoir', 'basin'):
            cls = 'reservoir'
        elif wt in ('pond', 'lagoon'):
            cls = 'pond'
        else:
            cls = 'lake'
        if p.get('landuse') == 'basin' and a < 0.01:
            continue
        props = {'class': cls}
        if p.get('intermittent') == 'yes':
            props['inter'] = 1
        out.write('water', by_area(a, WATER_AREA), props, g)
        if p.get('name') and cls != 'river' and s is not None:
            lp = label_point(s)
            if lp:
                labels_out.write('label', by_area(a, LAKE_LABEL),
                                 {'kind': 'lake', 'name': p['name'], 'rank': int(40 - min(39, math.log10(a * 1000 + 1) * 7)),
                                  'size': 2 if a > 20 else 1 if a > 1 else 0}, lp)


# ------------------------------------------------------------------ landuse
LAND_CLASS = {
    ('landuse', 'forest'): 'wood', ('natural', 'wood'): 'wood', ('natural', 'scrub'): 'scrub', ('natural', 'heath'): 'scrub',
    ('natural', 'grassland'): 'grass', ('landuse', 'grass'): 'grass', ('landuse', 'meadow'): 'grass',
    ('landuse', 'village_green'): 'park', ('landuse', 'recreation_ground'): 'park',
    ('landuse', 'farmland'): 'farmland', ('landuse', 'farmyard'): 'farmland', ('landuse', 'orchard'): 'orchard',
    ('landuse', 'vineyard'): 'vineyard', ('natural', 'wetland'): 'wetland', ('natural', 'sand'): 'sand',
    ('natural', 'beach'): 'sand', ('natural', 'bare_rock'): 'rock', ('natural', 'scree'): 'rock',
    ('natural', 'shingle'): 'rock', ('natural', 'glacier'): 'ice',
    ('landuse', 'residential'): 'residential', ('landuse', 'commercial'): 'commercial', ('landuse', 'retail'): 'commercial',
    ('landuse', 'industrial'): 'industrial', ('landuse', 'railway'): 'industrial', ('landuse', 'garages'): 'industrial',
    ('landuse', 'port'): 'industrial', ('landuse', 'cemetery'): 'cemetery', ('amenity', 'grave_yard'): 'cemetery',
    ('leisure', 'park'): 'park', ('leisure', 'garden'): 'park', ('leisure', 'playground'): 'park',
    ('leisure', 'golf_course'): 'golf', ('leisure', 'pitch'): 'stadium', ('leisure', 'stadium'): 'stadium',
    ('amenity', 'school'): 'school', ('amenity', 'university'): 'school', ('amenity', 'college'): 'school',
    ('landuse', 'education'): 'school', ('amenity', 'hospital'): 'hospital', ('landuse', 'military'): 'military',
    ('military', '*'): 'military', ('aeroway', 'aerodrome'): 'airport', ('aeroway', 'apron'): 'apron',
    ('man_made', 'pier'): 'pier', ('landuse', 'quarry'): 'quarry', ('amenity', 'prison'): 'prison',
    ('tourism', 'zoo'): 'zoo', ('tourism', 'theme_park'): 'zoo', ('leisure', 'marina'): 'commercial',
    ('boundary', 'protected_area'): 'protected', ('boundary', 'national_park'): 'protected',
    ('leisure', 'nature_reserve'): 'protected', ('landuse', 'conservation'): 'protected',
}
ORDER = ['boundary', 'leisure', 'amenity', 'aeroway', 'tourism', 'man_made', 'military', 'natural', 'landuse']
LAND_AREA = [(50, 4), (8, 6), (2, 7), (0.5, 8), (0.1, 9), (0.03, 10), (0.008, 11), (0.002, 12), (0, 13)]
PARK_LABEL = [(100, 7), (20, 8), (4, 9), (1, 10), (0.2, 11), (0.03, 12), (0.005, 13), (0, 14)]
LABEL_KINDS = {'park': 'park', 'protected': 'park', 'golf': 'golf', 'cemetery': 'cemetery', 'school': 'college',
               'hospital': 'hospital', 'military': 'military', 'prison': 'prison', 'zoo': 'zoo', 'stadium': 'stadium',
               'airport': 'airport', 'wood': 'woods', 'wetland': 'swamp'}


def land_class(p):
    for k in ORDER:
        v = p.get(k)
        if v is None:
            continue
        c = LAND_CLASS.get((k, v)) or LAND_CLASS.get((k, '*'))
        if c:
            return c
    return None


def lands(out, labels_out):
    for j in feats('land'):
        p, g = j['properties'], j['geometry']
        if g['type'] not in ('Polygon', 'MultiPolygon'):
            if p.get('man_made') == 'pier' and g['type'] == 'LineString':
                out.write('road', 13, {'class': 'pier'}, g)
            continue
        cls = land_class(p)
        if not cls:
            continue
        if cls == 'protected' and p.get('boundary') == 'protected_area' and p.get('protect_class') in ('21', '22', '23', '24', '25', '26', '27', '28', '29', '97', '98', '99'):
            continue  # cultural / water-protection "protected areas" - not open space
        a, s = area_km2(g)
        if a <= 0:
            continue
        mz = by_area(a, LAND_AREA)
        if cls == 'residential':
            mz = max(mz, 8)
        if cls in ('stadium', 'pier', 'apron') and mz < 11:
            mz = 11
        props = {'class': cls}
        if cls == 'protected' and p.get('protect_class'):
            props['pc'] = p['protect_class']
        out.write('landuse', mz, props, g)
        name = p.get('name')
        kind = LABEL_KINDS.get(cls)
        if name and kind and s is not None:
            if kind in ('woods', 'swamp') and a < 0.5:
                continue
            lp = label_point(s)
            if lp:
                lab_mz = by_area(a, PARK_LABEL)
                if kind == 'airport':
                    lab_mz = min(lab_mz, 11 if p.get('iata') is None else 8)
                props = {'kind': kind, 'name': name, 'rank': int(60 - min(59, math.log10(a * 1000 + 1) * 10))}
                if p.get('iata'):
                    props['iata'] = p['iata']
                labels_out.write('label', lab_mz, props, lp)


# ------------------------------------------------------------------ places & point labels
PLACE_MZ = {'city': 5, 'town': 7, 'village': 9, 'suburb': 10, 'hamlet': 11, 'quarter': 11, 'neighbourhood': 12,
            'locality': 12, 'isolated_dwelling': 13, 'farm': 13}
PLACE_BASE = {'city': 0, 'town': 1000, 'village': 2000, 'suburb': 2500, 'hamlet': 3000, 'quarter': 3500,
              'neighbourhood': 4000, 'locality': 5000, 'isolated_dwelling': 6000, 'farm': 6500}


def poi_kind(p):
    n = p.get('natural')
    if n in ('peak', 'hill'):
        return 'peak' if n == 'peak' else 'hill', 12
    if n == 'saddle': return 'saddle', 12
    if n == 'spring': return 'spring', 13
    if n == 'cave_entrance': return 'cave', 13
    if n in ('rock', 'stone'): return 'rock', 13
    if n == 'cape': return 'cape', 11
    if n == 'beach': return 'beach', 12
    if n in ('island', 'islet') or p.get('place') in ('island', 'islet'): return 'island', 11
    if p.get('waterway') == 'waterfall': return 'waterfall', 12
    t = p.get('tourism')
    if t == 'viewpoint': return 'viewpoint', 13
    if t == 'camp_site': return 'camp', 12
    if t == 'museum': return 'museum', 13
    if t == 'attraction': return 'attraction', 13
    if t in ('zoo', 'theme_park'): return ('zoo' if t == 'zoo' else 'themepark'), 11
    if t == 'aquarium': return 'aquarium', 12
    h = p.get('historic')
    if h == 'lighthouse' or p.get('man_made') == 'lighthouse': return 'lighthouse', 11
    if h in ('castle', 'fort', 'battlefield', 'ship', 'monument', 'ruins', 'archaeological_site', 'memorial'):
        return 'historic', 12 if h in ('castle', 'fort', 'battlefield') else 13
    if p.get('man_made') == 'observatory': return 'observatory', 12
    am = p.get('amenity')
    if am in ('university', 'college'): return am, 11
    if am == 'hospital': return 'hospital', 12
    if am == 'prison': return 'prison', 12
    if am == 'library': return 'library', 14
    if am == 'townhall': return 'townhall', 13
    if am == 'courthouse': return 'courthouse', 13
    if am == 'ferry_terminal': return 'ferry', 12
    if p.get('aeroway') == 'aerodrome': return 'airport', 8 if p.get('iata') else 11
    if p.get('railway') == 'station':
        st = p.get('station')
        if st == 'subway': return 'station', 13
        if st in ('light_rail', 'tram'): return 'station', 13
        return 'station', 11
    if p.get('leisure') == 'stadium': return 'stadium', 12
    if p.get('leisure') == 'golf_course': return 'golf', 12
    if p.get('leisure') == 'marina': return 'marina', 13
    if p.get('craft') == 'winery' or p.get('landuse') == 'winery': return 'winery', 12
    return None, None


LINE_KINDS = {'ridge': 'ridge', 'arete': 'ridge', 'valley': 'valley', 'cliff': 'cliff'}


def labels(out):
    dup = 0
    for j in feats('labels'):
        p, g = j['properties'], j['geometry']
        gt = g['type']
        name = p.get('name')
        nat = p.get('natural')
        # ridge / valley / cliff lines (named -> curved labels; unnamed cliffs -> hatching)
        if gt in ('LineString', 'MultiLineString'):
            kind = LINE_KINDS.get(nat)
            if kind:
                try:
                    length_km = shape(g).length * 111.32 * 0.8
                except Exception:
                    length_km = 0
                if name:
                    mz = 9 if length_km > 12 else 10 if length_km > 5 else 11 if length_km > 2 else 12
                    out.write('label_line', mz, {'kind': kind, 'name': name, 'rank': int(20 - min(19, length_km))}, g)
                elif kind == 'cliff':
                    out.write('label_line', 13, {'kind': 'cliff'}, g)
            continue
        if gt == 'Point':
            pt = g
            a = 0
        elif gt in ('Polygon', 'MultiPolygon'):
            if nat in ('valley', 'ridge') and name:  # area-mapped valley: label at its point
                pass
            a, s = area_km2(g)
            pt = label_point(s) if s is not None else None
            if not pt:
                continue
        else:
            continue
        x, y = pt['coordinates']
        pl = p.get('place')
        if pl in PLACE_MZ and gt == 'Point':
            if not name:
                continue
            pop = num(p.get('population')) or 0
            mz = PLACE_MZ[pl]
            if pl == 'city' and pop and pop < 50000:
                mz = 6
            if pl == 'town' and pop > 30000:
                mz = 6
            if pl == 'village' and pop > 5000:
                mz = 8
            rank = PLACE_BASE[pl] + (999 - min(999, int(math.log10(pop + 1) * 150)))
            out.write('place', mz, {'class': pl, 'name': name, 'pop': int(pop) if pop else None, 'rank': rank}, pt)
            continue
        if not name:
            continue
        kind, mz = poi_kind(p)
        if not kind:
            if nat in ('valley', 'ridge'):
                kind, mz = nat, 11
            else:
                continue
        if kind in ('peak', 'hill', 'saddle', 'cape', 'island', 'waterfall', 'spring', 'valley', 'ridge', 'rock', 'beach') and in_gnis(name, x, y):
            dup += 1
            continue
        props = {'kind': kind, 'name': name, 'rank': 50}
        if kind in ('peak', 'hill', 'saddle'):
            e = num(p.get('ele'))
            if e and 0 < e < 2000:
                props['ele'] = round(e)
                props['ele_ft'] = round(e * 3.28084)
                props['rank'] = int(-e / 10)
        if kind == 'island' and a:
            mz = by_area(a, [(50, 8), (5, 9), (0.5, 10), (0.05, 11), (0, 12)])
            props['rank'] = int(40 - min(39, math.log10(a * 1000 + 1) * 7))
        if kind == 'airport':
            if p.get('iata'):
                props['iata'] = p['iata']
                props['rank'] = 5
            if p.get('aerodrome:type') == 'private' or p.get('access') == 'private':
                mz = 12
        if kind == 'station':
            st = p.get('station') or ('subway' if p.get('subway') == 'yes' else 'rail')
            props['sub'] = 'subway' if st == 'subway' else 'light' if st in ('light_rail', 'tram') else 'rail'
            props['rank'] = 30
        if kind in ('university', 'college') and a > 0.3:
            mz = 10
        out.write('label', mz, props, pt)
    print('  osm labels skipped as GNIS duplicates:', dup)


# ------------------------------------------------------------------ ocean (coastline-derived polygons from osmdata.openstreetmap.de)
def ocean(out):
    import shapefile
    sys.path.insert(0, os.path.dirname(__file__))
    import region
    clip = region.circle(region.DATA_MI)
    bbox = clip.bounds
    r = shapefile.Reader(os.path.join(OSM, 'water-polygons-split-4326', 'water_polygons'))
    for sh in r.iterShapes(bbox=bbox):
        g = shape(sh.__geo_interface__).intersection(clip)
        if not g.is_empty:
            out.write('water', 0, {'class': 'ocean'}, mapping(g))


if __name__ == '__main__':
    what = sys.argv[1:] or ['roads', 'water', 'land', 'labels', 'ocean']
    for w in what:
        out = Out(w)
        if w == 'roads':
            roads(out)
        elif w == 'water':
            waters(out, out)
        elif w == 'land':
            lands(out, out)
        elif w == 'labels':
            labels(out)
        elif w == 'ocean':
            ocean(out)
        print(w, out.n, 'features')
