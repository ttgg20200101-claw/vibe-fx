# vibe-fx

**中文** | [English](README.en.md)

让 AI 写代码做动效视频时直接调用的 Canvas 特效库：17 个特效、镜头与 3D、地形晕渲、水墨、真实地图。纯 JavaScript，零依赖，竖屏 1080×1920。

手法来自两处：抖音「Vibe 知识大赏」高赞片的逐帧拆解，和 GitHub 上 9 个高星动效技能。**只学手法，不搬素材**：文案、字体、音乐、画面都没有复制，代码是重新写的。

## 效果预览

<table>
<tr>
<td><img src="preview/fx.gif" width="180" alt="鎏金标题、伤疤印、分形闪电"></td>
<td><img src="preview/cam.gif" width="180" alt="粒子人合体、星空跃迁"></td>
<td><img src="preview/ink.gif" width="180" alt="水墨远山、书法大字"></td>
<td><img src="preview/geo.gif" width="180" alt="横移视差、3D 档案长廊"></td>
</tr>
<tr>
<td align="center">特效：标题 · 伤疤印 · 闪电</td>
<td align="center">镜头与 3D：粒子 · 跃迁</td>
<td align="center">水墨：远山 · 书法</td>
<td align="center">运镜：视差 · 3D 长廊</td>
</tr>
</table>

fx.js 全部特效一览（15 段演示，覆盖 17 个特效）：

![fx.js 全部特效](preview/all-effects.jpg)

| 演示 | 内容 |
|---|---|
| `demo.html` | fx.js 的特效，15 段逐个演示（64 秒） |
| `demo-cam.html` | 镜头与 3D：跟拍、画中画推拉、分屏、调色、点云重组、星空跃迁（41 秒） |
| `demo-map-ink.html` | 地形晕渲地图 + 水墨（26.5 秒） |
| `demo-geo-cam.html` | 真实地图、横移视差一镜到底、3D 档案长廊推进（28 秒） |

## 快速开始

下载仓库后，用 Chrome 直接打开任意 `demo*.html`。底部有播放条：空格播放 / 暂停，← → 前后跳 2 秒，可以拖动进度。

在自己的页面里用：

```html
<canvas id="c" width="1080" height="1920"></canvas>
<script src="fx.js"></script>
<script>
const X = document.getElementById('c').getContext('2d');
function draw(t) {                       // t = 当前秒
  FX.bg(X, t);                           // 暗场鎏金背景
  FX.goldTitle(X, t, 0.5, '容错率', 540, 900, { sub: '人生不是一条线' });
  FX.scar(X, t, 2.5, '失败', 540, 1300);
}
</script>
```

所有函数都是 `t` 的纯函数，可以任意顺序逐帧渲染，适合用 Playwright / Puppeteer 逐帧截图后再用 ffmpeg 合成视频。随机数全部带种子，同一个 `t` 每次画出来都一样。

**加载顺序固定**，需要哪个加载哪个：`fx.js` → `fx-cam.js` → `fx-map.js` → `fx-ink.js`。用真实地图时再加 `geo/world_countries_110m.js`（和可选的 `geo/china_provinces.js`），最后加 `fx-geo.js`。

**约定**：`X` = canvas 2d context；`t` = 当前秒；`t0` = 这个动效开始的秒，通常对齐到台词里某个字出现的时刻。

## 文件

| 文件 | 作用 |
|---|---|
| `fx.js` | 特效库，全局对象 `FX`，17 个特效 + 缓动 / 弹簧工具 |
| `fx-cam.js` | 镜头与 3D：2D 镜头、跟拍、画中画推拉、分屏 ↔ 单格、调色叙事、透视投影、线框地面、点云采样与重组、星空跃迁、白闪、横移视差、3D 方块与长廊。依赖 fx.js |
| `fx-map.js` | 地形晕渲地图：程序生成山地 + 光照明暗（暗棕 / 夜色 / 纸色三套配色，可加等高线），地名点 + 光环。依赖 fx.js |
| `fx-ink.js` | 水墨：宣纸、远近山层层淡出、毛笔笔触、墨滴晕开、书法大字写出来、朱红日。依赖 fx.js + fx-map.js |
| `fx-geo.js` | 真实地理边界：Albers / Natural Earth 投影、描边扩散出现、省份 / 国家高亮、经纬度转屏幕坐标 |
| `geo/world_countries_110m.js` | 世界国界，Natural Earth 1:1.1 亿，177 国，公共领域 |
| `geo/convert-china.mjs` | 把 DataV 的中国省界数据转成 `geo/china_provinces.js`（数据不随仓库附带，见下文） |
| `play.js` | 演示页的播放条 |
| `demo*.html` | 四个演示页 |
| `preview/` | README 里的预览动图和全家福截图 |

