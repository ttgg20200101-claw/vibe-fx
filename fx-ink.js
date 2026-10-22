// vibe-fx · 水墨（依赖 fx.js 和 fx-map.js 的噪声 noise2 / fbm）
// 来源：《道家》（56.6 万）/《道德经》——宣纸底、远近山层层淡出、毛笔笔触、墨滴晕开、书法大字、朱印。
// 全部程序生成：宣纸纤维、山脊线、笔触的飞白都来自带种子的噪声，按参数缓存。
(() => {
  const { clamp, lerp, rng, E, seg } = FX;
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  const INK = '24,22,20';

  // ---------- 宣纸：米色底 + 低频深浅 + 纤维 + 四角压暗 ----------
  function paperCanvas(w = 1080, h = 1920, seed = 3) {
    return memo(`paper${w},${h},${seed}`, () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = '#EEE5D1'; g.fillRect(0, 0, w, h);
      const n = FX.noise2(seed), s = 4, sc = document.createElement('canvas'); sc.width = w / s; sc.height = h / s;
      const sg = sc.getContext('2d'), img = sg.createImageData(sc.width, sc.height);
      for (let j = 0; j < sc.height; j++) for (let i = 0; i < sc.width; i++) {
        const v = FX.fbm(n, i / 60, j / 60, 4), k = (j * sc.width + i) * 4;
        img.data[k] = 120; img.data[k + 1] = 100; img.data[k + 2] = 70; img.data[k + 3] = v * 46;
      }
      sg.putImageData(img, 0, 0); g.drawImage(sc, 0, 0, w, h);
      const r = rng(seed + 1); g.lineWidth = 1;
      for (let i = 0; i < 2600; i++) {
        const x = r() * w, y = r() * h, a = r() * 6.28, l = 6 + r() * 26;
        g.strokeStyle = `rgba(${r() < .5 ? '150,130,100' : '255,252,240'},${.08 + r() * .14})`;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75);
      v.addColorStop(0, 'rgba(90,70,40,0)'); v.addColorStop(1, 'rgba(90,70,40,.28)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
      return c;
    });
  }
  const paper = (X, w = 1080, h = 1920, seed = 3) => X.drawImage(paperCanvas(w, h, seed), 0, 0);

  // ---------- 远近山：每层一条山脊线，往下渐淡；越远越淡越糊，横移时近快远慢（视差） ----------
  function ridgeCanvas(layer, n, { w = 1080, seed = 5, base = 900, amp = 260, freq = 2.2, ink = .9, blur = 0 }) {
    return memo(`ridge${layer},${n},${w},${seed},${base},${amp},${freq},${ink},${blur}`, () => {
      const W = w * 2, c = document.createElement('canvas'); c.width = W; c.height = base + amp + 700; const g = c.getContext('2d');
      const no = FX.noise2(seed + layer * 31), depth = 1 - layer / Math.max(1, n - 1);
      g.beginPath(); g.moveTo(0, c.height);
      for (let x = 0; x <= W; x += 4) {
        const u = x / w;   // 左右两半拼接处连续：用周期化的采样
        const y = base - amp * (FX.fbm(no, Math.cos(u * Math.PI) * freq + 10, Math.sin(u * Math.PI) * freq + layer * 3, 5, .6) - .3) * 1.6;
        g.lineTo(x, y);
      }
      g.lineTo(W, c.height); g.closePath();
      const gr = g.createLinearGradient(0, base - amp, 0, base + 520);
      const a = ink * (.25 + .75 * (1 - depth));
      gr.addColorStop(0, `rgba(${INK},${a})`); gr.addColorStop(.35, `rgba(${INK},${a * .55})`); gr.addColorStop(1, `rgba(${INK},0)`);
      g.filter = blur ? `blur(${blur}px)` : 'none'; g.fillStyle = gr; g.fill();
      return c;
    });
  }
  function mountains(X, t, { n = 4, w = 1080, seed = 5, top = 700, gap = 170, drift = 14, ink = .9 } = {}) {
    for (let i = 0; i < n; i++) {
      const depth = 1 - i / Math.max(1, n - 1), c = ridgeCanvas(i, n, { w, seed, base: 360, amp: 260 - depth * 80, freq: 1.6 + i * .5, ink, blur: depth * 5 });
      const off = ((t * drift * (1 + i * 1.6)) % w + w) % w;
      X.drawImage(c, -off, top + i * gap - 360);
      if (i < n - 1) {   // 每两层之间一条雾带
        const y = top + i * gap + 120, g = X.createLinearGradient(0, y - 80, 0, y + 120);
        g.addColorStop(0, 'rgba(238,229,209,0)'); g.addColorStop(.5, 'rgba(238,229,209,.55)'); g.addColorStop(1, 'rgba(238,229,209,0)');
        X.fillStyle = g; X.fillRect(0, y - 80, w, 200);
      }
    }
  }

  // ---------- 毛笔笔触：起笔重、收笔尖，多根「笔毛」各自断开形成飞白，外面一圈晕染 ----------
  function brush(X, t, t0, dur, pts, { width = 46, ink = INK, dry = .75, seed = 11, bristles = 18, alpha = .92 } = {}) {
    const k = E.io(seg(t, t0, t0 + dur)); if (k <= 0) return;
    const P = FX.path(pts), L = P.len * k, r = rng(seed), no = FX.noise2(seed);
    const prof = u => width * (u < .08 ? .55 + .45 * Math.sin(u / .08 * Math.PI / 2) : u > .8 ? Math.max(.05, (1 - u) / .2) : 1 - .15 * (u - .08));
    // 底色晕染
    X.save(); X.filter = 'blur(4px)'; X.strokeStyle = `rgba(${ink},${alpha * .14})`; X.lineCap = 'round';
    for (let d = 0; d < L; d += 6) { const a = FX.pointAt(P, d), b = FX.pointAt(P, Math.min(L, d + 6)); X.lineWidth = prof(d / P.len) * .7; X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.stroke(); }
    X.restore();
    // 笔毛
    X.save(); X.lineCap = 'round';
    for (let b = 0; b < bristles; b++) {
      const o = (b / (bristles - 1) - .5) * .92, bw = width / bristles * 1.75, phase = r() * 50;
      X.strokeStyle = `rgba(${ink},${alpha * (.75 + .25 * r())})`;
      let prev = null;
      for (let d = 0; d <= L; d += 3) {
        const u = d / P.len, [x, y] = FX.pointAt(P, d), [x2, y2] = FX.pointAt(P, Math.min(P.len, d + 1));
        const nx = -(y2 - y), ny = x2 - x, nn = Math.hypot(nx, ny) || 1, wv = prof(u);
        const px = x + nx / nn * o * wv, py = y + ny / nn * o * wv;
        const gapv = no(phase + d * .03, b * 3.1);                  // 越往后、越靠边越容易断 → 飞白
        const on = gapv > dry * (u * u * 1.5 + o * o * 2.6) - .12;   // 主体实，收笔和两侧边缘才断
        if (on && prev) { X.lineWidth = bw * (u > .8 ? .7 : 1); X.beginPath(); X.moveTo(prev[0], prev[1]); X.lineTo(px, py); X.stroke(); }
        prev = on ? [px, py] : null;
      }
    }
    X.restore();
  }

  // ---------- 墨滴：落下后不规则地晕开，四周溅出小墨点 ----------
  function inkDrop(X, t, t0, x, y, { r = 130, seed = 21, dur = 1.4, ink = INK } = {}) {
    const k = E.p3o(seg(t, t0, t0 + dur)); if (k <= 0) return;
    const q = rng(seed), no = FX.noise2(seed);
    X.save(); X.filter = 'blur(5px)';
    for (const [sc, a] of [[1.15, .12], [1, .22], [.88, .4], [.74, .6], [.58, .85]]) {
      X.fillStyle = `rgba(${ink},${a})`; X.beginPath();
      for (let i = 0; i <= 64; i++) {
        const ang = i / 64 * Math.PI * 2, rr = r * sc * k * (.75 + .5 * no(Math.cos(ang) * 2 + 5, Math.sin(ang) * 2 + 5));
        const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr; i ? X.lineTo(px, py) : X.moveTo(px, py);
      }
      X.closePath(); X.fill();
    }
    X.restore();
    const sk = E.expo(seg(t, t0, t0 + .35));
    X.fillStyle = `rgba(${ink},.85)`;
    for (let i = 0; i < 26; i++) {
      const ang = q() * 6.28, dist = r * (1.1 + q() * 1.6) * sk, s = (2 + q() * 9) * (1 - q() * .5);
      X.beginPath(); X.arc(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, s, 0, 7); X.fill();
    }
  }

  // ---------- 书法大字：字形边缘做毛糙处理，沿对角方向「写」出来，最后溅几点墨 ----------
  function charCanvas(ch, size, seed) {
    return memo(`char${ch},${size},${seed}`, () => {
      const pad = size * .2, c = document.createElement('canvas'); c.width = c.height = size + pad * 2; const g = c.getContext('2d');
      g.fillStyle = `rgb(${INK})`; g.font = `900 ${size}px "STKaiti","Kaiti SC",${FX.SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, c.width / 2, c.height / 2 + size * .04);
      const img = g.getImageData(0, 0, c.width, c.height), d = img.data, no = FX.noise2(seed);   // 墨色深浅 + 边缘毛糙
      for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
        const k = (j * c.width + i) * 4; if (!d[k + 3]) continue;
        const v = FX.fbm(no, i / 14, j / 14, 3); d[k + 3] = d[k + 3] < 250 ? d[k + 3] * (v > .45 ? 1 : .2) : 255 * (.8 + .2 * v);
      }
      g.putImageData(img, 0, 0); return c;
    });
  }
  function brushChar(X, t, t0, ch, x, y, { size = 520, dur = 1.1, seed = 8, splash = true } = {}) {
    const k = E.io(seg(t, t0, t0 + dur)); if (k <= 0) return;
    const c = charCanvas(ch, size, seed), W = c.width, d = W * .5 + W * 1.55 * k;   // 第一帧就露出起笔，不留空白
    X.save(); X.translate(x - W / 2, y - W / 2);
    X.beginPath(); X.moveTo(0, 0); X.lineTo(d, 0); X.lineTo(0, d); X.closePath(); X.lineTo(0, 0); X.clip();
    X.filter = `blur(${((1 - k) * 4).toFixed(1)}px)`; X.drawImage(c, 0, 0); X.restore();
    if (splash) inkDrop(X, t, t0 + dur * .8, x + size * .42, y + size * .36, { r: 18, seed: seed + 3, dur: .4 });
  }

  // ---------- 朱红日：宣纸上的一枚红日，边缘微微晕开 ----------
  function redSun(X, t, t0, x, y, r = 90) {
    const k = E.p3o(seg(t, t0, t0 + .8)); if (k <= 0) return;
    X.save(); X.globalAlpha *= k; X.filter = 'blur(1.5px)'; X.fillStyle = '#C23A2B'; X.beginPath(); X.arc(x, y, r * (.9 + .1 * k), 0, 7); X.fill(); X.restore();
  }

  Object.assign(FX, { paperCanvas, paper, mountains, brush, inkDrop, brushChar, redSun });
})();
