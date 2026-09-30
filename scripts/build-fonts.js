// Generate MapLibre SDF glyph PBFs from TTFs (build/fonts/*.ttf -> public/fonts/<Font Name>/<range>.pbf)
const fontnik = require('../build/fonts/node_modules/fontnik');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../build/fonts');
const OUT = path.join(__dirname, '../public/fonts');
const FONTS = {
  'PT_Serif-Web-Regular.ttf': 'PT Serif Regular',
  'PT_Serif-Web-Bold.ttf': 'PT Serif Bold',
  'PT_Serif-Web-Italic.ttf': 'PT Serif Italic',
  'PT_Serif-Web-BoldItalic.ttf': 'PT Serif Bold Italic',
  'FiraSansCondensed-Regular.ttf': 'Fira Sans Condensed Regular',
  'FiraSansCondensed-Italic.ttf': 'Fira Sans Condensed Italic',
  'FiraSansCondensed-Medium.ttf': 'Fira Sans Condensed Medium',
  'FiraSansCondensed-MediumItalic.ttf': 'Fira Sans Condensed Medium Italic',
  'FiraSansCondensed-SemiBold.ttf': 'Fira Sans Condensed SemiBold',
  'FiraSansCondensed-SemiBoldItalic.ttf': 'Fira Sans Condensed SemiBold Italic',
  'FiraSansCondensed-Bold.ttf': 'Fira Sans Condensed Bold',
};
// Latin, Latin-ext, Greek/Cyrillic, general punctuation, letterlike symbols
const RANGES = [0, 256, 512, 768, 1024, 1280, 7680, 7936, 8192, 8448];
const p = (fn, ...a) => new Promise((res, rej) => fn(...a, (e, r) => (e ? rej(e) : res(r))));

(async () => {
  for (const [file, name] of Object.entries(FONTS)) {
    const buf = fs.readFileSync(path.join(SRC, file));
    const dir = path.join(OUT, name);
    fs.mkdirSync(dir, { recursive: true });
    for (const start of RANGES) {
      const f = path.join(dir, `${start}-${start + 255}.pbf`);
      fs.writeFileSync(f, await p(fontnik.range, { font: buf, start, end: start + 255 }));
    }
    console.log('glyphs', name);
  }
})();
