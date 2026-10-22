// vibe-fx · 地形晕渲地图（依赖 fx.js；镜头平移推拉配 fx-cam.js 的 applyCam / camKeys）
// 来源：《烽火》（62.4 万）——深色晕渲地形 + 一串光点沿驿路流动 + 城市名 + 抵达光环。
// 地形用带种子的分形噪声程序生成（不是真实地理数据），按光照算山体明暗，结果按参数缓存成一张大画布，镜头在上面平移即可。
(() => {
  const { clamp, lerp, rng } = FX;
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  // 值噪声 + 分形叠加；ridge 让山脊更尖（山脉感）
  function noise2(seed) {
    const r = rng(seed), P = new Float32Array(65536); for (let i = 0; i < 65536; i++) P[i] = r();
    const h = (a, b) => P[((a & 255) << 8) | (b & 255)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
    };
  }
  // 每一层旋转一个角度再叠加，避免值噪声的方格痕迹
  function fbm(n, x, y, oct = 6, ridge = 0) {
    let s = 0, a = .5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      const c = Math.cos(i * .9), sn = Math.sin(i * .9), u = (x * c - y * sn) * f + i * 17.3, w = (x * sn + y * c) * f - i * 9.1;
      let v = n(u, w); if (ridge) v = lerp(v, 1 - Math.abs(2 * v - 1), ridge); s += a * v; norm += a; a *= .5; f *= 2.03;
    }
    return s / norm;
  }

  const PALETTES = {
    sepia: { low: [34, 28, 21], high: [150, 126, 94], water: [16, 20, 24], line: '255,214,150' },   // 烽火那种暗棕
    night: { low: [10, 16, 28], high: [70, 92, 128], water: [6, 10, 18], line: '140,190,255' },
    paper: { low: [196, 182, 152], high: [238, 228, 204], water: [168, 176, 170], line: '90,70,50' },
  };

  // 生成一整张地形画布（世界坐标 w×h，按 res 降采样计算后放大，柔和且快）
  function terrainCanvas({ w = 1600, h = 2600, seed = 7, scale = 3.2, ridge = .55, res = .5, palette = 'sepia', water = .3, contour = 0, light = [-1, -1.2, 1.4], relief = 5 } = {}) {
    return memo(JSON.stringify(arguments[0] || {}), () => {
      const cw = Math.round(w * res), ch = Math.round(h * res), n = noise2(seed), H = new Float32Array(cw * ch);
      const n2 = noise2(seed + 101);   // 坐标先扭一下（domain warp），山脉走向更自然
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const x = i / cw * scale * (w / h), y = j / ch * scale, wx = fbm(n2, x * .8, y * .8, 3) - .5, wy = fbm(n2, x * .8 + 5.2, y * .8 + 1.3, 3) - .5;
        H[j * cw + i] = fbm(n, x + wx * 1.2, y + wy * 1.2, 6, ridge);
      }
      const pal = PALETTES[palette] || PALETTES.sepia, L = Math.hypot(...light), lx = light[0] / L, ly = light[1] / L, lz = light[2] / L;
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'), img = g.createImageData(cw, ch), d = img.data;
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const k = j * cw + i, z = H[k];
        const dx = (H[j * cw + Math.min(cw - 1, i + 1)] - H[j * cw + Math.max(0, i - 1)]) * relief * cw / 100;
        const dy = (H[Math.min(ch - 1, j + 1) * cw + i] - H[Math.max(0, j - 1) * cw + i]) * relief * cw / 100;
        const nl = Math.hypot(dx, dy, 1), shade = clamp((-dx * lx - dy * ly + lz) / nl * .9 + .1);
        let col;
        if (z < water) col = pal.water.map(v => v * (.85 + .15 * z / water));
        else { const e = clamp((z - water) / (1 - water) * 1.6); col = pal.low.map((v, q) => lerp(v, pal.high[q], e) * (.35 + .9 * shade)); }
        if (contour && z >= water && Math.abs(((z * 100 / contour) % 1) - .5) > .46) col = col.map(v => v * 1.25 + 10);
        d[k * 4] = col[0]; d[k * 4 + 1] = col[1]; d[k * 4 + 2] = col[2]; d[k * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const out = document.createElement('canvas'); out.width = w; out.height = h; const o = out.getContext('2d');
      o.imageSmoothingQuality = 'high'; o.drawImage(c, 0, 0, w, h);
      return out;
    });
  }
  // 画地形（在镜头变换里画，世界原点在左上角）
  function terrain(X, opts = {}) { X.drawImage(terrainCanvas(opts), 0, 0); }

  // 地名：小圆点 + 名字 + 可选的抵达光环（光环用 fx.js 的 ring）
  function place(X, t, t0, x, y, name, { size = 34, color = FX.C.cream, dot = FX.C.goldHi, side = 'right', ring = false } = {}) {
    const k = FX.E.p3o(FX.seg(t, t0, t0 + .4)); if (k <= 0) return;
    X.save(); X.globalAlpha *= k; X.fillStyle = dot; X.shadowColor = dot; X.shadowBlur = 14; X.beginPath(); X.arc(x, y, 7, 0, 7); X.fill(); X.restore();
    FX.blurIn(X, t, t0 + .1, name, x + (side === 'right' ? 18 : -18), y + size * .35, { size, color, align: side === 'right' ? 'left' : 'right', dur: .5 });
    if (ring) FX.ring(X, t, t0, x, y, { r0: 8, r1: 90, dur: .8, squash: .45, color: dot });
  }

  Object.assign(FX, { terrainCanvas, terrain, place, noise2, fbm });
})();