## 特效图鉴（fx.js）

| # | 函数 | 是什么 | 什么时候用 |
|---|---|---|---|
| 1 | `bg(X,t)` | 径向暗场 + 暖色散景 + 胶片颗粒 + 暗角 | 暗场鎏金风的底；其他风格可以只用 `grainAndVignette` 压质感 |
| 2 | `blurIn(X,t,t0,s,x,y)` | 字从虚到实、从暗到亮，位移 ≤1% | 字幕、叙述句的默认进场，取代弹出 |
| 3 | `keyMark(X,t,t0,line,key,x,y)` | 一行字里关键词变金或红 + 下划线描出 | 说到关键词的那一帧 |
| 4 | `grow(X,t,t0,dur,pts)` + `path/pointAt/comet` | 发光曲线生长，头部带彗星光点；分支 = 多调用几次、错开 0.18 秒 | 贯穿全片的隐喻线、路径、时间线 |
| 5 | `pulses(...)` + `ring(...)` | 光点沿路流动，到达时冒出椭圆光环 | 传递、数据流、A 到 B |
| 6 | `scar(X,t,t0,s,x,y)` | 红色发光大字砸下 + 椭圆冲击环 | 挫折、反转、判词，一段只用一次 |
| 7 | `odometer(...)` + `ticks(...)` | 逐位翻滚的数字，配刻度尺点亮 | 年份推进、涨了多少 |
| 8 | `slowmo(X,t,{ms,rate})` | 取景框 + 「真实时间 xx.xx 毫秒」+ 慢放倍率 + REC + 帧号 | 把一瞬间拉长讲 |
| 9 | `bolt(X,t,t0,{...})` | 梯级先导一步一停往下走，接地时主通道闪白、全屏闪光 | 闪电、突发、灵感、裂变 |
| 10 | `galton(X,t,t0,{...})` | 高尔顿板：小球逐颗落下，堆出钟形 | 概率、大数、「总会回到平均」 |
| 11 | `flow(X,t,t0,{cx,cy,R})` | 圆柱绕流的流线，虚线顺流移动 | 以柔克刚、绕开阻力、顺势 |
| 12 | `goldTitle(X,t,t0,s,x,y)` | 放射光芒 + 金色渐变宋体逐字浮现 + 拉丁小字 + 两侧细线 | 片头标题、结尾金句 |
| 13 | `seal(X,t,t0,{num,title,i,n})` | 朱红方印砸下 + 章名 + ●○○○○ 进度 | 「五个词」「三个坑」这类分章 |
| 14 | `callout(X,t,t0,{ax,ay,bx,by,cn,en})` | 锚点 → 折线 → 中文 + 英文小字 | 给画面里的东西贴标签 |
| 15 | `zoomSwap(...)` / `cutCurve(...)` | 推进穿越、拉远到达、同向速度切 | 词换词、段落切换、「到达」结论 |
| 16 | `waterfall(X,t,t0,s,x,y,{heavy})` | 逐字从下甩上来，间隔递减，重字走得更远且着金色 | 金句、章首大字 |
| 17 | `trail(X,t,fn)` | 同一个绘制函数在过去几个时间点各画一遍 = 运动残影 | 骰子、飞出的物体 |

工具：`FX.E`（p3o / p4o / p3i / p4i / expo / io 缓动）、`FX.spring(t,w,z)`、`FX.nudge(x)`（慢-快-慢三段位移）、`FX.rng(seed)`、`FX.mix(a,b,k)`、`FX.C`（配色）。

