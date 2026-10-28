// 落地页：2D 雨幕 + 旋转伞主视觉
import { UmbrellaScene } from '../umbrella.js';
import { drawTexture } from '../store.js';

let umb = null;

// 2D 雨幕背景
function startRainCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  let w, h, drops;
  function resize() {
    w = canvas.width = canvas.clientWidth * devicePixelRatio;
    h = canvas.height = canvas.clientHeight * devicePixelRatio;
    drops = Array.from({ length: 130 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      l: 12 + Math.random() * 18, v: 6 + Math.random() * 7,
    }));
  }
  resize();
  window.addEventListener('resize', resize);
  let running = true;
  (function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!document.contains(canvas)) { running = false; return; }
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(200,220,235,.35)';
    ctx.lineWidth = devicePixelRatio;
    ctx.beginPath();
    for (const d of drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + d.l);
      d.y += d.v;
      if (d.y > h) { d.y = -d.l; d.x = Math.random() * w; }
    }
    ctx.stroke();
  })();
}

export function enterLanding() {
  drawTexture();
  if (!umb) {
    umb = new UmbrellaScene(document.getElementById('landingCanvas'));
    umb.autoSpin = true;
    umb.angleX = .18;
  }
  umb.start();
  startRainCanvas(document.getElementById('landingRain'));
}

export function leaveLanding() { umb && umb.stop(); }
