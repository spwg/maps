// Deployment config. The large OSM basemap (osm.pmtiles, ~500 MB) is not in git: upload it to object storage
// (e.g. a public Cloudflare R2 bucket with CORS allowing GET/HEAD + Range) and point osmTiles at it.
window.ATLAS_CONFIG = {
  osmTiles: 'data/osm.pmtiles',
};
