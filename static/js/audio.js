// Web Audio 合成音效：雨声、开伞闷响、收伞摩擦、点击
let ctx = null;
let rainNode = null;
let enabled = true;

function ac() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) {
    return null; // 浏览器不支持/禁用音频时静默降级，不影响页面交互
  }
}

export function setSound(on) {
  enabled = on;
  if (!on) stopRain();
}

export function isSoundOn() { return enabled; }

// 雨声：滤波白噪声循环
export function startRain(volume = 0.12) {
  if (!enabled || rainNode) return;
  const a = ac();
  if (!a) return;
  const len = a.sampleRate * 2;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf; src.loop = true;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 0.4;
  const gain = a.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start();
  rainNode = { src, gain };
}

export function setRainVolume(v) {
  if (!rainNode) return;
  const a = ac();
  if (!a) return;
  rainNode.gain.gain.linearRampToValueAtTime(v, a.currentTime + 0.5);
}

export function stopRain() {
  if (rainNode) { try { rainNode.src.stop(); } catch (e) { } rainNode = null; }
}

// 开伞：低频闷响 + 短噪声
export function playOpen() {
  if (!enabled) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.35);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g).connect(a.destination);
  osc.start(t); osc.stop(t + 0.45);
  const nb = noiseBurst(a, t, 0.15, 900, 0.25);
}

// 收伞：下滑摩擦声
export function playClose() {
  if (!enabled) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  noiseBurst(a, t, 0.3, 500, 0.2, 1800);
}

function noiseBurst(a, t, dur, freq, vol, sweepTo) {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = 1;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  return src;
}

export function playClick() {
  if (!enabled) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 660;
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g).connect(a.destination);
  osc.start(t); osc.stop(t + 0.1);
}