## 镜头与 3D（fx-cam.js）

| 函数 | 作用 |
|---|---|
| `applyCam(X,{x,y,zoom,rot})` | 把镜头对准世界坐标 (x,y)，之后画的东西都在镜头里 |
| `camKeys(t,[[t,{x,y,zoom,rot},ease],…])` | 关键帧镜头，相邻帧之间缓动插值 |
| `camFollow(path,d,{zoom,lead,lag})` | 跟拍沿路径前进的主体 |
| `nest(X,k,rect,drawOuter,drawInner)` | 画中画推入（k 0→1）/ 拉出（k 1→0）。rect 设成一个字、一块屏幕、一页纸都可以 |
| `panels(X,k,[fn…],{focus})` | 分屏 ↔ 单格 |
| `desat(X,k)` / `tint(X,color,k,mode)` / `colorSweep(X,k,gray,color)` | 褪灰 / 整体染色（昼夜）/ 斜光扫过灰变彩 |
| `project(p,cam3)` / `grid3d(X,cam3)` | 透视投影 / 线框地面。cam3 = {yaw,pitch,dist,fov,tx,ty,tz} |
| `ptsText` `ptsHuman` `ptsSphere` `ptsGalaxy` `ptsDust` `ptsFromDraw` `shift` | 点云采样：文字、人形、球、星系、地面尘埃、任意剪影 |
| `morph(A,B,k)` / `cloud(X,pts,cam3,{color})` | 点云错峰走弧线变形 / 远小近大远暗近亮地画出来 |
| `warp(X,t,t0,dur)` / `flash(X,t,tc)` | 星空跃迁 / 一帧白闪过曝 |
| `skyAt(X,camX,[[camX,顶色,底色],…])` | 天色随镜头位置渐变（黎明 → 正午 → 黄昏） |
| `ridgeLayer(X,camX,{depth,base,amp,color,seed})` | 一层可无限横移的山峦剪影；depth 0 最远、1 最近。**需要先加载 fx-map.js** |
| `walker(X,x,y,t,{h})` | 走路的剪影小人 |
| `box3d(X,cam3,[x0,y0,z0],[x1,y1,z1],{color,fog,label})` | 一个 3D 方块（背面剔除、按面打光、远处融进雾里） |
| `corridor(X,cam3,{len})` | 档案长廊：两排柜子、地面天花板、顶灯、尽头墙和桌子 |

用法套路：横移视差的镜头只是一个数 `camX`，按时间走；长廊用 `camKeys` 给 `tz`（前进）、`ty`（升起）、`pitch`（低头）打关键帧。

坑：白闪之后，下一场景要**立刻**有东西，不然会留一段黑；点云离镜头近的点要限制最大半径，否则会变成大圆斑。

## 地形与水墨（fx-map.js / fx-ink.js）

| 函数 | 作用 |
|---|---|
| `terrainCanvas({w,h,seed,scale,ridge,relief,palette,water,contour})` / `terrain(X,opts)` | 生成并画一整张晕渲地形。palette：`sepia` 暗棕、`night` 夜色、`paper` 纸色；`contour` 填数字画等高线。配 `applyCam` + `camKeys` 在上面平移推近 |
| `place(X,t,t0,x,y,name,{ring})` | 地名：发光圆点 + 名字，可选抵达光环 |
| `paper(X)` | 宣纸底（纤维、深浅、四角压暗） |
| `mountains(X,t,{n,top,gap,drift})` | 远近山 n 层，越远越淡越糊，层间雾带，`drift` 控制视差横移速度 |
| `brush(X,t,t0,dur,pts,{width,dry})` | 毛笔笔触沿路径写出来；`dry` 越大飞白越多 |
| `inkDrop(X,t,t0,x,y,{r})` | 墨滴晕开 + 溅墨点 |
| `brushChar(X,t,t0,'道',x,y,{size})` | 楷体大字带墨色肌理，从左上往右下写出来，收尾溅墨 |
| `redSun(X,t,t0,x,y,r)` | 朱红日 |

