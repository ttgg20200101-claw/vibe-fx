// vibe-fx：从抖音「Vibe 知识大赏」高赞片 + GitHub 高星动效技能里拆出来的手法
// 用法：在页面里 <script src="fx.js"></script>
// 规矩：每个函数都是 t 的纯函数，可任意顺序逐帧渲染；随机数全部用种子，预计算结果按参数缓存。
// 约定：X = canvas 2d context；t = 当前秒；t0 = 这个动效开始的秒（通常对齐到台词里某个字出现的时刻）。
// 说明和适用场景见同目录 README.md。
const FX = (() => {
  // ---------- 基础 ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    p3o: x => 1 - Math.pow(1 - clamp(x), 3),
    p4o: x => 1 - Math.pow(1 - clamp(x), 4),
    p3i: x => Math.pow(clamp(x), 3),
    p4i: x => Math.pow(clamp(x), 4),
    expo: x => (x = clamp(x), x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    io: x => (x = clamp(x), x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  };
  // 阻尼弹簧 0→1。w 速度（8 慢 / 14 常规 / 22 干脆），z 阻尼（1 = 不过冲）
  function spring(t, w = 14, z = 0.82) {
    if (t <= 0) return 0;
    if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
  }
  // 慢-快-慢三段位移（HyperFrames nudge curve）：距离 10/65/25，时间 20/18/62
  function nudge(x) {
    x = clamp(x);
    if (x < .2) return .10 * E.p3i(x / .2);
    if (x < .38) return .10 + .65 * (x - .2) / .18;
    return .75 + .25 * E.p4o((x - .38) / .62);
  }
  const rng = s => () => (s = (s + 0x6D2B79F5) | 0, s = Math.imul(s ^ (s >>> 15), 1 | s), s ^= s + Math.imul(s ^ (s >>> 7), 61 | s), ((s ^ (s >>> 14)) >>> 0) / 4294967296);
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`; };
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  const SERIF = '"Songti SC","STSong","Noto Serif SC",serif';
  const SANS = '"PingFang SC","Hiragino Sans GB",sans-serif';
  const MONO = 'Menlo,"SF Mono",monospace';
  // 「暗场 · 鎏金 · 宋体」配色。cyan 只给「另一个人/另一条线」做身份色
  const C = { ink: '#0B0A08', ink2: '#16130E', cream: '#F2EBDD', dim: '#8C8576', gold: '#E3B35E', goldHi: '#FFE7B0', goldDeep: '#8A6424', red: '#E2483A', cyan: '#5FD3E6' };

  function text(X, s, x, y, size, color, { font = SERIF, weight = 600, align = 'center', alpha = 1, spacing = 0, base = 'alphabetic' } = {}) {
    if (alpha <= 0 || !s) return;
    X.save(); X.globalAlpha *= alpha; X.font = `${weight} ${size}px ${font}`; X.fillStyle = color;
    X.textAlign = align; X.textBaseline = base; X.letterSpacing = spacing + 'px'; X.fillText(s, x, y); X.restore();
  }
  function goldFill(X, y, size) {
    const g = X.createLinearGradient(0, y - size, 0, y + size * 0.15);
    g.addColorStop(0, C.goldHi); g.addColorStop(.55, C.gold); g.addColorStop(1, C.goldDeep);
    return g;
  }

  // ---------- 1. 暗场鎏金背景：径向暗场 + 暖色散景 + 胶片颗粒 + 暗角 ----------
  const grain = memo('grain', () => Array.from({ length: 4 }, (_, k) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), d = g.createImageData(256, 256), r = rng(91 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  }));
  function bg(X, t, { w = 1080, h = 1920, seed = 3, bokeh = 14, warm = .55, cx = .5, cy = .42 } = {}) {
    const g = X.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, Math.max(w, h) * .8);
    g.addColorStop(0, '#1F1912'); g.addColorStop(.55, '#0E0C09'); g.addColorStop(1, '#050403');
    X.fillStyle = g; X.fillRect(0, 0, w, h);
    const r = rng(seed);
    X.save(); X.globalCompositeOperation = 'lighter';
    for (let i = 0; i < bokeh; i++) {
      const bx = r() * w, by = r() * h, rad = 30 + r() * 110, sp = .1 + r() * .25, ph = r() * 6.28, a = (.05 + r() * .09) * warm;
      const x = bx + Math.sin(t * sp + ph) * 40, y = by - ((t * sp * 20) % h);
      const yy = y < -rad ? y + h + 2 * rad : y;
      const o = X.createRadialGradient(x, yy, rad * .2, x, yy, rad);
      o.addColorStop(0, `rgba(255,190,110,${a})`); o.addColorStop(.85, `rgba(255,170,90,${a * .8})`); o.addColorStop(1, 'rgba(255,160,80,0)');
      X.fillStyle = o; X.beginPath(); X.arc(x, yy, rad, 0, 7); X.fill();
    }
    X.restore();
    grainAndVignette(X, t, w, h);
  }
  function grainAndVignette(X, t, w = 1080, h = 1920, amount = .07) {
    X.save(); X.globalAlpha = amount; X.globalCompositeOperation = 'overlay';
    X.fillStyle = X.createPattern(grain[Math.floor(t * 12) % 4], 'repeat'); X.fillRect(0, 0, w, h); X.restore();
    const v = X.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.72)'); X.fillStyle = v; X.fillRect(0, 0, w, h);
  }

  // ---------- 2. 模糊浮现：字从虚到实、从暗到亮（不弹、不滑，位移 ≤1% 画高） ----------
  function blurIn(X, t, t0, s, x, y, { size = 48, color = C.cream, from = '#3a352c', font = SERIF, weight = 600, align = 'center', dur = .6, t1 = Infinity, spacing = 0 } = {}) {
    const k = E.p3o(seg(t, t0, t0 + dur)), out = seg(t, t1, t1 + .3);
    if (k <= 0 || out >= 1) return;
    X.save(); X.filter = `blur(${((1 - k) * 12 + out * 6).toFixed(1)}px)`;
    text(X, s, x, y + (1 - k) * 18, size, mix(from, color, k), { font, weight, align, alpha: k * (1 - out), spacing });
    X.restore();
  }

  // ---------- 3. 关键词点亮：同一行里关键词变色 + 下划线从左描到右 ----------
  function keyMark(X, t, t0, line, key, x, y, { size = 52, color = C.cream, keyColor = C.gold, font = SERIF, weight = 700, align = 'left', under = true, alpha = 1, lead = .35 } = {}) {
    // 整行在 t0 - lead 开始淡入（还没说到的不提前出现），关键词在 t0 变色
    const ka = E.p3o(seg(t, t0 - lead, t0 - lead + .3)) * alpha;
    if (ka <= 0) return;
    X.save(); X.globalAlpha *= ka; X.font = `${weight} ${size}px ${font}`; X.textBaseline = 'alphabetic'; X.textAlign = 'left';
    const i = line.indexOf(key), W = X.measureText(line).width;
    const x0 = align === 'center' ? x - W / 2 : align === 'right' ? x - W : x;
    const pre = line.slice(0, i), kx = x0 + X.measureText(pre).width, kw = X.measureText(key).width;
    const k = E.p3o(seg(t, t0, t0 + .3)), u = E.p4o(seg(t, t0 + .1, t0 + .45));
    X.fillStyle = color; X.fillText(pre, x0, y); X.fillText(line.slice(i + key.length), kx + kw, y);
    X.fillStyle = mix(color.startsWith('#') ? color : '#F2EBDD', keyColor, k); X.fillText(key, kx, y);
    if (under && u > 0) { X.fillStyle = keyColor; X.fillRect(kx, y + size * .16, kw * u, Math.max(3, size * .06)); }
    X.restore();
  }

  // ---------- 4. 发光路径：曲线生长 + 彗星头；分支就是多调用几次 ----------
  function path(pts, n = 24) {
    return memo('path' + JSON.stringify(pts), () => {
      const p = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[Math.max(i - 1, 0)], b = pts[i], c = pts[i + 1], d = pts[Math.min(i + 2, pts.length - 1)];
        for (let s = 0; s < n; s++) {
          const u = s / n, u2 = u * u, u3 = u2 * u;
          p.push([0, 1].map(j => .5 * (2 * b[j] + (-a[j] + c[j]) * u + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * u2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * u3)));
        }
      }
      p.push(pts[pts.length - 1]);
      const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
      return { p, L, len: L[L.length - 1] };
    });
  }
  function pointAt(P, d) {
    d = clamp(d, 0, P.len); let lo = 0, hi = P.L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.L[m] < d) lo = m; else hi = m; }
    const k = (d - P.L[lo]) / Math.max(1e-6, P.L[hi] - P.L[lo]);
    return [lerp(P.p[lo][0], P.p[hi][0], k), lerp(P.p[lo][1], P.p[hi][1], k)];
  }
  function strokePart(X, P, d0, d1) {
    X.beginPath(); const a = pointAt(P, d0); X.moveTo(a[0], a[1]);
    for (let i = 0; i < P.p.length; i++) if (P.L[i] > d0 && P.L[i] < d1) X.lineTo(P.p[i][0], P.p[i][1]);
    const b = pointAt(P, d1); X.lineTo(b[0], b[1]); X.stroke();
  }
  function comet(X, x, y, r = 22, color = C.goldHi) {
    X.save(); X.globalCompositeOperation = 'lighter';
    const g = X.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,245,220,.95)'); g.addColorStop(.25, color + 'cc'); g.addColorStop(1, 'rgba(255,200,120,0)');
    X.fillStyle = g; X.beginPath(); X.arc(x, y, r, 0, 7); X.fill(); X.restore();
  }
  function grow(X, t, t0, dur, pts, { color = C.gold, width = 4, glow = 18, head = true, alpha = 1, ease = E.io } = {}) {
    const k = ease(seg(t, t0, t0 + dur)); if (k <= 0 || alpha <= 0) return;
    const P = path(pts), d = P.len * k;
    X.save(); X.globalAlpha *= alpha; X.lineCap = 'round'; X.lineJoin = 'round';
    X.strokeStyle = color; X.shadowColor = color; X.shadowBlur = glow; X.lineWidth = width; strokePart(X, P, 0, d);
    X.shadowBlur = 0; X.strokeStyle = 'rgba(255,248,230,.85)'; X.lineWidth = Math.max(1, width * .35); strokePart(X, P, 0, d);
    X.restore();
    if (head && k < 1) { const [hx, hy] = pointAt(P, d); comet(X, hx, hy, width * 6, color); }
  }

  // ---------- 5. 光点沿路流动 + 抵达光环（烽火传信 / 数据流） ----------
  function ring(X, t, t0, x, y, { r0 = 10, r1 = 140, dur = .7, color = C.gold, squash = .42, width = 4 } = {}) {
    const k = seg(t, t0, t0 + dur); if (k <= 0 || k >= 1) return;
    X.save(); X.strokeStyle = color; X.globalAlpha *= (1 - k) * .9; X.lineWidth = width * (1 - k * .6);
    X.beginPath(); X.ellipse(x, y, lerp(r0, r1, E.p3o(k)), lerp(r0, r1, E.p3o(k)) * squash, 0, 0, 7); X.stroke(); X.restore();
  }
  function pulses(X, t, t0, pts, { n = 3, gap = .16, dur = 1.1, color = C.goldHi, tail = 90, arrive = true } = {}) {
    const P = path(pts), end = pts[pts.length - 1];
    X.save(); X.lineCap = 'round'; X.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const k = E.io(seg(t, t0 + i * gap, t0 + i * gap + dur)); if (k <= 0 || k >= 1) continue;
      const d = P.len * k, g = X.createLinearGradient(...pointAt(P, d - tail), ...pointAt(P, d));
      g.addColorStop(0, 'rgba(255,210,140,0)'); g.addColorStop(1, color);
      X.strokeStyle = g; X.lineWidth = 6; strokePart(X, P, Math.max(0, d - tail), d);
      const [hx, hy] = pointAt(P, d); comet(X, hx, hy, 16, color);
    }
    X.restore();
    if (arrive) for (let i = 0; i < n; i++) ring(X, t, t0 + i * gap + dur, end[0], end[1], { color });
  }

  // ---------- 6. 伤疤印：红色发光大字砸下 + 椭圆冲击环（挫折、反转、判词） ----------
  function scar(X, t, t0, s, x, y, { size = 120, color = C.red, rot = -.07, font = SERIF, t1 = Infinity } = {}) {
    const k = seg(t, t0, t0 + .28), out = seg(t, t1, t1 + .4);
    if (k <= 0 || out >= 1) return;
    const sc = lerp(1.7, 1, E.expo(k));
    X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
    X.globalAlpha *= clamp(k * 3) * (1 - out);
    X.filter = `blur(${((1 - E.expo(k)) * 14 + 1.2 + out * 8).toFixed(1)}px)`;
    X.shadowColor = color; X.shadowBlur = 50;
    text(X, s, 0, size * .35, size, color, { font, weight: 900 });
    X.filter = 'none'; X.shadowBlur = 24;
    text(X, s, 0, size * .35, size, mix('#FFFFFF', color, .55), { font, weight: 900, alpha: .55 });
    X.restore();
    ring(X, t, t0 + .05, x, y, { color, r0: size * .5, r1: size * 2.4, dur: .6, squash: .38, width: 5 });
  }

  // ---------- 7. 里程表数字：逐位翻滚（年份、计数），可配刻度尺 ----------
  function odometer(X, t, t0, dur, from, to, x, y, { size = 120, color = C.cream, font = SERIF, weight = 500, digits = null, align = 'center', ease = E.io, suffix = '', suffixSize = null } = {}) {
    const v = lerp(from, to, ease(seg(t, t0, t0 + dur)));
    const nd = digits || String(Math.round(Math.max(from, to))).length;
    X.save(); X.font = `${weight} ${size}px ${font}`; X.textBaseline = 'alphabetic'; X.textAlign = 'center';
    const cw = X.measureText('0').width * 1.02, sw = suffix ? (X.font = `${weight} ${suffixSize || size * .4}px ${font}`, X.measureText(suffix).width + size * .12) : 0;
    X.font = `${weight} ${size}px ${font}`;
    const total = cw * nd + sw, x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    X.beginPath(); X.rect(x0 - 4, y - size * .95, cw * nd + 8, size * 1.15); X.save(); X.clip();
    X.fillStyle = color;
    for (let i = 0; i < nd; i++) {
      const p = Math.pow(10, nd - 1 - i), q = v / p, d = Math.floor(q) % 10;
      // 每位只在一格的最后 30% 里翻过去，其余时间停稳可读
      const lower = (v % p) / p, f = E.io(p === 1 ? (q - Math.floor(q) - .7) / .3 : (lower - .97) / .03);
      const cx = x0 + cw * (i + .5), hgt = size * 1.1;
      X.globalAlpha = 1 - f * .6; X.fillText(String(d), cx, y - f * hgt);
      X.globalAlpha = .4 + f * .6; X.fillText(String((d + 1) % 10), cx, y + (1 - f) * hgt);
    }
    X.restore();
    if (suffix) { X.globalAlpha = 1; X.fillStyle = color; X.textAlign = 'left'; X.font = `${weight} ${suffixSize || size * .4}px ${font}`; X.fillText(suffix, x0 + cw * nd + size * .12, y); }
    X.restore();
  }
  function ticks(X, t, t0, dur, x, y, w, { n = 48, color = C.gold, h = 18 } = {}) {
    const k = E.io(seg(t, t0, t0 + dur));
    for (let i = 0; i < n; i++) {
      const on = i / (n - 1) <= k;
      X.fillStyle = on ? color : 'rgba(255,255,255,.14)';
      X.fillRect(x + i * w / n, y - (i % 4 === 0 ? h : h * .55), Math.max(2, w / n * .28), i % 4 === 0 ? h : h * .55);
    }
  }

  // ---------- 8. 高速摄影 HUD：真实毫秒 + 慢放倍率 + REC + 取景框（「把 0.2 秒放慢 6 万倍」） ----------
  function slowmo(X, t, { ms = 0, rate = '×800', note = '', w = 1080, h = 1920, top = 200, rec = '高速摄影', frame = 0 } = {}) {
    X.save(); X.strokeStyle = 'rgba(242,235,221,.45)'; X.lineWidth = 3; const m = 56, L = 60;
    [[m, top - 60, 1, 1], [w - m, top - 60, -1, 1], [m, h - 260, 1, -1], [w - m, h - 260, -1, -1]].forEach(([x, y, sx, sy]) => { X.beginPath(); X.moveTo(x, y + sy * L); X.lineTo(x, y); X.lineTo(x + sx * L, y); X.stroke(); });
    X.restore();
    text(X, '真 实 时 间', w / 2, top + 10, 26, C.dim, { font: SANS, weight: 500 });
    const s = ms.toFixed(2).padStart(5, '0');
    text(X, s, w / 2 - 30, top + 150, 140, C.cream, { font: SANS, weight: 200 });
    X.save(); X.font = `200 140px ${SANS}`; const sw = X.measureText(s).width; X.restore();
    text(X, '毫秒', w / 2 - 30 + sw / 2 + 12, top + 150, 40, C.cream, { font: SANS, weight: 300, align: 'left' });
    text(X, note ? `${note} · 慢放 ${rate}` : `慢放 ${rate}`, w / 2, top + 205, 28, C.dim, { font: SANS, weight: 400 });
    if (Math.floor(t * 2) % 2 === 0) { X.fillStyle = C.red; X.beginPath(); X.arc(m + 26, top + 290, 9, 0, 7); X.fill(); }
    text(X, rec, m + 46, top + 299, 24, C.cream, { font: SANS, weight: 500, align: 'left' });
    text(X, '帧 ' + String(frame).padStart(6, '0'), w - m - 10, top + 299, 22, C.dim, { font: MONO, weight: 500, align: 'right' });
  }

  // ---------- 9. 分形闪电：梯级先导一步一停往下走，接地瞬间回击闪白 ----------
  function boltData(seed, x0, y0, x1, y1, steps) {
    return memo(`bolt${seed},${x0},${y0},${x1},${y1},${steps}`, () => {
      const r = rng(seed), segs = []; let x = x0, y = y0;
      const stepLen = Math.hypot(x1 - x0, y1 - y0) / steps;
      const walk = (sx, sy, ang, n, si, depth) => {
        let px = sx, py = sy;
        for (let i = 0; i < n; i++) {
          const a = ang + (r() - .5) * 1.1, l = stepLen * (.6 + r() * .8) * (depth ? .7 : 1);
          const nx = px + Math.cos(a) * l, ny = py + Math.sin(a) * l;
          segs.push({ x0: px, y0: py, x1: nx, y1: ny, s: si + i, depth });
          if (!depth && r() < .3) walk(nx, ny, ang + (r() < .5 ? -1 : 1) * (.5 + r() * .6), 2 + Math.floor(r() * 4), si + i + 1, 1);
          px = nx; py = ny;
        }
      };
      for (let i = 0; i < steps; i++) {
        const ang = Math.atan2(y1 - y, x1 - x) + (r() - .5) * 1.0, l = stepLen * (.7 + r() * .6);
        const nx = i === steps - 1 ? x1 : x + Math.cos(ang) * l, ny = i === steps - 1 ? y1 : y + Math.sin(ang) * l;
        segs.push({ x0: x, y0: y, x1: nx, y1: ny, s: i, depth: 0, main: 1 });
        if (r() < .32) walk(nx, ny, ang + (r() < .5 ? -1 : 1) * (.5 + r() * .7), 2 + Math.floor(r() * 4), i + 1, 1);
        x = nx; y = ny;
      }
      return segs;
    });
  }
  function bolt(X, t, t0, { x0 = 540, y0 = 300, x1 = 600, y1 = 1500, steps = 16, stepDur = .07, seed = 7, color = '#C9B8FF', w = 1080, h = 1920 } = {}) {
    const segs = boltData(seed, x0, y0, x1, y1, steps), cur = (t - t0) / stepDur;
    if (cur < 0) return;
    const strike = cur - steps, flash = strike > 0 ? Math.exp(-strike * stepDur * 9) : 0;
    X.save(); X.lineCap = 'round'; X.globalCompositeOperation = 'lighter';
    for (const s of segs) {
      if (s.s > cur) continue;
      const fresh = clamp(1 - (cur - s.s) / 3), main = s.main && strike > 0;
      X.strokeStyle = main ? '#FFFFFF' : color; X.shadowColor = color; X.shadowBlur = main ? 40 : 16;
      X.globalAlpha = main ? .6 + .4 * flash : (strike > 0 ? .35 * flash + .1 : .35 + .65 * fresh) * (s.depth ? .7 : 1);
      X.lineWidth = main ? 3 + 6 * flash : (s.depth ? 1.5 : 2.5);
      X.beginPath(); X.moveTo(s.x0, s.y0); X.lineTo(s.x1, s.y1); X.stroke();
    }
    const tip = segs.filter(s => s.main && s.s <= cur).pop();
    if (tip && strike <= 0) comet(X, tip.x1, tip.y1, 18, color);
    X.restore();
    if (flash > .01) { X.fillStyle = `rgba(220,215,255,${.45 * flash})`; X.fillRect(0, 0, w, h); }
  }

  // ---------- 10. 高尔顿板：小球一颗颗落下，堆出钟形（「千万颗落下，总会堆出同一个形状」） ----------
  function galtonData(seed, rows, balls) {
    return memo(`galton${seed},${rows},${balls}`, () => {
      const r = rng(seed), cnt = new Array(rows + 1).fill(0);
      return Array.from({ length: balls }, () => { const moves = Array.from({ length: rows }, () => r() < .5 ? 0 : 1); const bin = moves.reduce((a, b) => a + b, 0); return { moves, bin, rank: cnt[bin]++ }; });
    });
  }
  function galton(X, t, t0, { x = 140, y = 380, w = 800, h = 1100, rows = 12, balls = 360, rate = 40, rowDur = .06, seed = 5, color = C.gold } = {}) {
    const B = galtonData(seed, rows, balls), sx = w / (rows + 2), sy = h * .5 / rows, cx = x + w / 2;
    // 最高那一堆也要装进槽里：按实际最大堆数反推球径
    const maxStack = memo(`gmax${seed},${rows},${balls}`, () => Math.max(...B.map(b => b.rank)) + 1);
    const rad = Math.min(sx * .17, (h - (rows + 1) * sy) / maxStack / 2.05);
    X.fillStyle = 'rgba(227,179,94,.35)';
    for (let rr = 0; rr < rows; rr++) for (let k = 0; k <= rr; k++) { X.beginPath(); X.arc(cx + (k - rr / 2) * sx, y + (rr + 1) * sy, 3.5, 0, 7); X.fill(); }
    X.strokeStyle = 'rgba(227,179,94,.22)'; X.lineWidth = 2;
    for (let k = 0; k <= rows + 1; k++) { const bx = cx + (k - .5 - rows / 2) * sx; X.beginPath(); X.moveTo(bx, y + (rows + 1) * sy); X.lineTo(bx, y + h); X.stroke(); }
    const fall = .35;
    X.fillStyle = color;
    for (let i = 0; i < B.length; i++) {
      const lt = t - (t0 + i / rate); if (lt < 0) break;
      const b = B[i]; let px, py;
      if (lt < rows * rowDur) {
        const rr = Math.floor(lt / rowDur), f = lt / rowDur - rr, k0 = b.moves.slice(0, rr).reduce((a, c) => a + c, 0), k1 = k0 + b.moves[rr];
        px = cx + lerp(k0 - rr / 2, k1 - (rr + 1) / 2, f) * sx; py = y + (rr + f) * sy + Math.sin(f * Math.PI) * -sy * .25;
      } else {
        const f = clamp((lt - rows * rowDur) / fall), bx = cx + (b.bin - rows / 2) * sx, ty = y + h - rad - (b.rank % 1e9) * rad * 2.05;
        px = bx; py = lerp(y + rows * sy, ty, f * f);
      }
      X.beginPath(); X.arc(px, py, rad, 0, 7); X.fill();
    }
  }

  // ---------- 11. 流场：水流绕过石头（「水最软」），虚线顺流流动 ----------
  function flowData(cx, cy, R, x, y, w, h, n) {
    return memo(`flow${cx},${cy},${R},${x},${y},${w},${h},${n}`, () => Array.from({ length: n }, (_, i) => {
      let px = x + (i + .5) * w / n, py = y; const pts = [[px, py]];
      for (let s = 0; s < 400 && py < y + h; s++) {
        const dx = px - cx, dy = py - cy, r2 = dx * dx + dy * dy;
        if (r2 < R * R * 1.02) break;
        const R2 = R * R, r4 = r2 * r2;   // 圆柱绕流势流，来流方向 +y
        let vy = 1 - R2 * (dy * dy - dx * dx) / r4, vx = -2 * R2 * dx * dy / r4;
        const m = Math.hypot(vx, vy); px += vx / m * 6; py += vy / m * 6; pts.push([px, py]);
      }
      return pts;
    }));
  }
  function flow(X, t, t0, { cx = 540, cy = 900, R = 130, x = 80, y = 300, w = 920, h = 1200, n = 34, color = '#6F93B8', speed = 120 } = {}) {
    const lines = flowData(cx, cy, R, x, y, w, h, n), k = E.p3o(seg(t, t0, t0 + 1.2));
    if (k <= 0) return;
    X.save(); X.strokeStyle = color; X.lineWidth = 2.2; X.globalAlpha *= .75 * k; X.setLineDash([28, 18]); X.lineDashOffset = -(t - t0) * speed;
    for (const L of lines) { X.beginPath(); const m = Math.floor(L.length * k); X.moveTo(L[0][0], L[0][1]); for (let i = 1; i < m; i++) X.lineTo(L[i][0], L[i][1]); X.stroke(); }
    X.restore();
  }

  // ---------- 12. 鎏金标题：放射光芒 + 金色渐变宋体 + 拉丁小字 + 两侧细线 ----------
  function goldTitle(X, t, t0, s, x, y, { size = 160, sub = '', latin = '', rays = true } = {}) {
    const k = seg(t, t0, t0 + 1.2); if (k <= 0) return;
    if (rays) {
      const rk = E.p3o(seg(t, t0, t0 + 1.4));
      X.save(); X.translate(x, y - size * .35); X.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * Math.PI * 2, len = (300 + (i % 3) * 160) * rk;
        const g = X.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        g.addColorStop(0, `rgba(255,214,140,${.16 * rk})`); g.addColorStop(1, 'rgba(255,214,140,0)');
        X.strokeStyle = g; X.lineWidth = i % 2 ? 2 : 4; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a) * len, Math.sin(a) * len); X.stroke();
      }
      X.restore();
    }
    if (latin) blurIn(X, t, t0, latin.split('').join(' '), x, y - size * 1.05, { size: 24, color: C.gold, font: SERIF, weight: 400, dur: .8 });
    X.save(); X.font = `700 ${size}px ${SERIF}`; X.textBaseline = 'alphabetic'; X.textAlign = 'left';
    const chars = [...s], ws = chars.map(c => X.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0);
    let cx = x - tw / 2;
    chars.forEach((c, i) => {
      const kk = E.p3o(seg(t, t0 + .1 + i * .09, t0 + .8 + i * .09));
      if (kk > 0) {
        X.save(); X.globalAlpha = kk; X.filter = `blur(${((1 - kk) * 10).toFixed(1)}px)`;
        X.shadowColor = 'rgba(255,190,90,.55)'; X.shadowBlur = 30; X.fillStyle = goldFill(X, y, size); X.fillText(c, cx, y + (1 - kk) * 16); X.restore();
      }
      cx += ws[i];
    });
    X.restore();
    const lk = E.p4o(seg(t, t0 + .5, t0 + 1.3));
    if (lk > 0) { X.fillStyle = C.gold; X.fillRect(x - tw / 2 - 40 - 160 * lk, y + size * .32, 160 * lk, 2); X.fillRect(x + tw / 2 + 40, y + size * .32, 160 * lk, 2); }
    if (sub) blurIn(X, t, t0 + .7, sub, x, y + size * .62, { size: size * .24, color: C.cream, dur: .7, weight: 500 });
  }

  // ---------- 13. 印章章节：朱红方印 + 章名 + ●○○○○ 进度 ----------
  function seal(X, t, t0, { x = 80, y = 260, num = '壹', title = '', i = 0, n = 5, size = 56 } = {}) {
    const k = seg(t, t0, t0 + .22); if (k <= 0) return;
    const sc = lerp(1.5, 1, E.expo(k));
    X.save(); X.translate(x + size / 2, y + size / 2); X.rotate(-.05); X.scale(sc, sc); X.globalAlpha *= clamp(k * 3);
    X.fillStyle = '#B8322A'; X.beginPath(); X.roundRect(-size / 2, -size / 2, size, size, size * .12); X.fill();
    const r = rng(num.charCodeAt(0)); X.fillStyle = 'rgba(242,235,221,.18)';
    for (let j = 0; j < 40; j++) X.fillRect((r() - .5) * size, (r() - .5) * size, 2 + r() * 4, 1 + r() * 2);
    text(X, num, 0, size * .3, size * .72, '#F7EFE2', { font: SERIF, weight: 900 });
    X.restore();
    blurIn(X, t, t0 + .15, title, x + size + 22, y + size * .62, { size: size * .6, color: C.cream, align: 'left', dur: .5 });
    for (let j = 0; j < n; j++) {
      const on = j < i || (j === i && t > t0 + .3);
      X.fillStyle = j === i ? C.red : on ? '#B8322A' : 'rgba(242,235,221,.25)';
      X.beginPath(); X.arc(x + size + 30 + j * 26, y + size + 18, j === i ? 7 : 5, 0, 7); X.fill();
    }
  }

  // ---------- 14. 引线标注：锚点 → 折线 → 中文 + 英文小字（「暗场 DARK SCENE」） ----------
  function callout(X, t, t0, { ax, ay, bx, by, cn, en = '', color = C.gold, align = 'left' } = {}) {
    const a = E.p3o(seg(t, t0, t0 + .25)); if (a <= 0) return;
    X.save(); X.fillStyle = color; X.globalAlpha = a; X.beginPath(); X.arc(ax, ay, 7, 0, 7); X.fill(); X.restore();
    ring(X, t, t0, ax, ay, { r0: 6, r1: 40, dur: .6, squash: 1, color, width: 2 });
    const l1 = E.p3o(seg(t, t0 + .1, t0 + .4)), dir = align === 'left' ? 1 : -1, ex = bx + dir * 120;
    X.save(); X.strokeStyle = color; X.lineWidth = 2; X.globalAlpha = .9; X.beginPath(); X.moveTo(ax, ay);
    X.lineTo(lerp(ax, bx, l1), lerp(ay, by, l1));
    const l2 = E.p3o(seg(t, t0 + .35, t0 + .55)); if (l2 > 0) X.lineTo(lerp(bx, ex, l2), by);
    X.stroke(); X.restore();
    blurIn(X, t, t0 + .45, cn, bx + dir * 8, by - 16, { size: 40, color: C.cream, align, dur: .5, weight: 700 });
    if (en) blurIn(X, t, t0 + .55, en.toUpperCase(), bx + dir * 8, by + 34, { size: 18, color: C.dim, font: MONO, align, dur: .5, weight: 500, spacing: 4 });
  }

  // ---------- 15. 转场：zoom-through（推进）/ inverse zoom（到达）/ cut-the-curve（横向） ----------
  // drawA/drawB 在原点为中心画内容；在切点 tc 两侧调用，速度和方向连续
  function zoomSwap(X, t, tc, drawA, drawB, { cx = 540, cy = 960, mode = 'push' } = {}) {
    const push = mode === 'push';
    if (t < tc) {
      const k = seg(t, tc - .2, tc), s = push ? lerp(1, 1.2, E.p3i(k)) : lerp(1, .8, E.p3i(k));
      X.save(); X.translate(cx, cy); X.scale(s, s); X.globalAlpha *= lerp(1, .15, k); X.filter = `blur(${(10 * k).toFixed(1)}px)`; drawA(); X.restore();
    } else {
      const k = E.expo(seg(t, tc, tc + .5)), s = push ? lerp(.75, 1, k) : lerp(1.25, 1, k);
      X.save(); X.translate(cx, cy); X.scale(s, s); X.globalAlpha *= lerp(.15, 1, k); X.filter = `blur(${(10 * (1 - k)).toFixed(1)}px)`; drawB(); X.restore();
    }
  }
  function cutCurve(X, t, tc, drawA, drawB, { cx = 540, cy = 960, dist = 130, dir = -1, dur = .32 } = {}) {
    if (t < tc) {
      const k = seg(t, tc - dur, tc); if (k <= 0) { X.save(); X.translate(cx, cy); drawA(); X.restore(); return; }
      X.save(); X.translate(cx + dir * dist * E.p4i(k), cy); X.globalAlpha *= 1 - k; /* 淡出恰好在切点结束，切点前后不留空帧 */ X.filter = `blur(${(8 * k).toFixed(1)}px)`; drawA(); X.restore();
    } else {
      const k = seg(t, tc, tc + dur);
      X.save(); X.translate(cx - dir * dist * (1 - E.p4o(k)), cy); X.globalAlpha *= lerp(.35, 1, E.p4o(k)); X.filter = `blur(${(8 * (1 - E.p4o(k))).toFixed(1)}px)`; drawB(); X.restore();
    }
  }

  // ---------- 16. 瀑布入场：逐字从下甩上来，间隔越来越短，重字走得更远 ----------
  function waterfall(X, t, t0, s, x, y, { size = 110, color = C.cream, font = SERIF, weight = 800, heavy = [], heavyColor = C.gold, align = 'center' } = {}) {
    X.save(); X.font = `${weight} ${size}px ${font}`; X.textBaseline = 'alphabetic'; X.textAlign = 'left';
    const chars = [...s], ws = chars.map(c => X.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0);
    let cx = align === 'center' ? x - tw / 2 : x, at = t0, gap = .06;
    chars.forEach((c, i) => {
      const hv = heavy.includes(i), off = hv ? 75 : 45, dur = hv ? .19 : .14, k = seg(t, at, at + dur);
      if (t >= at) { X.fillStyle = hv ? heavyColor : color; X.fillText(c, cx, y + off * (1 - E.p4o(k))); }
      cx += ws[i]; at += gap; gap *= .84;
    });
    X.restore();
  }

  // ---------- 17. 运动残影：把同一个绘制函数在过去几个时间点各画一遍（骰子、飞出的物体） ----------
  function trail(X, t, fn, { n = 4, dt = .035, fade = .5 } = {}) {
    for (let i = n; i >= 1; i--) { X.save(); X.globalAlpha *= fade * (1 - i / (n + 1)) * .6; fn(t - i * dt); X.restore(); }
    fn(t);
  }

  return { clamp, seg, lerp, E, spring, nudge, rng, mix, C, SERIF, SANS, MONO, text, path, pointAt,
    bg, grainAndVignette, blurIn, keyMark, grow, comet, ring, pulses, scar, odometer, ticks, slowmo, bolt, galton, flow, goldTitle, seal, callout, zoomSwap, cutCurve, waterfall, trail };
})();
