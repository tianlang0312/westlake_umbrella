// 第二幕 · 制伞：六步工序交互（选竹→削骨→组装→糊面→绘纹→刷油）
import { UmbrellaScene } from '../umbrella.js';
import { store, texCtx, drawTexture } from '../store.js';
import { playClick, playOpen } from '../audio.js';

let umb = null, cur = 0, bound = false;
const STEP_NAMES = ['选竹', '削骨', '组装', '糊面', '绘纹', '刷油'];
const STEP_KEYS = ['zhu', 'gu', 'zhuang', 'hu', 'hui', 'you'];
const EGGS = {
  zhu: '🎋 竹龄与韧性：五年生冬竹坚韧适中；太嫩易弯，太老易脆。蒸煮后还能防蛀。',
  gu: '🦴 伞骨数量与张力：骨条越多伞面越圆挺。余杭纸伞常见 32～44 根骨，根根要等距等弧。',
  zhuang: '🔧 伞骨套合技艺：西湖绸伞特色——骨与槽严丝合缝，开合顺滑无声，全凭手感。',
  hu: '📜 柿漆防水原理：青柿汁发酵成漆，粘合伞面与伞骨，自身亦防水，是"隐形缝线"。',
  hui: '🎨 纹样寓意：荷花寓"和合"，山水寓"栖居"，一笔一画都是祝福。',
  you: '🛢️ 桐油防水：刷油后氧化成膜，"纸伞不惧雨"。刷三遍、晒三日，方成一把好伞。',
};

export function enterMake() {
  drawTexture();
  if (!umb) {
    umb = new UmbrellaScene(document.getElementById('makeCanvas'));
    umb.bindDrag();
  }
  umb.start();
  // 根据进度恢复伞的状态
  umb.setRibCount(store.stepsDone.gu ? 16 : store.stepsDone.zhu ? 4 : 0);
  umb.setCanopyVisible(store.stepsDone.hu);
  umb.setOiled(store.stepsDone.you);
  umb.openness = umb.targetOpen = store.stepsDone.zhuang ? .6 : .2;
  if (!bound) {
    bound = true;
    document.getElementById('stepPrev').onclick = () => go(cur - 1);
    document.getElementById('stepNext').onclick = () => go(cur + 1);
  }
  go(firstUndone());
}

export function leaveMake() { umb && umb.stop(); }

function firstUndone() {
  const i = STEP_KEYS.findIndex(k => !store.stepsDone[k]);
  return i === -1 ? 5 : i;
}

function go(n) {
  cur = Math.max(0, Math.min(5, n));
  renderProgress();
  renderStep();
  updateNav();
  const egg = document.getElementById('knowledgeEgg');
  egg.classList.remove('hidden');
  egg.textContent = EGGS[STEP_KEYS[cur]];
}

function renderProgress() {
  document.getElementById('stepProgress').innerHTML = STEP_NAMES.map((n, i) =>
    `<span class="sp ${store.stepsDone[STEP_KEYS[i]] ? 'done' : i === cur ? 'cur' : ''}">${i + 1} ${n}${store.stepsDone[STEP_KEYS[i]] ? ' ✓' : ''}</span>`
  ).join('');
}

function updateNav() {
  document.getElementById('stepPrev').disabled = cur === 0;
  const done = store.stepsDone[STEP_KEYS[cur]];
  const next = document.getElementById('stepNext');
  next.disabled = !done;
  next.textContent = cur === 5 ? '去撑伞 →' : '下一步 →';
  if (cur === 5) next.onclick = () => { location.hash = '#/play'; };
  else next.onclick = () => go(cur + 1);
}

function done(key) {
  store.stepsDone[key] = true;
  playClick();
  renderProgress();
  updateNav();
}

function renderStep() {
  const body = document.getElementById('stepBody');
  const key = STEP_KEYS[cur];
  if (key === 'zhu') renderZhu(body);
  else if (key === 'gu') renderGu(body);
  else if (key === 'zhuang') renderZhuang(body);
  else if (key === 'hu') renderHu(body);
  else if (key === 'hui') renderHui(body);
  else renderYou(body);
}

