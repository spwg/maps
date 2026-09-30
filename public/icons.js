// Canvas-drawn map symbols (peaks, dots, route shields). Drawn at 2x for crisp rendering on high-DPI screens.
function installIcons(map) {
  const R = 2;
  function draw(id, w, h, fn, opts = {}) {
    if (map.hasImage(id)) return;
    const c = document.createElement('canvas');
    c.width = w * R; c.height = h * R;
    const g = c.getContext('2d');
    g.scale(R, R);
    fn(g, w, h);
    map.addImage(id, g.getImageData(0, 0, w * R, h * R), Object.assign({ pixelRatio: R }, opts));
  }
  const tri = (fill, s) => (g, w, h) => {
    g.beginPath(); g.moveTo(w / 2, 1); g.lineTo(w - 1, h - 1); g.lineTo(1, h - 1); g.closePath();
    g.fillStyle = fill; g.fill();
    g.lineWidth = 1; g.strokeStyle = 'rgba(251,249,243,0.9)'; g.stroke();
  };
  draw('peak', 9, 8, tri('#5b4029'));
  draw('peak-sm', 7, 6, tri('#6b4d31'));
  draw('saddle', 10, 8, (g) => {
    g.strokeStyle = '#6b4d31'; g.lineWidth = 1.3;
    g.beginPath(); g.arc(-1, 4, 4.2, -0.9, 0.9); g.stroke();
    g.beginPath(); g.arc(11, 4, 4.2, Math.PI - 0.9, Math.PI + 0.9); g.stroke();
  });
  const dot = (id, r, fill, stroke, sw = 1) => draw(id, r * 2 + 4, r * 2 + 4, (g, w, h) => {
    g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    g.fillStyle = fill; g.fill();
    if (stroke) { g.lineWidth = sw; g.strokeStyle = stroke; g.stroke(); }
  });
  dot('dot-city', 3.6, '#fff', '#2a2521', 1.6);
  dot('dot-town', 2.8, '#2a2521', 'rgba(251,249,243,0.9)', 1);
  dot('dot-village', 2.0, '#3d3630', 'rgba(251,249,243,0.9)', 0.8);
  dot('dot-hamlet', 1.5, '#6a5f55', null);
  dot('dot-water', 2.2, '#3e6d96', 'rgba(220,235,245,0.9)', 0.8);
  dot('dot-poi', 2.2, '#8b6a4f', 'rgba(251,249,243,0.9)', 0.8);
  draw('capital', 12, 12, (g) => {
    g.beginPath(); g.arc(6, 6, 4.8, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.lineWidth = 1.4; g.strokeStyle = '#2a2521'; g.stroke();
    const s = 2.6; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.45 : s; g.lineTo(6 + rr * Math.cos(a), 6 + rr * Math.sin(a)); }
    g.closePath(); g.fillStyle = '#b1382a'; g.fill();
  });
  draw('waterfall', 10, 10, (g) => {
    g.strokeStyle = '#3e6d96'; g.lineWidth = 1.2;
    for (const x of [3, 5, 7]) { g.beginPath(); g.moveTo(x, 1.5); g.bezierCurveTo(x + 1, 4, x - 1, 6, x, 9); g.stroke(); }
  });
  draw('spring', 9, 9, (g) => {
    g.beginPath(); g.arc(4.5, 4.5, 3, 0, Math.PI * 2); g.fillStyle = '#e8f1f7'; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = '#3e6d96'; g.stroke();
  });
  draw('cliff', 12, 6, (g) => {
    g.strokeStyle = '#6b4d31'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(1, 1.5); g.lineTo(11, 1.5); g.stroke();
    for (let x = 2; x <= 10; x += 2) { g.beginPath(); g.moveTo(x, 1.5); g.lineTo(x, 5); g.stroke(); }
  });

  // Route shields, stretchable around the ref text
  const shield = (id, w, h, fn, pad) => draw(id, w, h, fn, {
    stretchX: [[pad[0] * R, (w - pad[2]) * R]], stretchY: [[pad[1] * R, (h - pad[3]) * R]],
    content: [pad[0] * R, pad[1] * R, (w - pad[2]) * R, (h - pad[3]) * R],
  });
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  shield('shield-interstate', 22, 18, (g) => {
    rr(g, 1, 1, 20, 16, 4); g.fillStyle = '#2f5e9e'; g.fill();
    g.save(); g.clip(); g.fillStyle = '#b8352c'; g.fillRect(0, 0, 22, 5); g.restore();
    rr(g, 1, 1, 20, 16, 4); g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke();
  }, [6, 5, 6, 3]);
  shield('shield-us', 20, 18, (g) => {
    rr(g, 1, 1, 18, 16, 5); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#2a2521'; g.stroke();
  }, [6, 4, 6, 4]);
  shield('shield-state', 20, 16, (g) => {
    rr(g, 1, 1, 18, 14, 7); g.fillStyle = '#2f6b4a'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke();
  }, [7, 3, 7, 3]);
  shield('shield-other', 20, 16, (g) => {
    rr(g, 1, 1, 18, 14, 3); g.fillStyle = '#f6f3ea'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#7a6f63'; g.stroke();
  }, [6, 3, 6, 3]);

  // Fallback for any sprite the style references that we haven't drawn
  map.on('styleimagemissing', (e) => {
    if (map.hasImage(e.id)) return;
    map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
}
