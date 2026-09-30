// Copy browser bundles for MapLibre, PMTiles and maplibre-contour into public/lib
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '../public/lib');
fs.mkdirSync(out, { recursive: true });
const files = {
  'maplibre-gl/dist/maplibre-gl.js': 'maplibre-gl.js',
  'maplibre-gl/dist/maplibre-gl.css': 'maplibre-gl.css',
  'pmtiles/dist/pmtiles.js': 'pmtiles.js',
  'maplibre-contour/dist/index.min.js': 'maplibre-contour.min.js',
};
for (const [src, dst] of Object.entries(files)) {
  fs.copyFileSync(path.join(__dirname, 'node_modules', src), path.join(out, dst));
  console.log(dst);
}
