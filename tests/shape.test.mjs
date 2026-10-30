// 无需安装 Three.js 或启动服务器：node --experimental-default-type=module tests/shape.test.mjs
import assert from 'node:assert/strict';
import {umbrellaPoint, UMBRELLA_RIBS, UMBRELLA_HUB_Y, UMBRELLA_CLOSED_LENGTH} from '../static/js/umbrellaShape.js';
const radial = p => Math.hypot(p[0], p[2]);
const closed = umbrellaPoint(1, 0, 0);
const opened = umbrellaPoint(1, 0, 1);
assert.equal(UMBRELLA_RIBS, 16);
assert.ok(radial(closed) < .4, '收伞后伞缘应收成靠近杆身的束状');
assert.ok(radial(opened) > 2.2, '撑伞后伞缘半径应恢复');
assert.ok(closed[1] < UMBRELLA_HUB_Y - 2, '收伞后绸面应沿杆纵向垂落，不能把圆盘简单缩小');
assert.ok(Math.abs(closed[1] - (UMBRELLA_HUB_Y - UMBRELLA_CLOSED_LENGTH)) < .01);
assert.ok(opened[1] > closed[1] + 1, '收伞骨尖应明显向下旋转');
for (let k = 0; k < 11; k++) {
  const v = k / 10;
  const p = umbrellaPoint(1, 0, v);
  assert.ok(p.every(Number.isFinite), '开合过程中不可出现无效顶点');
  assert.ok(radial(p) >= 0 && radial(p) < 2.4);
}
// 褶皱：两根伞骨之间的径向位置应不同，不是单纯圆柱收缩。
const rib = radial(umbrellaPoint(.85, 0, 0));
const valley = radial(umbrellaPoint(.85, Math.PI / UMBRELLA_RIBS, 0));
assert.ok(Math.abs(rib - valley) > .025, '收伞应产生山谷折褶');
console.log('PASS: 伞骨开合、垂直收束、褶皱与顶点数值测试全部通过');