/* ---- 1 选竹 ---- */
function renderZhu(body) {
  body.innerHTML = `
    <h3>第一步 · 选竹</h3>
    <p class="step-desc">点击挑选一段竹龄合适的毛竹。竹龄不对，伞骨不牢。</p>
    <div class="bamboo-row">
      <button class="bamboo-card" data-ok="0">🎋<br>一年嫩竹<br><small>太软</small></button>
      <button class="bamboo-card" data-ok="1">🎋<br>五年冬竹<br><small>坚韧适中</small></button>
      <button class="bamboo-card" data-ok="0">🎋<br>十年老竹<br><small>太脆</small></button>
    </div>
    <p class="step-desc" id="zhuMsg">匠人经验：冬竹糖分低、不易蛀。</p>`;
  body.querySelectorAll('.bamboo-card').forEach(c => {
    c.onclick = () => {
      if (c.dataset.ok === '1') {
        c.classList.add('good');
        document.getElementById('zhuMsg').textContent = '好竹！竹段劈开，可以制骨了。';
        umb.setRibCount(4); // 先出几根骨示意
        done('zhu');
      } else {
        c.classList.add('bad');
        document.getElementById('zhuMsg').textContent = '这段竹子不合格，碎裂废弃了……再挑挑。';
      }
    };
  });
}

/* ---- 2 削骨 ---- */
function renderGu(body) {
  body.innerHTML = `
    <h3>第二步 · 削骨</h3>
    <p class="step-desc">在竹面上<strong>按住并左右拖动</strong>，把骨条打磨出弧度。竹屑纷飞中，伞骨渐成。</p>
    <div class="rub-zone" id="rubZone"></div>
    <div class="progress-bar"><i id="rubBar"></i></div>
    <p class="step-desc" id="guMsg">打磨进度 0%</p>`;
  const zone = body.querySelector('#rubZone');
  let prog = 0, lastX = null, active = false;
  zone.addEventListener('pointerdown', e => { active = true; lastX = e.clientX; try { zone.setPointerCapture(e.pointerId); } catch (_) { } });
  zone.addEventListener('pointerup', () => { active = false; lastX = null; });
  zone.addEventListener('pointermove', e => {
    if (!active || lastX === null) return;
    prog = Math.min(100, prog + Math.abs(e.clientX - lastX) * .35);
    lastX = e.clientX;
    body.querySelector('#rubBar').style.width = prog + '%';
    body.querySelector('#guMsg').textContent = '打磨进度 ' + Math.round(prog) + '%';
    umb.setRibCount(Math.max(4, Math.round(prog / 100 * 16)));
    if (prog >= 100) {
      body.querySelector('#guMsg').textContent = '十六根伞骨，根根弧度如一！';
      done('gu');
    }
  });
}

/* ---- 3 组装 ---- */
function renderZhuang(body) {
  body.innerHTML = `
    <h3>第三步 · 组装</h3>
    <p class="step-desc">连续点击"卡入伞骨"，看骨架从收拢到张开。</p>
    <button class="btn-primary" id="assembleBtn">卡入一组伞骨</button>
    <div class="progress-bar"><i id="asmBar"></i></div>
    <p class="step-desc" id="asmMsg">已组装 0 / 4 组</p>`;
  let n = 0;
  body.querySelector('#assembleBtn').onclick = () => {
    n = Math.min(4, n + 1);
    umb.targetOpen = .2 + n * .1;
    umb.open();
    umb.targetOpen = .2 + n * .1;
    body.querySelector('#asmBar').style.width = n * 25 + '%';
    body.querySelector('#asmMsg').textContent = `已组装 ${n} / 4 组`;
    playClick();
    if (n >= 4) {
      body.querySelector('#asmMsg').textContent = '骨架张开！机关锁扣"咔哒"一声就位。';
      playOpen();
      done('zhuang');
    }
  };
}

