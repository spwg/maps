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

  // Fill / line patterns (tile seamlessly)
  draw('pat-marsh', 16, 12, (g) => {
    g.strokeStyle = 'rgba(62,120,110,0.55)'; g.lineWidth = 0.8;
    for (const [x, y] of [[4, 4], [12, 10]]) {
      g.beginPath(); g.moveTo(x - 2.5, y); g.lineTo(x + 2.5, y);
      for (const dx of [-1.6, 0, 1.6]) { g.moveTo(x + dx * 0.6, y); g.lineTo(x + dx, y - 2.4); }
      g.stroke();
    }
  });
  draw('pat-orchard', 10, 10, (g) => {
    g.fillStyle = 'rgba(110,140,80,0.5)';
    for (const [x, y] of [[2.5, 2.5], [7.5, 7.5]]) { g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill(); }
  });
  draw('pat-vineyard', 8, 8, (g) => {
    g.strokeStyle = 'rgba(140,100,120,0.45)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0, 4); g.lineTo(8, 4); g.stroke();
    g.fillStyle = 'rgba(140,100,120,0.55)'; g.beginPath(); g.arc(4, 4, 1, 0, Math.PI * 2); g.fill();
  });
  draw('pat-rock', 12, 12, (g) => {
    g.fillStyle = 'rgba(120,105,90,0.35)';
    for (const [x, y] of [[2, 3], [8, 2], [5, 7], [10, 9], [2, 10]]) { g.beginPath(); g.arc(x, y, 0.7, 0, Math.PI * 2); g.fill(); }
  });
  // cliff hatching: line along the middle with teeth on the downhill (right-hand) side
  draw('pat-cliff', 6, 10, (g) => {
    g.strokeStyle = '#6b4d31'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(0, 3.5); g.lineTo(6, 3.5); g.stroke();
    g.lineWidth = 0.9; g.beginPath(); g.moveTo(3, 3.5); g.lineTo(3, 8.5); g.stroke();
  });
  draw('pat-cliff-swiss', 5, 10, (g) => {
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(0, 3.5); g.lineTo(5, 3.5); g.stroke();
    g.lineWidth = 0.7; g.beginPath(); g.moveTo(2.5, 3.5); g.lineTo(2.5, 8); g.stroke();
  });

  // Swiss-theme symbols (drawn in the manner of the national map, not copied)
  draw('sw-peak', 8, 7, (g) => { g.beginPath(); g.moveTo(4, 0.5); g.lineTo(7.5, 6.5); g.lineTo(0.5, 6.5); g.closePath(); g.fillStyle = '#1b243e'; g.fill(); });
  draw('sw-hill', 6, 6, (g) => { g.beginPath(); g.moveTo(3, 0.5); g.lineTo(5.5, 5); g.lineTo(0.5, 5); g.closePath(); g.lineWidth = 1; g.strokeStyle = '#1b243e'; g.stroke(); });
  dot('sw-town', 2.6, '#202020', '#fff', 0.8);
  dot('sw-city', 3.4, '#fff', '#202020', 1.6);
  draw('sw-station', 8, 8, (g) => { g.fillStyle = '#cb4d4d'; g.fillRect(1, 1, 6, 6); g.lineWidth = 1; g.strokeStyle = '#fff'; g.strokeRect(1, 1, 6, 6); });
  draw('sw-poi', 7, 7, (g) => { g.beginPath(); g.arc(3.5, 3.5, 2.2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.1; g.strokeStyle = '#202020'; g.stroke(); });
  shield('sw-shield', 18, 14, (g) => {
    rr(g, 0.5, 0.5, 17, 13, 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#202020'; g.stroke();
  }, [5, 3, 5, 3]);
  shield('sw-shield-motorway', 18, 14, (g) => {
    rr(g, 0.5, 0.5, 17, 13, 2); g.fillStyle = '#c1272d'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#fff'; g.stroke();
  }, [5, 3, 5, 3]);
  shield('exit', 16, 12, (g) => {
    rr(g, 0.5, 0.5, 15, 11, 2); g.fillStyle = '#fbf9f3'; g.fill(); g.lineWidth = 0.8; g.strokeStyle = '#9c4a2c'; g.stroke();
  }, [4, 2, 4, 2]);
  dot('dot-station', 2.6, '#fff', '#5d4e7d', 1.4);
  dot('dot-subway', 2.2, '#5d4e7d', '#fff', 0.8);

  // Fallback for any sprite the style references that we haven't drawn
  if (map._atlasFallback) return;
  map._atlasFallback = true;
  map.on('styleimagemissing', (e) => {
    if (map.hasImage(e.id)) return;
    map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
}
