"""The map region: a circle around New York City (like Bay Atlas's 150-mile circle around the Bay)."""
import pyproj
from shapely.geometry import Point, mapping
from shapely.ops import transform

CENTER = (-73.99, 40.73)          # Manhattan
MILE_KM = 1.609344
RADIUS_MI = 200                   # the map's nominal extent
SOFT_MI = 207                     # soft fade starts
HARD_MI = 211                     # opaque mask beyond this
DATA_MI = 216                     # data is extracted a little past the mask so edges never look clipped

# 2-letter code -> Census FIPS for every state the data circle touches
STATES = {'NY': '36', 'NJ': '34', 'CT': '09', 'PA': '42', 'MA': '25', 'RI': '44', 'VT': '50', 'NH': '33',
          'DE': '10', 'MD': '24', 'DC': '11', 'VA': '51'}

_aeqd = pyproj.CRS.from_proj4(f'+proj=aeqd +lat_0={CENTER[1]} +lon_0={CENTER[0]} +units=km +datum=WGS84')
_wgs = pyproj.CRS.from_epsg(4326)
to_km = pyproj.Transformer.from_crs(_wgs, _aeqd, always_xy=True).transform
to_ll = pyproj.Transformer.from_crs(_aeqd, _wgs, always_xy=True).transform


def circle(miles, n=360):
    """Geodesic circle (true distance from NYC) as a lon/lat polygon."""
    return transform(to_ll, Point(0, 0).buffer(miles * MILE_KM, n // 4))


def ring_coords(miles, n=360):
    return [[round(x, 5), round(y, 5)] for x, y in circle(miles, n).exterior.coords]


def dist_mi(lon, lat):
    x, y = to_km(lon, lat)
    return (x * x + y * y) ** 0.5 / MILE_KM
