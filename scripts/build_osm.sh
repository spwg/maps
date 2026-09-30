#!/usr/bin/env bash
# Build the custom OSM basemap tiles (public/data/osm.pmtiles is NOT committed; upload it to object storage).
# Needs: osmium-tool, python3 (orjson, shapely, pyshp, pyproj), build/tippecanoe (see scripts/fetch.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
O=build/osm
mkdir -p $O
MIRROR=https://download.openstreetmap.fr/extracts/north-america
for r in us-northeast us-south; do
  [ -f $O/$r.osm.pbf ] || [ -f $O/clip-$r.osm.pbf ] || curl -sSf -o $O/$r.osm.pbf $MIRROR/$r-latest.osm.pbf
done
[ -f $O/water-polygons-split-4326/water_polygons.shp ] || { curl -sSf -o $O/wp.zip https://osmdata.openstreetmap.de/download/water-polygons-split-4326.zip && unzip -o -q $O/wp.zip -d $O && rm $O/wp.zip; }

# clip polygon = the data circle
python3 -c "
import json, sys; sys.path.insert(0, 'scripts'); import region
json.dump({'type': 'Feature', 'properties': {}, 'geometry': {'type': 'Polygon', 'coordinates': [region.ring_coords(region.DATA_MI)]}}, open('$O/clip.geojson', 'w'))"
for r in us-northeast us-south; do
  if [ ! -f $O/clip-$r.osm.pbf ]; then
    osmium extract -p $O/clip.geojson -s smart --overwrite -o $O/clip-$r.osm.pbf $O/$r.osm.pbf
    rm $O/$r.osm.pbf
  fi
done
# the two extracts overlap along the PA/MD/DE borders with differing object versions; merge, then keep only the
# newest version of each object (time-filter treats the merged file as history)
if [ ! -f $O/region.osm.pbf ]; then   # delete region.osm.pbf to force a re-merge
  osmium merge --overwrite -o $O/merged.osm.pbf $O/clip-us-northeast.osm.pbf $O/clip-us-south.osm.pbf
  osmium time-filter -O -o $O/region.osm.pbf $O/merged.osm.pbf
  rm $O/merged.osm.pbf
fi

osmium tags-filter -O -o $O/f_roads.osm.pbf $O/region.osm.pbf w/highway w/railway=rail,light_rail,subway,tram,narrow_gauge \
  w/route=ferry w/aeroway=runway,taxiway n/highway=motorway_junction
osmium tags-filter -O -o $O/f_water.osm.pbf $O/region.osm.pbf wr/natural=water,bay,strait wr/waterway wr/landuse=reservoir,basin
osmium tags-filter -O -o $O/f_land.osm.pbf $O/region.osm.pbf wr/landuse \
  wr/natural=wood,scrub,grassland,heath,sand,beach,bare_rock,scree,glacier,shingle,wetland \
  wr/leisure=park,nature_reserve,golf_course,pitch,stadium,garden,playground,marina \
  wr/amenity=school,university,college,hospital,grave_yard,prison wr/boundary=protected_area,national_park \
  wr/aeroway=aerodrome,apron wr/man_made=pier wr/military wr/tourism=zoo,theme_park
osmium tags-filter -O -o $O/f_labels.osm.pbf $O/region.osm.pbf n/place \
  nwr/natural=peak,hill,saddle,spring,cave_entrance,cliff,ridge,valley,arete,rock,stone,cape,island,islet,beach \
  nwr/place=island,islet nwr/waterway=waterfall nwr/tourism=attraction,museum,viewpoint,camp_site,zoo,theme_park,aquarium \
  nwr/historic=monument,memorial,castle,fort,ruins,lighthouse,battlefield,ship,archaeological_site \
  nwr/man_made=lighthouse,observatory nwr/amenity=university,college,hospital,prison,library,townhall,courthouse,ferry_terminal \
  nwr/aeroway=aerodrome nwr/railway=station nwr/leisure=stadium,golf_course,marina nwr/craft=winery nwr/landuse=winery

for f in roads water land labels; do
  osmium export -c scripts/osmium-export.json -f geojsonseq -x print_record_separator=false -i sparse_file_array \
    -O -o $O/e_$f.geojsonl $O/f_$f.osm.pbf &
done
wait
for w in roads water land labels ocean; do python3 scripts/build_osm.py $w & done
wait
rm -f $O/e_*.geojsonl

# lines: merge touching segments with identical attributes; polygons: keep shared borders consistent.
# -S4 --simplify-only-low-zooms: ~0.5 device px tolerance below z14 (default is ~1/16 px), full detail at z14.
T=build/tippecanoe/tippecanoe
$T -q -f -o $O/lines.pmtiles -P -Z4 -z14 -r1 --no-feature-limit --no-tile-size-limit --coalesce --reorder \
  --simplification=4 --simplify-only-low-zooms -n lines $O/t_roads.geojsonl
$T -q -f -o $O/base.pmtiles -P -Z0 -z14 -r1 --no-feature-limit --no-tile-size-limit --detect-shared-borders \
  --simplification=4 --simplify-only-low-zooms --no-tiny-polygon-reduction-at-maximum-zoom -n base $O/t_water.geojsonl $O/t_land.geojsonl $O/t_ocean.geojsonl
$T -q -f -o $O/labels.pmtiles -P -Z4 -z14 -r1 --no-feature-limit --no-tile-size-limit -n labels $O/t_labels.geojsonl
build/tippecanoe/tile-join -q -f --no-tile-size-limit -n 'Tri-State Atlas' \
  -A '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' \
  -o public/data/osm.pmtiles $O/base.pmtiles $O/lines.pmtiles $O/labels.pmtiles
ls -la public/data/osm.pmtiles
