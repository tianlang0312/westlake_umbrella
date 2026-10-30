/**
 * 无 Three.js 依赖的伞面几何内核，可直接通过 Node.js 测试。
 * openness: 0 = 完全收拢（细长垂直褶束）; 1 = 完全张开（圆形伞盖）
 * t: 伞顶至伞缘的归一化位置; angle: 伞骨轴向的环绕角度（弧度）。
 */
export const UMBRELLA_RIBS = 16;
export const UMBRELLA_HUB_Y = 1.58;
export const UMBRELLA_OPEN_RADIUS = 2.33;
export const UMBRELLA_CLOSED_LENGTH = 2.30;

export function umbrellaPoint(t, angle, openness) {
  const q0 = Math.max(0, Math.min(1, openness));
  const q = q0 * q0 * (3 - 2 * q0);
  const sector = angle * UMBRELLA_RIBS;
  const ridge = Math.cos(sector);
  const pleat = Math.cos(sector * 2);
  const edgeSoft = Math.sin(Math.PI * t);
  const openR = UMBRELLA_OPEN_RADIUS * t;
  const openY = UMBRELLA_HUB_Y - .73 * t ** 1.45 - .031 * edgeSoft * (1 - ridge) * .5;
  const closedR = t * (.045 + .17 * t ** .58) * (1 + .21 * ridge - .09 * pleat);
  const closedY = UMBRELLA_HUB_Y - UMBRELLA_CLOSED_LENGTH * t + .042 * edgeSoft * pleat;
  const radius = closedR + (openR - closedR) * q;
  const height = closedY + (openY - closedY) * q;
  return [radius * Math.cos(angle), height, radius * Math.sin(angle)];
}
