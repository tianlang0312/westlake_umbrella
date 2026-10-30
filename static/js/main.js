// 主入口：哈希路由 + 导航 + 声音开关
import { enterLanding, leaveLanding } from './views/landing.js';
import { enterKnow, leaveKnow } from './views/know.js';
import { enterMake, leaveMake } from './views/make.js';
import { enterPlay, leavePlay } from './views/play.js';
import { setSound, isSoundOn, playClick } from './audio.js';

const routes = {
  landing: { enter: enterLanding, leave: leaveLanding },
  know: { enter: enterKnow, leave: leaveKnow },
  make: { enter: enterMake, leave: leaveMake },
  play: { enter: enterPlay, leave: leavePlay },
};

let current = null;

function route() {
  const hash = location.hash.replace('#/', '') || 'landing';
  const name = routes[hash] ? hash : 'landing';
  if (current === name) return;
  if (current) {
    routes[current].leave();
    document.getElementById('view-' + current).classList.add('hidden');
  }
  current = name;
  document.getElementById('view-' + name).classList.remove('hidden');
  document.getElementById('topnav').classList.toggle('hidden', name === 'landing');
  document.querySelectorAll('#topnav a').forEach(a =>
    a.classList.toggle('active', a.dataset.route === name));
  routes[name].enter();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// 落地页按钮：跳转不依赖音效，音效异常也不能拦下导航
function go(routeName) {
  try { playClick(); } catch (_) { }
  location.hash = '#/' + routeName;
  // 若已经处于目标 hash，hashchange 不会触发，这里直接再走一次路由
  if (current !== routeName) route();
}
document.getElementById('btnStart').onclick = () => go('make');
document.getElementById('btnKnow').onclick = () => go('know');

// 声音开关（两处）
function bindSound(id) {
  document.getElementById(id).onclick = e => {
    const on = !isSoundOn();
    setSound(on);
    document.querySelectorAll('#soundToggle,#soundToggleLanding').forEach(b => b.textContent = on ? '🔊 声音' : '🔇 静音');
  };
}
bindSound('soundToggle');
bindSound('soundToggleLanding');

// toast 工具（全局）
window.toast = msg => {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
};

route();
