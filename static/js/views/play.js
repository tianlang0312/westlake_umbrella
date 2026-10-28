// 第三幕 · 撑伞：江南雨夜舞台 + AI 手势 + 十景彩蛋 + 纪念卡
import * as THREE from 'three';
import { UmbrellaScene } from '../umbrella.js';
import { RainSystem } from '../rain.js';
import { GestureController } from '../gesture.js';
import { store, texCanvas, SCENES, randomProverb, drawTexture } from '../store.js';
import { startRain, stopRain, setRainVolume, playOpen, playClose, playClick } from '../audio.js';

let umb = null, rain = null, gesture = null, bound = false;
let manual = false, finished = false;
let skelCtx = null;

export function enterPlay() {
  drawTexture();
  if (!umb) {
    umb = new UmbrellaScene(document.getElementById('playCanvas'), { night: true });
    umb.bindDrag();
    umb.openness = umb.targetOpen = .12; // 初始收伞
    umb.angleX = .12;
    // 地面（雨夜湿意）
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: .35, metalness: .5 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.6;
    umb.scene.add(ground);
    rain = new RainSystem(umb.scene);
  }
  umb.start();
  startRain(.1);
  finished = false;
  if (!bound) {
    bound = true;
    bindUI();
  }
  animateRain();
  setStatus('江南夜雨。启用手势或手动模式，撑开你的伞。');
}

export function leavePlay() {
  umb && umb.stop();
  stopRain();
  gesture && gesture.stop();
  document.getElementById('playCamWrap').classList.add('hidden');
}

function setStatus(s) { document.getElementById('playStatus').textContent = s; }

let rainRAF = null;
function animateRain() {
  cancelAnimationFrame(rainRAF);
  const loop = () => {
    rainRAF = requestAnimationFrame(loop);
    if (document.getElementById('view-play').classList.contains('hidden')) return;
    rain.update({ openness: umb.openness, x: umb.root.position.x, z: umb.root.position.z });
    checkSceneTip();
  };
  loop();
}