/* ---- 4 糊面 ---- */
function renderHu(body) {
  body.innerHTML = `
    <h3>第四步 · 糊面</h3>
    <p class="step-desc"><strong>长按</strong>下方按钮，把桃花纸用柿漆裱糊上骨。纸面贴合，接缝消失。</p>
    <button class="btn-primary hold-btn" id="holdHu"><span class="fill"></span><span style="position:relative">长按裱糊</span></button>
    <div class="progress-bar"><i id="huBar"></i></div>`;
  bindHold(body.querySelector('#holdHu'), p => {
    body.querySelector('#huBar').style.width = p * 100 + '%';
    umb.setCanopyVisible(true);
    umb.setCanopyOpacity(p);
  }, () => {
    umb.setCanopyOpacity(1);
    done('hu');
  });
}

/* ---- 5 绘纹 ---- */
const THEMES = {
  shanshui: { name: '西湖山水', fn: drawShanshui },
  hehua: { name: '荷花', fn: drawHehua },
  huaniao: { name: '花鸟', fn: drawHuaniao },
  yanyu: { name: '烟雨', fn: drawYanyu },
};
let curTheme = 'shanshui', curColor = '#334a48';

function renderHui(body) {
  body.innerHTML = `
    <h3>第五步 · 绘伞成韵</h3>
    <p class="step-desc">选一套纹样元素，或自己提笔；图案实时映射到右侧伞面。</p>
    <div class="pattern-lib">${Object.entries(THEMES).map(([k, v]) =>
    `<button class="pattern-item ${k === curTheme ? 'active' : ''}" data-t="${k}">${v.name}</button>`).join('')}
    </div>
    <div class="field"><label>配色</label><div class="color-row" id="colorRow"></div></div>
    <div class="field"><label>提笔绘制（在下方纸面拖动）</label><canvas class="draw-pad" id="drawPad" width="512" height="512"></canvas></div>
    <details class="field"><summary style="cursor:pointer;font-size:13px">📷 也可以上传照片，AI 国风化处理</summary>
      <div class="field"><input type="file" id="huiUpload" accept="image/png,image/jpeg,image/webp,image/bmp"></div>
      <div class="field"><label>艺术效果</label><select id="huiStyle">
        <option value="ink">水墨晕染</option><option value="gongbi">工笔描线</option><option value="pastel">江南淡彩</option>
      </select></div>
      <button class="btn-primary" id="huiConvert">生成并映射到伞面</button>
      <p class="step-desc" id="huiMsg"></p>
    </details>
    <div class="row-flex">
      <div class="field" style="flex:1"><label>缩放 <span id="sv">${store.scale}%</span></label><input type="range" id="scaleR" min="50" max="180" value="${store.scale}"></div>
      <div class="field" style="flex:1"><label>旋转 <span id="rv">${store.rotate}°</span></label><input type="range" id="rotR" min="-180" max="180" value="${store.rotate}"></div>
    </div>`;

  // 配色
  const colors = ['#334a48', '#86a59a', '#d8a6a1', '#c9a063', '#5d4037', '#2e4057'];
  const row = body.querySelector('#colorRow');
  colors.forEach(c => {
    const d = document.createElement('span');
    d.className = 'color-dot' + (c === curColor ? ' active' : '');
    d.style.background = c;
    d.onclick = () => {
      curColor = c;
      row.querySelectorAll('.color-dot').forEach(x => x.classList.remove('active'));
      d.classList.add('active');
      THEMES[curTheme].fn(curColor);
      umb.refreshTexture();
    };
    row.appendChild(d);
  });

  // 主题
  body.querySelectorAll('.pattern-item').forEach(b => {
    b.onclick = () => {
      curTheme = b.dataset.t;
      body.querySelectorAll('.pattern-item').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      THEMES[curTheme].fn(curColor);
      umb.refreshTexture();
      redrawPad();
    };
  });

  // 画板（直接画到纹理画布）
  const pad = body.querySelector('#drawPad');
  redrawPad();
  let drawing = false;
  const pos = e => {
    const r = pad.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * 1024, (e.clientY - r.top) / r.height * 1024];
  };
  pad.addEventListener('pointerdown', e => { drawing = true; try { pad.setPointerCapture(e.pointerId); } catch (_) { } const [x, y] = pos(e); dot(x, y); });
  pad.addEventListener('pointerup', () => drawing = false);
  pad.addEventListener('pointermove', e => { if (drawing) { const [x, y] = pos(e); dot(x, y); } });
  function dot(x, y) {
    texCtx.save();
    texCtx.beginPath(); texCtx.arc(512, 512, 490, 0, Math.PI * 2); texCtx.clip();
    texCtx.fillStyle = curColor;
    texCtx.beginPath(); texCtx.arc(x, y, 7, 0, Math.PI * 2); texCtx.fill();
    texCtx.restore();
    umb.texture.needsUpdate = true;
    redrawPad();
  }

  // 缩放旋转
  body.querySelector('#scaleR').oninput = e => { store.scale = +e.target.value; body.querySelector('#sv').textContent = store.scale + '%'; umb.refreshTexture(); redrawPad(); };
  body.querySelector('#rotR').oninput = e => { store.rotate = +e.target.value; body.querySelector('#rv').textContent = store.rotate + '°'; umb.refreshTexture(); redrawPad(); };

  // 上传 AI 风格化（沿用原后端接口）
  body.querySelector('#huiConvert').onclick = async () => {
    const f = body.querySelector('#huiUpload').files[0];
    const msg = body.querySelector('#huiMsg');
    if (!f) { msg.textContent = '请先选择图片'; return; }
    const data = new FormData();
    data.append('image', f); data.append('style', body.querySelector('#huiStyle').value);
    msg.textContent = '正在进行国风图像处理……';
    try {
      const r = await fetch('/api/stylize', { method: 'POST', body: data });
      const res = await r.json();
      if (!r.ok) throw Error(res.error || '处理失败');
      const img = new Image();
      img.onload = () => { store.patternImg = img; umb.refreshTexture(); redrawPad(); msg.textContent = '已映射到伞面！'; };
      img.src = res.image;
    } catch (e) { msg.textContent = '错误：' + e.message; }
  };

  if (!store.stepsDone.hui) done('hui'); // 进入绘纹即视为可继续（纹样可选）
}

