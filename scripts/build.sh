#!/usr/bin/env bash
# Full rebuild of public/ assets. Requires: python3 (shapely, pyshp, pyproj, numpy, pillow, orjson), node, make/g++, osmium-tool.
set -euo pipefail
cd "$(dirname "$0")/.."
scripts/fetch.sh
(cd scripts && npm i --silent && node vendor.js)
node scripts/build-fonts.js
python3 scripts/build_data.py
build/tippecanoe/tippecanoe -q -f -o public/data/atlas.pmtiles -Z4 -z13 -r1 --no-feature-limit --no-tile-size-limit \
  -n "Tri-State Atlas overlay" -A "USGS GNIS, US Census Bureau" build/names.geojsonl build/county.geojsonl
scripts/build_osm.sh     # -> public/data/osm.pmtiles (large; upload to object storage, not git)
