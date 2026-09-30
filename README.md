# Tri-State Atlas

A dense, atlas-style web map of **New York, New Jersey, Connecticut and Pennsylvania** — inspired by
[Bay Atlas](https://bayatlas.vercel.app). Every named summit (with elevation), ridge, gap, hollow, island,
swamp, waterfall and hamlet from the USGS GNIS, over relief shading, contours in feet, land cover and
the full OpenStreetMap road/trail/water network.

- **Base map:** [OpenFreeMap](https://openfreemap.org) vector tiles (OpenMapTiles schema, © OpenStreetMap contributors)
- **Names overlay:** USGS GNIS Domestic Names (~60k features) + Census county boundaries → `public/data/atlas.pmtiles`
- **Terrain:** AWS Terrain Tiles (terrarium) → hillshade, 3D terrain, and on-the-fly contours via `maplibre-contour`
- **Summit elevations:** sampled from the DEM at build time (local max within ~100 m of the GNIS point)
- **Rendering:** MapLibre GL JS with a custom style (`public/style.js`), self-hosted PT Serif / Fira Sans Condensed glyphs

## Deploy

`public/` is fully built and committed, so this is a static site — no build step on Vercel.
Import the repo in Vercel (framework preset "Other"); `vercel.json` points the output at `public/`.
Or from a terminal: `npx vercel --prod`.

## Rebuild the data

```sh
pip install shapely pyshp numpy pillow
scripts/build.sh
```

Local preview (needs HTTP range support for PMTiles): `npx http-server public -p 8080`.
