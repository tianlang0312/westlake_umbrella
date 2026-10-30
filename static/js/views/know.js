// 第一幕 · 知伞：滚动即开伞 + 时间轴 + 解构热点 + 材料馆
import { UmbrellaScene } from '../umbrella.js';
import { drawTexture } from '../store.js';
import { playClick } from '../audio.js';

let umb = null, scrollEl = null, bound = false;

const PART_INFO = {
  ribs: '<b>竹骨</b>：西湖绸伞多选用淡竹，骨条以套合技艺精巧连接；绸伞合拢时，骨架可重新收成修长的竹束。',
  canopy: '<b>绸面</b>：杭州丝绸轻盈雅致，可进行刷花、彩绘或刺绣；山水、花鸟与西湖十景皆可入画。',
  frame: '<b>伞杆与伞柄</b>：支撑开合结构，竹木相映，与绸面、伞骨共同构成一把精巧的西湖绸伞。',
};

const MAT_INFO = {
  zhu: '<b>淡竹 · 伞骨</b>：用竹作骨，经过加工、排列、套合，让伞面开合自然。',
  zhi: '<b>丝绸 · 伞面</b>：以杭州丝绸张面，纹理轻盈，适合绘制山水、花鸟和西湖景致。',
  qi: '<b>丝线 · 连骨</b>：用于传统制伞中的串线与连接工序，使骨架成为有序协调的结构。',
  you: '<b>彩绘 · 饰面</b>：西湖绸伞的装饰工艺有刷花、彩绘、刺绣等，让一把伞成为可开合的画卷。',
};

export function enterKnow() {
  drawTexture();
  if (!umb) {
    umb = new UmbrellaScene(document.getElementById('knowCanvas'));
    umb.setOpenness(0, true);
  }
  umb.start();
  scrollEl = document.getElementById('knowScroll');
  if (!bound) {
    bound = true;
    scrollEl.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('scroll', onScroll, {passive: true}); // 手机端滚动页面时仍可联动开伞
    // 解构热点
    document.querySelectorAll('.hotspot-btn').forEach(btn => {
      btn.onclick = () => {
        playClick();
        document.querySelectorAll('.hotspot-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('partInfo').innerHTML = '<p>' + PART_INFO[btn.dataset.part] + '</p>';
        highlight(btn.dataset.part);
      };
    });
    document.querySelectorAll('.mat-card').forEach(card => {
      card.onclick = () => {
        playClick();
        document.getElementById('matInfo').innerHTML = '<p>' + MAT_INFO[card.dataset.mat] + '</p>';
      };
    });
    document.getElementById('btnGoMake').onclick = () => { location.hash = '#/make'; };
  }
  onScroll();
}

function highlight(part) {
  if (!umb) return;
  umb.mats.bamboo.emissive?.setHex(part === 'ribs' || part === 'frame' ? 0x443300 : 0);
  umb.canopyMat.emissive?.setHex(part === 'canopy' ? 0x333a22 : 0);
  // 分解动效一下
  umb.setExploded(.6);
  setTimeout(() => umb.setExploded(0), 900);
}

function onScroll() {
  if (!scrollEl || !umb || document.getElementById('view-know').classList.contains('hidden')) return;
  let p;
  if (matchMedia('(max-width: 960px)').matches) {
    const box = scrollEl.getBoundingClientRect();
    const total = Math.max(1, box.height - window.innerHeight * 0.4);
    p = Math.min(1, Math.max(0, (-box.top + window.innerHeight * 0.4) / total));
  } else {
    const max = scrollEl.scrollHeight - scrollEl.clientHeight;
    p = max > 0 ? scrollEl.scrollTop / max : 0;
  }
  umb.targetOpen = Math.min(1, p * 1.15); // 滚动推进开伞
  document.getElementById('knowPct').textContent = '开卷 ' + Math.round(p * 100) + '%';
}

export function leaveKnow() { umb && umb.stop(); }
