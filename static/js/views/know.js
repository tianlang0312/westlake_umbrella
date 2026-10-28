// 第一幕 · 知伞：滚动即开伞 + 时间轴 + 解构热点 + 材料馆
import { UmbrellaScene } from '../umbrella.js';
import { drawTexture } from '../store.js';
import { playClick } from '../audio.js';

let umb = null, scrollEl = null, bound = false;

const PART_INFO = {
  ribs: '<b>伞骨</b>：以五年生毛竹劈成，骨条粗细均匀、弧度一致。余杭纸伞伞骨多达数十根，根根手工打磨——伞骨越多，伞面越圆挺。',
  canopy: '<b>伞面</b>：桃花纸裱糊，薄而韧。绘上山水花鸟，一把伞就是一幅可撑开的画。',
  frame: '<b>伞柄伞杆</b>：一竹贯通为杆，下接木柄。开合一瞬，靠伞杆内的"跳子"机关锁扣。',
};

const MAT_INFO = {
  zhu: '<b>毛竹 · 伞骨</b><br>选五年生冬竹，竹龄太短则软、太长则脆。劈成骨条后蒸煮防蛀，方能百年不弯。',
  zhi: '<b>桃花纸 · 伞面</b><br>以楮树皮抄造，薄如蝉翼而韧性极佳，吸墨受彩，是伞面绘纹的底子。',
  qi: '<b>柿漆 · 裱糊</b><br>未成熟的青柿子榨汁发酵而成，粘合力强且本身防水，是伞面与伞骨的"隐形缝线"。',
  you: '<b>桐油 · 防水</b><br>油桐树籽榨取，刷上伞面后氧化成膜。"纸伞不惧雨"的秘密，全在这层光亮的油膜。',
};

export function enterKnow() {
  drawTexture();
  if (!umb) {
    umb = new UmbrellaScene(document.getElementById('knowCanvas'));
    umb.openness = 0; umb.targetOpen = 0;
  }
  umb.start();
  scrollEl = document.getElementById('knowScroll');
  if (!bound) {
    bound = true;
    scrollEl.addEventListener('scroll', onScroll);
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
  const max = scrollEl.scrollHeight - scrollEl.clientHeight;
  const p = max > 0 ? scrollEl.scrollTop / max : 0;
  umb.targetOpen = Math.min(1, p * 1.15); // 滚动推进开伞
  document.getElementById('knowPct').textContent = '开卷 ' + Math.round(p * 100) + '%';
}

export function leaveKnow() { umb && umb.stop(); }
