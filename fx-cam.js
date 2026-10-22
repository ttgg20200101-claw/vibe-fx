// vibe-fx · 镜头与 3D（依赖 fx.js，先加载 fx.js 再加载本文件）
// 来源：抖音「Vibe 知识大赏」第二轮普查的运镜 / 3D 样本——容错率（载体变形 + 景别转场）、缘分（固定俯拍 + 跟拍）、
// 强迫性自立（分屏 ↔ 单格）、把回忆拼好给你（画中画推拉 + 褪色）、庞加莱回归（3D 粒子人 / 粒子重组 / 星系 / 跃迁白闪）。
// 规矩同 fx.js：全部是 t 的纯函数；随机数带种子；预计算结果按参数缓存。3D 用自己的透视投影，不依赖 three.js。
(() => {
  const { clamp, seg, lerp, E, rng } = FX;
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  // ---------- 1. 2D 镜头：x,y 是画面中心对准的世界坐标，zoom 放大，rot 旋转 ----------
  function applyCam(X, cam, W = 1080, H = 1920) {
    X.translate(W / 2, H / 2); X.scale(cam.zoom || 1, cam.zoom || 1); X.rotate(cam.rot || 0); X.translate(-(cam.x ?? W / 2), -(cam.y ?? H / 2));
  }
  // 关键帧镜头：keys = [[t, {x,y,zoom,rot}, ease?], ...]，相邻帧之间按 ease（默认 io）插值
  function camKeys(t, keys) {
    if (t <= keys[0][0]) return { ...keys[0][1] };
    for (let i = 1; i < keys.length; i++) {
      const [a, A] = keys[i - 1], [b, B, e = E.io] = keys[i];
      if (t <= b) { const k = e(seg(t, a, b)), o = {}; for (const p in B) o[p] = lerp(A[p] ?? B[p], B[p], k); return o; }
    }
    return { ...keys[keys.length - 1][1] };
  }
  // 跟拍：镜头对准沿路径前进的主体，lead>0 让镜头略微领先（看向前方），lag>0 让镜头略微落后（主体冲出画面中心）
  function camFollow(P, d, { zoom = 1.6, lead = 0, lag = 0 } = {}) {
    const [x, y] = FX.pointAt(P, d + lead - lag);
    return { x, y, zoom };
  }

  // ---------- 2. 画中画推入 / 拉出：外层场景里的一个矩形推到满屏，里面接着是新场景 ----------
  // rect 是外层场景里的矩形 {x,y,w,h}；k=0 只看外层，k=1 内层满屏。拉出就是 k 从 1 走到 0
  function nest(X, k, rect, drawOuter, drawInner, { W = 1080, H = 1920 } = {}) {
    const s = Math.min(W / rect.w, H / rect.h), z = lerp(1, s, k);
    const cx = lerp(W / 2, rect.x + rect.w / 2, k), cy = lerp(H / 2, rect.y + rect.h / 2, k);
    X.save(); applyCam(X, { x: cx, y: cy, zoom: z }, W, H);
    drawOuter();
    const inA = clamp((k - .35) / .4);
    if (inA > 0) {
      X.save(); X.beginPath(); X.rect(rect.x, rect.y, rect.w, rect.h); X.clip();
      X.translate(rect.x + rect.w / 2, rect.y + rect.h / 2); X.scale(1 / s, 1 / s); X.translate(-W / 2, -H / 2);
      X.globalAlpha *= inA; drawInner(); X.restore();
    }
    X.restore();
  }

  // ---------- 3. 分屏 ↔ 单格：n 个场景并排，focus 那格放大到满屏（强迫性自立） ----------
  function panels(X, k, fns, { focus = 0, cols = fns.length, gap = 16, pad = 60, top = 560, h = 800, W = 1080, H = 1920 } = {}) {
    const rows = Math.ceil(fns.length / cols), cw = (W - pad * 2 - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
    fns.forEach((fn, i) => {
      const r0 = { x: pad + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (ch + gap), w: cw, h: ch };
      const isF = i === focus, kk = E.io(k);
      const r = isF ? { x: lerp(r0.x, 0, kk), y: lerp(r0.y, 0, kk), w: lerp(r0.w, W, kk), h: lerp(r0.h, H, kk) }
        : { ...r0, x: r0.x + (r0.x < (pad + focus * (cw + gap)) ? -1 : 1) * kk * W * .6 };
      const a = isF ? 1 : 1 - kk; if (a <= 0) return;
      X.save(); X.globalAlpha *= a; X.beginPath(); X.roundRect(r.x, r.y, r.w, r.h, lerp(18, 0, isF ? kk : 0)); X.clip();
      const s = Math.max(r.w / W, r.h / H);
      X.translate(r.x + r.w / 2, r.y + r.h / 2); X.scale(s, s); X.translate(-W / 2, -H / 2); fn(); X.restore();
    });
  }

  // ---------- 4. 调色叙事：褪成灰（「灰暗」）、昼夜色调（泪痕枕头从夜到天亮） ----------
  function desat(X, k, W = 1080, H = 1920) {
    if (k <= 0) return; X.save(); X.globalCompositeOperation = 'saturation'; X.fillStyle = `rgba(128,128,128,${clamp(k)})`; X.fillRect(0, 0, W, H); X.restore();
  }
  function tint(X, color, k, mode = 'multiply', W = 1080, H = 1920) {
    if (k <= 0) return; X.save(); X.globalCompositeOperation = mode; X.globalAlpha = clamp(k); X.fillStyle = color; X.fillRect(0, 0, W, H); X.restore();
  }
  // 一道斜光从左上扫到右下，扫过的地方从灰变彩（MV 里灰楼变彩楼）
  function colorSweep(X, k, drawGray, drawColor, { W = 1080, H = 1920, soft = 220 } = {}) {
    drawGray(); if (k <= 0) return;
    const d = lerp(-soft, W + H + soft, E.io(k));
    X.save(); X.beginPath(); X.moveTo(0, 0); X.lineTo(d, 0); X.lineTo(d - H, H); X.lineTo(0, H); X.closePath(); X.clip(); drawColor(); X.restore();
    const g = X.createLinearGradient(d - soft, 0, d + soft * .2, soft); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(.8, 'rgba(255,240,200,.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    X.save(); X.globalCompositeOperation = 'lighter'; X.beginPath(); X.moveTo(d - soft, 0); X.lineTo(d, 0); X.lineTo(d - H, H); X.lineTo(d - H - soft, H); X.closePath(); X.fillStyle = g; X.fill(); X.restore();
  }

  // ---------- 5. 3D：透视投影 ----------
  // cam3 = {yaw, pitch, dist, fov, cx, cy, tx, ty, tz}；返回 [屏幕x, 屏幕y, 缩放, 深度]，深度 ≤ near 时返回 null
  function project(p, c) {
    let x = p[0] - (c.tx || 0), y = p[1] - (c.ty || 0), z = p[2] - (c.tz || 0);
    const cy = Math.cos(c.yaw || 0), sy = Math.sin(c.yaw || 0); [x, z] = [x * cy - z * sy, x * sy + z * cy];
    const cp = Math.cos(c.pitch || 0), sp = Math.sin(c.pitch || 0); [y, z] = [y * cp - z * sp, y * sp + z * cp];
    z += c.dist || 6; if (z < .05) return null;
    const s = (c.fov || 900) / z;
    return [(c.cx ?? 540) + x * s, (c.cy ?? 960) - y * s, s, z];
  }
  // 透视线框地面（庞加莱回归里粒子人脚下那块）
  function grid3d(X, c, { y = -1.2, size = 8, div = 24, color = '91,170,255', alpha = .5 } = {}) {
    X.save(); X.lineWidth = 1.2;
    for (let i = 0; i <= div; i++) {
      const v = -size + 2 * size * i / div;
      for (const [a, b] of [[[v, y, -size], [v, y, size]], [[-size, y, v], [size, y, v]]]) {
        let prev = null;
        for (let s = 0; s <= 16; s++) {
          const u = s / 16, p = project([lerp(a[0], b[0], u), y, lerp(a[2], b[2], u)], c);
          if (p && prev) { const fade = clamp(1.4 - p[3] / ((c.dist || 6) + size)); X.strokeStyle = `rgba(${color},${alpha * fade})`; X.beginPath(); X.moveTo(prev[0], prev[1]); X.lineTo(p[0], p[1]); X.stroke(); }
          prev = p;
        }
      }
    }
    X.restore();
  }

  // ---------- 6. 点云：从文字 / 剪影 / 星系 / 球 / 尘埃采样，点与点之间可以变形重组 ----------
  function ptsFromDraw(key, draw, n, { size = 2, depth = .15, seed = 1, res = 260 } = {}) {
    return memo('pd' + key + n + size + depth + seed, () => {
      const cv = document.createElement('canvas'); cv.width = cv.height = res; const g = cv.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#fff'; g.strokeStyle = '#fff'; draw(g, res);
      const d = g.getImageData(0, 0, res, res).data, on = [];
      for (let i = 0; i < res * res; i++) if (d[i * 4 + 3] > 128) on.push(i);
      const r = rng(seed);
      return Array.from({ length: n }, () => { const i = on[Math.floor(r() * on.length)] || 0; return [((i % res) / res - .5) * size + (r() - .5) * .01, (.5 - Math.floor(i / res) / res) * size, (r() - .5) * depth]; });
    });
  }
  const ptsText = (s, n, o = {}) => ptsFromDraw('t' + s, (g, R) => {
    g.font = `900 ${R * .8}px ${FX.SERIF}`; const fs = R * .8 * Math.min(1, R * .94 / g.measureText(s).width);   // 字多时缩小，免得被裁掉
    g.font = `900 ${fs}px ${FX.SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, R / 2, R / 2);
  }, n, o);
  // 站立的人形剪影（头、躯干、手臂、腿）
  const ptsHuman = (n, o = {}) => ptsFromDraw('human', (g, R) => {
    const u = R / 100; g.beginPath(); g.arc(50 * u, 14 * u, 8 * u, 0, 7); g.fill();
    g.beginPath(); g.roundRect(39 * u, 25 * u, 22 * u, 34 * u, 6 * u); g.fill();
    g.lineCap = 'round'; g.lineWidth = 7 * u;
    [[40, 29, 31, 56], [60, 29, 69, 56], [45, 58, 42, 96], [55, 58, 58, 96]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a * u, b * u); g.lineTo(c * u, d * u); g.stroke(); });
  }, n, { depth: .25, ...o });
  const ptsSphere = (n, { r = 1, seed = 3 } = {}) => memo(`sph${n},${r},${seed}`, () => { const q = rng(seed); return Array.from({ length: n }, () => { const u = q() * 2 - 1, a = q() * 6.283, s = Math.sqrt(1 - u * u); return [r * s * Math.cos(a), r * u, r * s * Math.sin(a)]; }); });
  const ptsGalaxy = (n, { r = 2.4, arms = 3, twist = 2.6, seed = 4 } = {}) => memo(`gal${n},${r},${arms},${twist},${seed}`, () => { const q = rng(seed); return Array.from({ length: n }, (_, i) => { const rr = Math.pow(q(), .6) * r, a = (i % arms) / arms * 6.283 + rr * twist + (q() - .5) * .5; return [rr * Math.cos(a), (q() - .5) * .12 * (1 - rr / r), rr * Math.sin(a)]; }); });
  const ptsDust = (n, { r = 6, y = -1.2, seed = 5 } = {}) => memo(`dust${n},${r},${y},${seed}`, () => { const q = rng(seed); return Array.from({ length: n }, () => { const rr = Math.sqrt(q()) * r, a = q() * 6.283; return [rr * Math.cos(a), y + q() * .08, rr * Math.sin(a)]; }); });
  const shift = (pts, dx = 0, dy = 0, dz = 0, s = 1) => pts.map(p => [p[0] * s + dx, p[1] * s + dy, p[2] * s + dz]);

  // 在两组点之间变形：每个点错峰出发、走弧线（不是直线插值），k=0 是 A，k=1 是 B
  function morph(A, B, k, { spread = .45, lift = .6, seed = 9 } = {}) {
    const r = rng(seed);
    return A.map((a, i) => {
      const b = B[i % B.length], d = r() * spread, kk = E.io(clamp((k - d) / (1 - spread))), up = Math.sin(kk * Math.PI) * lift * (r() - .3);
      return [lerp(a[0], b[0], kk), lerp(a[1], b[1], kk) + up, lerp(a[2], b[2], kk)];
    });
  }
  // 画点云：远小近大、远暗近亮，叠加发光。color 可以是 '255,200,120' 或 (i)=>'r,g,b'
  function cloud(X, pts, c, { size = 2.6, color = '255,200,120', alpha = 1 } = {}) {
    const P = [];
    pts.forEach((p, i) => { const q = project(p, c); if (q) P.push([q, i]); });
    P.sort((a, b) => b[0][3] - a[0][3]);
    X.save(); X.globalCompositeOperation = 'lighter';
    for (const [q, i] of P) {
      const col = typeof color === 'function' ? color(i) : color, rr = clamp(size * q[2] / 160, .6, size * 2.2), a = alpha * clamp(1.6 - q[3] / ((c.dist || 6) * 1.6));
      X.fillStyle = `rgba(${col},${a})`; X.beginPath(); X.arc(q[0], q[1], rr, 0, 7); X.fill();
    }
    X.restore();
  }

  // ---------- 7. 星空跃迁 + 白闪：放射星线加速冲向镜头，切点一帧过曝（庞加莱回归 8–11 秒） ----------
  function warp(X, t, t0, dur, { n = 420, seed = 12, cx = 540, cy = 960, W = 1080, H = 1920, color = '235,220,255' } = {}) {
    const k = seg(t, t0, t0 + dur); if (k <= 0 || k >= 1) return;
    const r = rng(seed), speed = E.p3i(k) * 3.2;
    X.save(); X.globalCompositeOperation = 'lighter'; X.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = (r() - .5) * 2, y = (r() - .5) * 2, z0 = .15 + r() * .85;
      let z = z0 - speed * .3; z = ((z % 1) + 1) % 1 + .02;
      const z2 = z + .02 + speed * .12, s1 = 260 / z, s2 = 260 / z2;
      X.strokeStyle = `rgba(${color},${clamp(.25 + speed * .3) * (1 - z)})`; X.lineWidth = 1 + 2 * (1 - z);
      X.beginPath(); X.moveTo(cx + x * s2, cy + y * s2); X.lineTo(cx + x * s1, cy + y * s1); X.stroke();
    }
    const g = X.createRadialGradient(cx, cy, 0, cx, cy, 260 + 500 * k); g.addColorStop(0, `rgba(255,240,215,${.3 + .6 * k})`); g.addColorStop(1, 'rgba(255,240,215,0)');
    X.fillStyle = g; X.fillRect(0, 0, W, H); X.restore();
  }
  function flash(X, t, tc, { W = 1080, H = 1920, hold = .04, decay = .25, color = '255,252,245' } = {}) {
    const d = t - tc; if (d < -.06 || d > hold + decay) return;
    const a = d < 0 ? (d + .06) / .06 : d < hold ? 1 : 1 - (d - hold) / decay;
    X.fillStyle = `rgba(${color},${clamp(a) * .95})`; X.fillRect(0, 0, W, H);
  }

  // ---------- 8. 横移视差一镜到底（《从海里爬上岸的鱼》）：镜头 camX 一路横移，远层慢、近层快 ----------
  // 天色随镜头位置变：skyStops = [[camX, 顶色, 底色], ...]
  function skyAt(X, camX, stops, W = 1080, H = 1920) {
    let i = 0; while (i < stops.length - 2 && camX > stops[i + 1][0]) i++;
    const [a, ta, ba] = stops[i], [b, tb, bb] = stops[Math.min(i + 1, stops.length - 1)], k = b === a ? 0 : clamp((camX - a) / (b - a));
    const g = X.createLinearGradient(0, 0, 0, H); g.addColorStop(0, FX.mix(ta, tb, k)); g.addColorStop(1, FX.mix(ba, bb, k));
    X.fillStyle = g; X.fillRect(0, 0, W, H);
  }
  // 一层山峦剪影：周期性山脊线（可无限横移），depth 0=最远 1=最近；颜色越远越接近天色
  function ridgeLayer(X, camX, { depth = .5, base = 1300, amp = 200, period = 1400, seed = 1, color = '#1a1410', W = 1080, H = 1920 } = {}) {
    const n = FX.noise2(seed), off = camX * (.15 + .85 * depth), per = period;
    X.fillStyle = color; X.beginPath(); X.moveTo(0, H);
    for (let sx = 0; sx <= W + 8; sx += 8) {
      const wx = sx + off, u = (wx % per + per) % per / per;
      const y = base - amp * (FX.fbm(n, Math.cos(u * 6.2832) * 1.4 + 9, Math.sin(u * 6.2832) * 1.4 + depth * 5, 5, .5) - .25) * 1.5;
      X.lineTo(sx, y);
    }
    X.lineTo(W, H); X.closePath(); X.fill();
  }
  // 剪影小人走路：两腿两臂按步频摆动，pose 给定时间相位即可
  function walker(X, x, y, t, { h = 220, color = '#120e0b', speed = 1.6 } = {}) {
    const s = h / 100, ph = t * speed * Math.PI * 2, sw = Math.sin(ph) * .5;
    X.save(); X.translate(x, y); X.scale(s, s); X.fillStyle = color; X.strokeStyle = color; X.lineCap = 'round';
    X.beginPath(); X.arc(0, -88, 7, 0, 7); X.fill();
    X.lineWidth = 9; X.beginPath(); X.moveTo(0, -78); X.lineTo(1, -42); X.stroke();
    X.lineWidth = 6; [[sw, -1], [-sw, 1]].forEach(([a]) => { X.beginPath(); X.moveTo(0, -72); X.lineTo(Math.sin(a) * 18, -72 + Math.cos(a) * 26); X.stroke(); });
    X.lineWidth = 7; [[-sw], [sw]].forEach(([a]) => { X.beginPath(); X.moveTo(1, -42); X.lineTo(1 + Math.sin(a) * 22, -42 + Math.cos(a) * 42); X.stroke(); });
    X.restore();
  }

  // ---------- 9. 3D 长廊推进（《正常上课怎么成了摆烂》）：盒子拼场景，镜头在里面走 ----------
  // 第一人称镜头：cam3 的 tx,ty,tz 就是机位，dist≈0，yaw/pitch 是朝向（+z 是前方）
  function box3d(X, c, [x0, y0, z0], [x1, y1, z1], { color = [200, 196, 186], fog = [12, 12, 14], fogFar = 40, label = null } = {}) {
    const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map(p => project(p, c));
    const faces = [[[0, 3, 2, 1], .62], [[4, 5, 6, 7], .55], [[0, 4, 7, 3], .78], [[1, 2, 6, 5], .78], [[3, 7, 6, 2], 1], [[0, 1, 5, 4], .4]];   // 前 后 左 右 顶 底
    for (const [idx, light] of faces) {
      const q = idx.map(i => V[i]); if (q.some(p => !p)) continue;
      const area = q.reduce((s, p, i) => { const r = q[(i + 1) % 4]; return s + p[0] * r[1] - r[0] * p[1]; }, 0);
      if (area >= 0) continue;   // 背面剔除
      const z = q.reduce((s, p) => s + p[3], 0) / 4, f = clamp(z / fogFar);
      const col = color.map((v, i) => Math.round((v * light) * (1 - f) + fog[i] * f));
      X.fillStyle = `rgb(${col})`; X.beginPath(); q.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.closePath(); X.fill();
      if (label && idx[0] === 0 && f < .8) {   // 正面贴一张小标签
        const L = (u, v) => [lerp(lerp(q[0][0], q[3][0], u), lerp(q[1][0], q[2][0], u), v), lerp(lerp(q[0][1], q[3][1], u), lerp(q[1][1], q[2][1], u), v)];
        const pts = [L(.35, .25), L(.35, .75), L(.65, .75), L(.65, .25)];
        X.fillStyle = `rgba(245,240,228,${.85 * (1 - f)})`; X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.closePath(); X.fill();
      }
    }
  }
  // 档案长廊：左右两排柜子（每格一个档案盒），地面、天花板、顶灯；返回尽头桌子的位置，方便镜头落点
  function corridor(X, c, { len = 40, width = 3, levels = 5, cell = 1, fog = [10, 10, 12], fogFar = 34, seed = 3 } = {}) {
    const r = FX.rng(seed), items = [], hw = width / 2;
    for (let zi = 0; zi < len; zi++) for (let lv = 0; lv < levels; lv++) for (const side of [-1, 1]) {
      const z = zi * cell, y = -1.6 + lv * .72, inset = .04 + r() * .06, xin = side * hw, xout = side * (hw + .9);
      const shade = 1 - r() * .18;   // 档案盒统一米色，只有明暗差
      items.push({ a: [Math.min(xin, xout) + (side < 0 ? 0 : inset), y, z + .04], b: [Math.max(xin, xout) - (side > 0 ? 0 : inset), y + .64, z + cell - .04], color: [214 * shade, 204 * shade, 184 * shade], label: true });
    }
    items.push({ a: [-hw - 1, -1.7, len + 3], b: [hw + 1, 2.1, len + 3.2], color: [58, 54, 50] });   // 尽头墙
    items.push({ a: [-.9, -1.6, len + 1], b: [.9, -.85, len + 2], color: [190, 182, 168] });   // 尽头的桌子
    items.push({ a: [-.25, -.849, len + 1.3], b: [.25, -.84, len + 1.7], color: [248, 244, 232] });   // 桌上的纸
    // 地面和天花板切成一格一格（整块的话，镜头背后的顶点会让整面被剔掉），并且最先画
    const tz = c.tz || 0, slabs = [];
    for (let zi = -2; zi < len + 3; zi++) for (const [y0, y1, col] of [[-1.7, -1.6, [44, 41, 38]], [2, 2.1, [26, 26, 28]]]) slabs.push({ a: [-hw - 1, y0, zi], b: [hw + 1, y1, zi + 1], color: col });
    slabs.sort((p, q) => Math.abs(q.a[2] - tz) - Math.abs(p.a[2] - tz));
    for (const it of slabs) box3d(X, c, it.a, it.b, { color: it.color, fog, fogFar });
    items.sort((p, q) => Math.abs((q.a[2] + q.b[2]) / 2 - tz) + Math.abs((q.a[0] + q.b[0]) / 2) * .1 - Math.abs((p.a[2] + p.b[2]) / 2 - tz) - Math.abs((p.a[0] + p.b[0]) / 2) * .1);
    for (const it of items) box3d(X, c, it.a, it.b, { color: it.color, fog, fogFar, label: it.label });
    // 顶灯：每 5 格一盏，带光晕
    X.save(); X.globalCompositeOperation = 'lighter';
    for (let zi = 2; zi < len; zi += 5) {
      const p = project([0, 1.95, zi], c); if (!p) continue;
      const rr = Math.min(400, p[2] * .9), f = 1 - clamp(p[3] / fogFar);
      const g = X.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr); g.addColorStop(0, `rgba(255,240,210,${.55 * f})`); g.addColorStop(1, 'rgba(255,240,210,0)');
      X.fillStyle = g; X.fillRect(p[0] - rr, p[1] - rr, rr * 2, rr * 2);
    }
    X.restore();
    return { desk: [0, -.85, len + 1.5] };
  }

  Object.assign(FX, { applyCam, camKeys, camFollow, nest, panels, desat, tint, colorSweep, project, grid3d,
    ptsFromDraw, ptsText, ptsHuman, ptsSphere, ptsGalaxy, ptsDust, shift, morph, cloud, warp, flash,
    skyAt, ridgeLayer, walker, box3d, corridor });
})();