## 真实地图（fx-geo.js）

| 函数 | 作用 |
|---|---|
| `albers({lon0,lat1,lat2})` / `naturalEarth({lon0})` | 投影：中国用 Albers（默认 105°E，25°/47°N），世界用 Natural Earth |
| `geoMap(X,t,t0,{data:'china'/'world',proj,box,highlight,only,reveal})` | 把整份数据塞进 box 画出来；描边从中心扩散出现；`highlight: {'陕西省': [颜色, 开始秒]}` |
| `geoXY(data,proj,box,lon,lat)` | 经纬度 → 屏幕坐标，用来放 `place`、`grow`、`pulses` |

**中国省界数据不随仓库附带**，需要的话自己生成：

1. 下载 `https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json`（阿里云 DataV.GeoAtlas），存成 `geo/china_provinces.json`
2. 运行 `node geo/convert-china.mjs`，得到 `geo/china_provinces.js`

**合规提醒**：在国内公开发布的内容里出现中国地图，要画完整国界，**不要裁掉台湾、南海诸岛**；镜头推近局部是可以的。`data:'world'` 里中国的边界不一定合规，只在镜头不涉及中国的场景用。DataV 数据本身没有审图号，要求严格时请改用自然资源部标准地图服务（带审图号的底图）。

坑：世界地图的中心经度保持 0，靠 box 平移取景；跨地图接缝的线已自动断开。

## 动效纪律（违反就会「像 PPT」）

1. **概念说出口的同一帧，主视觉就位**，容差 +0.5 秒
2. **锯齿形密度**：每 1–2 秒加一件小东西，同屏约 3 个视觉对象；段尾整组退场，留 1–1.5 秒净屏
3. **到位即静止**：不要呼吸、漂浮这类常驻微动。画面活性靠「下一次增量」
4. **只有「过程即信息」的东西才慢**：数字滚动约 1 秒、曲线生长约 0.55–3 秒；大字进场约 0.33 秒，退场比进场快
5. **转场讲速度连续**：切点落在运动中途，两侧同方向、同速度，不交叉溶。全片只用 2–3 种转场
6. **一段一个大动作**：`scar`、震屏这类重锤，整片 ≤2 处
7. **动作和结果之间留 0.3–0.75 秒的静默**，结论才有分量
8. **不预铺骨架**：还没讲到的线、框、占位，一律不画
9. **事实是硬约束**：数字和研究只用有出处的，示意内容标「示意」

## 字体

默认用 macOS 自带的宋体（Songti SC）、苹方（PingFang SC）、楷体（STKaiti），找不到时退回 Noto Serif SC 等。Windows / Linux 上建议先装 Noto Serif SC / Noto Sans SC，效果最接近。

## 致谢

动效手法参考了这些开源项目（只学思路，代码是重新写的）：
heygen-com/hyperframes、jincheng2026/jc-remotion-skills、charlie947/motion-graphics-skills、Barty-Bart/motion-graphics、tuzhechen2005/opus-video-skills、bangtutorial/bang-motion、nateherkai/herk-edit-kit、iart-ai/motion-skills、latent-spaces/brag。

地理数据：[Natural Earth](https://www.naturalearthdata.com/)（公共领域）；中国省界由使用者自行从阿里云 DataV.GeoAtlas 下载。

## 作者

Bowen · 20 年产品人，亲手用 AI 解决 100 个真实问题 · AI 实战 100 例

抖音：[Bowen的AI实战笔记](https://www.douyin.com/user/MS4wLjABAAAAsVy4x0FpjE8j4epQQZtZkg2OOU2Vb3G5UweYp5ZZwd0)（抖音号 1083328779）

其他开源项目：
- [meeting-minutes](https://github.com/ttgg20200101-claw/meeting-minutes)：跟 AI 说「开会」就录音，说「结束」就出会议纪要并核实事实说法
- [workbuddy-bridge](https://github.com/ttgg20200101-claw/workbuddy-bridge)：让 AI 当监工、WorkBuddy 当员工

## License

MIT
