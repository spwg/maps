# Tri-State Atlas

A dense, atlas-style web map of the **200 miles around New York City**, inspired by
[Bay Atlas](https://bayatlas.vercel.app). It shows every named summit (with elevation), ridge, gap, hollow, island,
swamp, waterfall and hamlet from the USGS GNIS. Underneath that are custom OpenStreetMap tiles, relief shading,
contours, land cover and the full road, trail and water network. It has two map styles: **Atlas** (warm, imperial
units) and **Swiss** (drawn after the swisstopo national map, metric).

## Data & tiles

| File | What | Where it lives |
|---|---|---|
| `public/data/osm.pmtiles` (~640 MB) | Custom OSM basemap: water, landuse, roads, waterways, places, labels, ridge/valley lines, exit numbers | **Object storage** (not git) |
| `public/data/atlas.pmtiles` (~12 MB) | USGS GNIS names (77k), county / town / state boundaries | git |
| `public/data/search.json` (~4 MB) | Search index | git |
| `public/fonts/`, `public/lib/` | Self-hosted glyphs (PT Serif, Fira Sans Condensed), MapLibre / PMTiles / maplibre-contour | git |

Other sources are read live: AWS Terrain Tiles (hillshade, 3D and contours, generated in the browser by
`maplibre-contour`) and OpenFreeMap (building footprints at z14+ only).

### Why custom tiles

Generic basemaps thin out detail at lower zooms: minor roads appear around z12–13, and trails and tracks only at z14.
`scripts/build_osm.py` gives every feature a deliberately chosen minimum zoom. Detail that makes an atlas rich
(minor roads, tracks, trails, streams, small lakes, named places, curved ridge and valley names) arrives earlier.
Noise that bloats tiles without adding information (sidewalks, crossings, driveways, parking aisles) is dropped or
held to z14. Check tile sizes against the performance budget with
`python3 scripts/audit_tiles.py public/data/osm.pmtiles 300`.

The region is a circle around NYC (`scripts/region.py`). Region size only affects file size and build time, not how
smooth the map feels, because the browser fetches only the tiles in view.

## Deploy

The site itself is static. `vercel.json` serves `public/` with no build step.

The OSM basemap goes in object storage. A public **Cloudflare R2** bucket works well: it has no egress fees, and the
free tier covers about 10 GB of storage and about 10M reads a month.

1. Create a bucket (for example `tristate-atlas`) and enable public access (an r2.dev URL, or a custom domain for production).
2. Add a CORS rule to the bucket that allows `GET` and `HEAD` from your site's origin and exposes `ETag`. PMTiles uses
   `Range` requests.
3. Upload the file. It's over 300 MB, so use rclone or the AWS CLI against R2's S3 endpoint rather than wrangler:
   ```sh
   aws s3 cp public/data/osm.pmtiles s3://tristate-atlas/osm.pmtiles \
     --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   ```
4. Set `osmTiles` in `public/config.js` to the public URL, for example `https://pub-xxxx.r2.dev/osm.pmtiles`.

## Rebuild

```sh
pip install shapely pyshp pyproj numpy pillow orjson pmtiles
apt-get install osmium-tool
scripts/build.sh         # GNIS / boundaries / fonts / libs, then scripts/build_osm.sh for the OSM tiles
```

The OSM extracts come from the openstreetmap.fr mirror (us-northeast + us-south, about 6.5 GB) and are clipped to the circle.

Local preview (PMTiles needs HTTP range support): `npx http-server public -p 8080`.
