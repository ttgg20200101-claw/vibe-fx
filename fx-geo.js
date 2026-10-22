// vibe-fx · 真实地理边界（依赖 fx.js；数据文件要先加载）
//   <script src="geo/china_provinces.js"></script>       → window.GEO_CHINA（阿里云 DataV，35 个区域，含台湾、港澳、南海诸岛；仓库不附带，用 geo/convert-china.mjs 自己生成）
//   <script src="geo/world_countries_110m.js"></script>  → window.GEO_WORLD（Natural Earth 1:1.1 亿，177 个国家，公共领域）
// 合规提醒：国内公开发布的视频里出现中国地图，用 GEO_CHINA（带南海诸岛）且画完整国界，不要裁掉台湾、南海诸岛；
// GEO_WORLD 里中国的边界不一定合规，只在镜头不涉及中国边界的场景用（比如讲欧美、大西洋）。
(() => {
  const { E, seg } = FX;
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  const R = Math.PI / 180;

  // ---------- 投影：输入经纬度（度），输出平面坐标（y 向上） ----------
  function albers({ lon0 = 105, lat1 = 25, lat2 = 47, lat0 = 0 } = {}) {   // 中国地图常用的等积圆锥投影
    const p1 = lat1 * R, p2 = lat2 * R, n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1), r0 = Math.sqrt(C - 2 * n * Math.sin(lat0 * R)) / n;
    return { key: `albers${lon0},${lat1},${lat2},${lat0}`, fn: (lon, lat) => { const r = Math.sqrt(C - 2 * n * Math.sin(lat * R)) / n, th = n * (lon - lon0) * R; return [r * Math.sin(th), r0 - r * Math.cos(th)]; } };
  }
  function naturalEarth({ lon0 = 0 } = {}) {                                // 世界地图常用，比墨卡托不变形
    return { key: `ne${lon0}`, fn: (lon, lat) => {
      let d = lon - lon0; if (d > 180) d -= 360; if (d < -180) d += 360;   // 正好 180° 的点不折成 -180°
      const l = d * R, p = lat * R, p2 = p * p, p4 = p2 * p2;
      return [l * (.8707 - .131979 * p2 + p4 * (-.013791 + p4 * (.003971 * p2 - .001529 * p4))), p * (1.007226 + p2 * (.015085 + p4 * (-.044475 + .028874 * p2 - .005916 * p4)))];
    } };
  }

  const dataOf = d => d === 'world' ? window.GEO_WORLD : d === 'china' ? window.GEO_CHINA : d;
  const rings = f => f.type === 'Polygon' ? f.coords : f.coords.flat(1);   // 所有外环和洞

  // 把整份数据按投影塞进 box，返回把经纬度换成屏幕坐标的函数（结果缓存）
  function fit(data, proj, box) {
    return memo(`fit${data}${proj.key}${JSON.stringify(box)}`, () => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const f of dataOf(data)) for (const ring of rings(f)) for (const [lo, la] of ring) { const [x, y] = proj.fn(lo, la); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const s = Math.min(box.w / (x1 - x0), box.h / (y1 - y0)), ox = box.x + (box.w - (x1 - x0) * s) / 2, oy = box.y + (box.h - (y1 - y0) * s) / 2;
      return (lon, lat) => { const [x, y] = proj.fn(lon, lat); return [ox + (x - x0) * s, oy + (y1 - y) * s]; };
    });
  }
  function paths(data, proj, box) {
    return memo(`paths${data}${proj.key}${JSON.stringify(box)}`, () => {
      const xy = fit(data, proj, box);
      return dataOf(data).map(f => {
        const p = new Path2D();
        for (const ring of rings(f)) {
          let prev = null;
          ring.forEach(([lo, la]) => {   // 投影后横向跳了半张图以上（跨地图接缝）就断开，不然会横贯全图连一条线
            const [x, y] = xy(lo, la);
            if (prev === null || Math.abs(x - prev) > box.w * .5) p.moveTo(x, y); else p.lineTo(x, y);
            prev = x;
          });
        }
        return { name: f.name, path: p, f };
      });
    });
  }
  // 经纬度 → 屏幕坐标（和 geoMap 用同一套 data / proj / box）
  const geoXY = (data, proj, box, lon, lat) => fit(data, proj, box)(lon, lat);

  // ---------- 画地图：描边从 reveal 中心向外扩散出现，指定区域按时间高亮 ----------
  // highlight = { '陕西省': ['#E3B35E', 2.4], ... }  名字 → [颜色, 开始秒]
  function geoMap(X, t, t0, { data = 'china', proj = albers(), box = { x: 60, y: 300, w: 960, h: 1300 }, stroke = 'rgba(227,179,94,.8)', lineWidth = 1.6, fill = 'rgba(227,179,94,.06)', reveal = 1.6, highlight = {}, only = null, cx = null, cy = null } = {}) {
    const k = E.p3o(seg(t, t0, t0 + reveal)); if (k <= 0) return;
    const P = paths(data, proj, box), ox = cx ?? box.x + box.w / 2, oy = cy ?? box.y + box.h / 2, rad = Math.hypot(box.w, box.h) * .75 * k;
    X.save(); X.beginPath(); X.arc(ox, oy, rad, 0, 7); X.clip();
    X.lineJoin = 'round';
    for (const { name, path } of P) {
      if (only && !only.includes(name)) continue;
      const h = highlight[name], hk = h ? E.p3o(seg(t, h[1], h[1] + .5)) : 0;
      X.fillStyle = fill; X.fill(path);
      if (hk > 0) { X.save(); X.globalAlpha = hk; X.fillStyle = h[0]; X.shadowColor = h[0]; X.shadowBlur = 30; X.fill(path); X.restore(); }
      X.strokeStyle = stroke; X.lineWidth = lineWidth; X.stroke(path);
    }
    X.restore();
    if (k < 1) { X.save(); X.strokeStyle = 'rgba(255,230,180,.5)'; X.lineWidth = 3; X.beginPath(); X.arc(ox, oy, rad, 0, 7); X.stroke(); X.restore(); }
  }

  Object.assign(FX, { albers, naturalEarth, geoMap, geoXY });
})();