function redrawPad() {
  const pad = document.getElementById('drawPad');
  if (!pad) return;
  pad.getContext('2d').drawImage(texCtx.canvas, 0, 0, 512, 512);
}

/* 主题纹样绘制（画在纹理画布上） */
function themeBase(color) {
  store.patternImg = null;
  drawTexture();
  texCtx.save();
  texCtx.beginPath(); texCtx.arc(512, 512, 490, 0, Math.PI * 2); texCtx.clip();
  texCtx.strokeStyle = texCtx.fillStyle = color;
  return texCtx;
}
function themeEnd() { texCtx.restore(); overlayRibs(); }

function overlayRibs() {
  texCtx.strokeStyle = '#334a4840'; texCtx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    texCtx.beginPath(); texCtx.moveTo(512, 512);
    texCtx.lineTo(512 + 490 * Math.cos(a), 512 + 490 * Math.sin(a)); texCtx.stroke();
  }
  texCtx.strokeStyle = '#334a48'; texCtx.lineWidth = 10;
  texCtx.beginPath(); texCtx.arc(512, 512, 490, 0, Math.PI * 2); texCtx.stroke();
}

function drawShanshui(color) {
  const c = themeBase(color);
  c.lineWidth = 6;
  // 远山
  c.globalAlpha = .25;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    for (let x = 60; x <= 964; x += 4) {
      const y = 700 - k * 90 - Math.abs(Math.sin(x * .008 + k * 2)) * 130;
      x === 60 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }
  // 近山
  c.globalAlpha = .8;
  c.beginPath();
  for (let x = 60; x <= 964; x += 4) {
    const y = 760 - Math.abs(Math.sin(x * .006)) * 190;
    x === 60 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.stroke();
  // 日
  c.globalAlpha = .9;
  c.beginPath(); c.arc(700, 300, 55, 0, Math.PI * 2); c.stroke();
  // 扁舟
  c.globalAlpha = .7;
  c.beginPath(); c.moveTo(360, 820); c.quadraticCurveTo(430, 850, 500, 820); c.stroke();
  c.beginPath(); c.moveTo(430, 820); c.lineTo(430, 770); c.stroke();
  c.globalAlpha = 1;
  themeEnd();
}

function drawHehua(color) {
  const c = themeBase(color);
  // 荷花两朵
  for (const [cx, cy, s] of [[350, 420, 1], [660, 620, .8]]) {
    for (let p = 0; p < 8; p++) {
      const a = p * Math.PI / 4;
      c.save(); c.translate(cx, cy); c.rotate(a); c.scale(s, s);
      c.globalAlpha = .75;
      c.beginPath(); c.ellipse(0, -46, 20, 48, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    c.globalAlpha = .9;
    c.beginPath(); c.arc(cx, cy, 16 * s, 0, Math.PI * 2); c.fill();
  }
  // 荷叶
  c.globalAlpha = .3;
  for (const [cx, cy, r] of [[600, 380, 90], [330, 660, 110], [700, 760, 80]]) {
    c.beginPath(); c.arc(cx, cy, r, .3, Math.PI * 1.7); c.stroke();
  }
  c.globalAlpha = 1;
  themeEnd();
}

function drawHuaniao(color) {
  const c = themeBase(color);
  c.lineWidth = 5;
  // 梅枝
  c.beginPath(); c.moveTo(180, 850); c.quadraticCurveTo(420, 560, 700, 430); c.stroke();
  c.beginPath(); c.moveTo(430, 620); c.quadraticCurveTo(560, 560, 640, 600); c.stroke();
  // 花
  for (const [x, y] of [[380, 640], [500, 560], [620, 480], [560, 600], [680, 560], [300, 730]]) {
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5;
      c.beginPath(); c.arc(x + Math.cos(a) * 13, y + Math.sin(a) * 13, 10, 0, Math.PI * 2); c.stroke();
    }
    c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
  }
  // 鸟
  c.lineWidth = 4;
  c.beginPath(); c.moveTo(720, 350); c.quadraticCurveTo(760, 320, 760, 360); c.quadraticCurveTo(790, 330, 820, 350); c.stroke();
  c.beginPath(); c.moveTo(640, 280); c.quadraticCurveTo(672, 256, 672, 288); c.quadraticCurveTo(696, 262, 720, 280); c.stroke();
  themeEnd();
}

function drawYanyu(color) {
  const c = themeBase(color);
  // 雨丝
  c.lineWidth = 3; c.globalAlpha = .5;
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024, l = 20 + Math.random() * 40;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - l * .25, y + l); c.stroke();
  }
  // 湖面涟漪
  c.globalAlpha = .6; c.lineWidth = 4;
  for (const [cx, cy] of [[350, 700], [650, 780], [512, 850]]) {
    for (let r = 20; r < 90; r += 24) {
      c.beginPath(); c.ellipse(cx, cy, r, r * .32, 0, 0, Math.PI * 2); c.stroke();
    }
  }
  c.globalAlpha = 1;
  themeEnd();
}

