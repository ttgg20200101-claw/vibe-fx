// 把阿里云 DataV.GeoAtlas 下载的中国省界 GeoJSON 转成 fx-geo.js 能直接加载的 geo/china_provinces.js（window.GEO_CHINA）
// 下载：https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json ，存成 geo/china_provinces.json
// 运行：node geo/convert-china.mjs
import fs from 'fs';
const dir = new URL('.', import.meta.url);
const src = JSON.parse(fs.readFileSync(new URL('china_provinces.json', dir)));
const r = v => Math.round(v * 1000) / 1000;
const out = src.features.map(f => ({
  name: f.properties.name, adcode: f.properties.adcode, center: f.properties.center,
  type: f.geometry.type, coords: JSON.parse(JSON.stringify(f.geometry.coordinates), (k, v) => typeof v === 'number' ? r(v) : v),
}));
fs.writeFileSync(new URL('china_provinces.js', dir),
  '// 由 china_provinces.json（阿里云 DataV.GeoAtlas areas_v3 100000_full）转换，坐标保留 3 位小数\nwindow.GEO_CHINA = ' + JSON.stringify(out) + ';\n');
console.log('saved geo/china_provinces.js', out.length, 'regions');
