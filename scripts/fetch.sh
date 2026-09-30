#!/usr/bin/env bash
# Download raw inputs into build/raw and build/fonts, and build tippecanoe.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/raw build/fonts
cd build/raw
for s in NY NJ CT PA; do
  curl -sSfO "https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_${s}_Text.zip"
  unzip -o -q "DomesticNames_${s}_Text.zip"
done
for f in state county; do
  curl -sSfO "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_${f}_500k.zip"
  unzip -o -q "cb_2023_us_${f}_500k.zip"
done
cd ../fonts
B=https://raw.githubusercontent.com/google/fonts/main/ofl
for f in ptserif/PT_Serif-Web-{Regular,Bold,Italic,BoldItalic} \
         firasanscondensed/FiraSansCondensed-{Regular,Italic,Medium,MediumItalic,SemiBold,SemiBoldItalic,Bold}; do
  curl -sSfO "$B/$f.ttf"
done
[ -f package.json ] || npm init -y >/dev/null
npm i --silent fontnik
cd ..
[ -x tippecanoe/tippecanoe ] || { git clone -q --depth 1 https://github.com/felt/tippecanoe.git && make -C tippecanoe -j8; }