/* ---- 6 刷油 ---- */
function renderYou(body) {
  body.innerHTML = `
    <h3>第六步 · 刷油</h3>
    <p class="step-desc"><strong>长按</strong>刷桐油，看伞面光泽渐现——纸伞从此不惧雨。</p>
    <button class="btn-primary hold-btn" id="holdYou"><span class="fill"></span><span style="position:relative">长按刷油</span></button>
    <div class="progress-bar"><i id="youBar"></i></div>`;
  bindHold(body.querySelector('#holdYou'), p => {
    body.querySelector('#youBar').style.width = p * 100 + '%';
    umb.canopyMat.roughness = .95 - p * .6;
  }, () => {
    umb.setOiled(true);
    done('you');
  });
}

// 长按进度工具
function bindHold(btn, onProgress, onDone) {
  let raf = null, t0 = 0;
  const DUR = 1400;
  const fill = btn.querySelector('.fill');
  function tick() {
    const p = Math.min(1, (performance.now() - t0) / DUR);
    fill.style.width = p * 100 + '%';
    onProgress(p);
    if (p >= 1) { onDone(); return; }
    raf = requestAnimationFrame(tick);
  }
  btn.addEventListener('pointerdown', () => { t0 = performance.now(); tick(); });
  const cancel = () => { cancelAnimationFrame(raf); };
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
}
