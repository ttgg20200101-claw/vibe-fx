// 演示页播放器：读页面的 window.VIDEO 和 window.seek(t)，在浏览器里实时播放。
// 空格 播放/暂停，← → 前后 2 秒，拖进度条跳转。画布按窗口高度缩放显示，渲染尺寸不变。
(() => {
  const cv = document.querySelector('canvas'), dur = window.VIDEO.duration;
  cv.style.cssText = 'display:block;height:calc(100vh - 56px);width:auto;margin:0 auto';
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;background:#111;color:#ddd;font:14px Menlo,monospace';
  bar.innerHTML = '<button style="width:64px;height:32px;font:inherit">暂停</button><input type="range" min="0" step="0.01" style="flex:1"><span></span>';
  document.body.appendChild(bar);
  const [btn, range, label] = bar.children;
  range.max = dur;
  let t = 0, playing = true, last = performance.now();
  const show = () => { window.seek(t); range.value = t; label.textContent = `${t.toFixed(1)} / ${dur.toFixed(1)}s`; btn.textContent = playing ? '暂停' : '播放'; };
  const toggle = () => { playing = !playing; last = performance.now(); show(); };
  btn.onclick = toggle;
  range.oninput = () => { t = +range.value; show(); };
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { t = Math.min(dur, Math.max(0, t + (e.code === 'ArrowLeft' ? -2 : 2))); show(); }
  });
  const loop = now => {
    if (playing) { t = (t + Math.max(0, now - last) / 1000) % dur; show(); }   // 第一帧的时间戳可能早于 last，差值不能为负
    last = now; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
