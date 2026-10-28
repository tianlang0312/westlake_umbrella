// 雨滴粒子系统：雨落、开伞挡雨溅射、收伞淋雨
import * as THREE from 'three';

export class RainSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {Object} opts { count, area, umbrellaHeight }
   */
  constructor(scene, opts = {}) {
    this.count = opts.count || 1600;
    this.area = opts.area || 14;       // 落雨范围半径
    this.top = 9;                      // 雨滴出生高度
    this.intensity = 1;                // 雨势 0..1
    this.scene = scene;

    // 雨滴：细长竖线用 Points + 自定义尺寸即可（远看效果足够）
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count); // 各自速度
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = (Math.random() - .5) * this.area * 2;
      pos[i * 3 + 1] = Math.random() * this.top;
      pos[i * 3 + 2] = (Math.random() - .5) * this.area * 2;
      this.vel[i] = 7 + Math.random() * 4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0xaec6d8, size: .06, transparent: true, opacity: .75,
      sizeAttenuation: true, depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.rainMat);
    scene.add(this.points);

    // 溅射水雾粒子
    this.splashCount = 240;
    const sgeo = new THREE.BufferGeometry();
    this.spos = new Float32Array(this.splashCount * 3);
    this.svel = new Float32Array(this.splashCount * 3);
    this.slife = new Float32Array(this.splashCount); // 剩余寿命
    for (let i = 0; i < this.splashCount; i++) { this.spos[i * 3 + 1] = -99; }
    sgeo.setAttribute('position', new THREE.BufferAttribute(this.spos, 3));
    this.splashMat = new THREE.PointsMaterial({
      color: 0xd8ecf5, size: .09, transparent: true, opacity: .9,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.splash = new THREE.Points(sgeo, this.splashMat);
    scene.add(this.splash);
    this._si = 0;

    this.groundY = -2.6;
    this._last = performance.now();
  }

  // 在伞面上产生一朵水雾
  _spawnSplash(x, y, z) {
    const i = this._si = (this._si + 1) % this.splashCount;
    this.spos[i * 3] = x; this.spos[i * 3 + 1] = y; this.spos[i * 3 + 2] = z;
    const a = Math.random() * Math.PI * 2;
    const sp = .6 + Math.random() * 1.2;
    this.svel[i * 3] = Math.cos(a) * sp;
    this.svel[i * 3 + 1] = .5 + Math.random() * .8;
    this.svel[i * 3 + 2] = Math.sin(a) * sp;
    this.slife[i] = .45;
  }

  /**
   * @param {Object} umbrella { openness, x, z } 伞面近似圆锥：顶点高 1.78*openness+... 半径 2.35*openness
   */
  update(umbrella) {
    const now = performance.now();
    const dt = Math.min(.05, (now - this._last) / 1000);
    this._last = now;
    const pos = this.points.geometry.attributes.position.array;
    const active = Math.floor(this.count * this.intensity);
    const o = umbrella.openness, ux = umbrella.x || 0, uz = umbrella.z || 0;
    const R = 2.35 * Math.max(.12, o);
    const apexY = 1.1 + .68 * o;         // 伞顶高度
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      if (i >= active) { pos[j + 1] = -99; continue; }  // 雨势调小时隐藏多余雨滴
      pos[j + 1] -= this.vel[i] * dt;
      const x = pos[j] - ux, z = pos[j + 2] - uz;
      const r = Math.hypot(x, z);
      // 伞面锥面：高度随半径线性下降
      if (o > .5 && r < R) {
        const surfY = apexY - (r / R) * .68 * o;
        if (pos[j + 1] <= surfY && pos[j + 1] > surfY - 1.2) {
          this._spawnSplash(pos[j], surfY + .05, pos[j + 2]);
          pos[j + 1] = this.top + Math.random() * 2;    // 重生到顶部
          pos[j] = ux + (Math.random() - .5) * this.area * 2;
          pos[j + 2] = uz + (Math.random() - .5) * this.area * 2;
          continue;
        }
      }
      if (pos[j + 1] < this.groundY) {
        if (Math.random() < .3) this._spawnSplash(pos[j], this.groundY, pos[j + 2]);
        pos[j + 1] = this.top + Math.random() * 2;
        pos[j] = (Math.random() - .5) * this.area * 2;
        pos[j + 2] = (Math.random() - .5) * this.area * 2;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    // 水雾衰减
    for (let i = 0; i < this.splashCount; i++) {
      if (this.slife[i] <= 0) continue;
      const j = i * 3;
      this.slife[i] -= dt;
      this.svel[j + 1] -= 3.5 * dt;      // 重力
      this.spos[j] += this.svel[j] * dt;
      this.spos[j + 1] += this.svel[j + 1] * dt;
      this.spos[j + 2] += this.svel[j + 2] * dt;
      if (this.slife[i] <= 0) this.spos[j + 1] = -99;
    }
    this.splash.geometry.attributes.position.needsUpdate = true;
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  dispose() {
    this.scene.remove(this.points, this.splash);
    this.points.geometry.dispose();
    this.splash.geometry.dispose();
  }
}