// 西湖十景彩蛋：拉近镜头时按伞面朝向显示对应景
let lastScene = -1;
function checkSceneTip() {
  const tip = document.getElementById('sceneTip');
  if (umb.openness > .7 && umb.zoom < 6.4) {
    const idx = Math.floor(((umb.root.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * 10);
    if (idx !== lastScene) {
      lastScene = idx;
      const [name, desc] = SCENES[idx];
      tip.innerHTML = `<b>☂ ${name}</b><br>${desc}`;
      tip.classList.remove('hidden');
    }
  } else {
    tip.classList.add('hidden');
    lastScene = -1;
  }
}

function bindUI() {
  const video = document.getElementById('playCam');
  skelCtx = document.getElementById('playSkel').getContext('2d');

  gesture = new GestureController(video, {
    onStatus: setStatus,
    onOpen: () => { if (!finished) { umb.open(); playOpen(); setStatus('识别：张掌 → 伞徐徐撑开，雨被挡在伞外'); } },
    onFist: () => { if (!finished) { umb.close(); playClose(); setStatus('识别：握拳 → 伞收拢，雨淋下来了'); } },
    onMove: (dx, dy) => {
      if (finished) return;
      umb.root.position.x = Math.max(-4, Math.min(4, umb.root.position.x + dx * 6));
      umb.angleX = Math.max(-.6, Math.min(.65, umb.angleX + dy * 1.5));
    },
    onTurn: da => { umb.angleY += da * 2; },
    onFrame: drawSkeleton,
  });

  document.getElementById('playGesture').onclick = async e => {
    const btn = e.target;
    if (gesture.running) {
      gesture.stop();
      document.getElementById('playCamWrap').classList.add('hidden');
      btn.textContent = '启用摄像头手势';
      setStatus('摄像头已关闭');
      return;
    }
    try {
      await gesture.start();
      document.getElementById('playCamWrap').classList.remove('hidden');
      btn.textContent = '关闭摄像头';
    } catch (err) {
      setStatus('无法启动摄像头：' + err.message + '。可用手动模式。');
    }
  };

  document.getElementById('playManual').onclick = () => {
    manual = !manual;
    document.getElementById('manualBtns').classList.toggle('hidden', !manual);
    setStatus(manual ? '手动模式：按钮控制开合，拖动旋转，滚轮缩放' : '手动模式已关闭');
  };
  document.getElementById('playOpen').onclick = () => { umb.open(); playOpen(); };
  document.getElementById('playClose').onclick = () => { umb.close(); playClose(); };

  document.getElementById('playFinish').onclick = finishExperience;
  document.getElementById('cardClose').onclick = () => document.getElementById('cardModal').classList.add('hidden');
  document.getElementById('cardGen').onclick = genCard;
  document.getElementById('cardSave').onclick = () => {
    const a = document.createElement('a');
    a.download = '一伞烟雨_纪念卡.png';
    a.href = document.getElementById('cardCanvas').toDataURL('image/png');
    a.click();
  };
}

// 手部骨架绘制
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function drawSkeleton(lm) {
  const c = skelCtx.canvas;
  c.width = c.clientWidth; c.height = c.clientHeight;
  skelCtx.clearRect(0, 0, c.width, c.height);
  if (!lm) return;
  skelCtx.strokeStyle = '#86efac';
  skelCtx.lineWidth = 2;
  for (const [a, b] of BONES) {
    skelCtx.beginPath();
    skelCtx.moveTo(lm[a].x * c.width, lm[a].y * c.height);
    skelCtx.lineTo(lm[b].x * c.width, lm[b].y * c.height);
    skelCtx.stroke();
  }
  skelCtx.fillStyle = '#c9a063';
  for (const p of lm) {
    skelCtx.beginPath();
    skelCtx.arc(p.x * c.width, p.y * c.height, 2.5, 0, Math.PI * 2);
    skelCtx.fill();
  }
}

// 收束：雨渐停 → 纪念卡
function finishExperience() {
  if (finished) return;
  finished = true;
  playClick();
  umb.open();
  playOpen();
  setStatus('雨势渐歇，镜头拉近你的伞……');
  let v = .1;
  const fade = setInterval(() => {
    v = Math.max(0, v - .015);
    setRainVolume(v);
    rain.setIntensity(v * 10);
    umb.zoom = Math.max(6, umb.zoom - .06);
    if (v <= 0) {
      clearInterval(fade);
      stopRain();
      setTimeout(() => {
        document.getElementById('cardModal').classList.remove('hidden');
        document.getElementById('workName').value = store.workName === '我的油纸伞' ? '' : store.workName;
        genCard();
      }, 600);
    }
  }, 50);
}

// 生成纪念卡
function genCard() {
  const c = document.getElementById('cardCanvas');
  const ctx = c.getContext('2d');
  const name = document.getElementById('workName').value.trim() || '烟雨一伞';
  store.workName = name;

  // 底：宣纸色 + 淡墨渐变
  ctx.fillStyle = '#efe8d5';
  ctx.fillRect(0, 0, 900, 1200);
  const grad = ctx.createLinearGradient(0, 0, 0, 1200);
  grad.addColorStop(0, 'rgba(134,165,154,.12)');
  grad.addColorStop(1, 'rgba(51,74,72,.2)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 900, 1200);

  // 边框
  ctx.strokeStyle = '#334a48';
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, 828, 1128);
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 54, 792, 1092);

  // 伞面圆形图案
  ctx.save();
  ctx.beginPath();
  ctx.arc(450, 470, 300, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(texCanvas, 450 - 380, 470 - 380, 760, 760);
  ctx.restore();
  ctx.strokeStyle = '#334a48';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(450, 470, 380, 0, Math.PI * 2);
  ctx.stroke();

  // 标题
  ctx.fillStyle = '#334a48';
  ctx.textAlign = 'center';
  ctx.font = '500 44px "PingFang SC","Microsoft Yahei",serif';
  ctx.fillText('一 伞 烟 雨', 450, 150);
  ctx.font = '20px serif';
  ctx.fillStyle = '#6b7f7a';
  ctx.fillText('—— 油纸伞非遗智能交互体验 · 纪念卡 ——', 450, 195);

  // 作品名
  ctx.font = '500 52px "PingFang SC","Microsoft Yahei",serif';
  ctx.fillStyle = '#26343f';
  ctx.fillText('《' + name + '》', 450, 920);

  // 伞谚
  ctx.font = '26px serif';
  ctx.fillStyle = '#8a6d3b';
  ctx.fillText(randomProverb(), 450, 990);

  // 日期与落款
  ctx.font = '20px serif';
  ctx.fillStyle = '#9aa8a2';
  const d = new Date();
  ctx.fillText(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 杭州`, 450, 1060);
  ctx.fillText('开伞即开卷 · 执伞入画', 450, 1100);

  document.getElementById('cardSave').disabled = false;
}
