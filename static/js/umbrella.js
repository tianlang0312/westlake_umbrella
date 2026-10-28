// 可复用的 Three.js 数字油纸伞场景
import * as THREE from 'three';
import { texCanvas, drawTexture } from './store.js';

export class UmbrellaScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts { night: 夜景雨舞台, exploded: 分解展示 }
   */
  constructor(canvas, opts = {}) {
    this.opts = opts;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    if (opts.night) {
      this.scene.fog = new THREE.Fog(0x1a2530, 8, 26);
    }
    this.camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    this.camera.position.set(0, 2.4, 8.8);
    this.camera.lookAt(0, .4, 0);

    const hemi = new THREE.HemisphereLight(opts.night ? 0x8fa8c0 : 0xffffff, opts.night ? 0x1a2530 : 0x82918b, opts.night ? 1.2 : 2.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(opts.night ? 0xbfd4e8 : 0xffffff, opts.night ? 1.6 : 2.2);
    sun.position.set(3, 7, 5);
    this.scene.add(sun);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.canopyGroup = new THREE.Group();
    this.root.add(this.canopyGroup);
    this.ribGroup = new THREE.Group();
    this.root.add(this.ribGroup);
    this.frameGroup = new THREE.Group();   // 伞杆/伞柄/伞头
    this.root.add(this.frameGroup);

    const bamboo = new THREE.MeshStandardMaterial({ color: 0x9a7953, roughness: .75 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x334a48, roughness: .75 });
    this.mats = { bamboo, dark };

    const cyl = (r1, r2, h, y, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), mat);
      m.position.y = y;
      this.frameGroup.add(m);
      return m;
    };
    cyl(.055, .055, 3.4, -.6, bamboo);          // 伞杆
    cyl(.09, .07, .16, -2.34, dark);            // 伞柄
    cyl(.09, .09, .18, 1.12, bamboo);           // 伞头
    // 手柄弯钩
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.16, .05, 10, 20, Math.PI), dark);
    hook.position.set(.16, -2.42, 0);
    this.frameGroup.add(hook);

    drawTexture();
    this.texture = new THREE.CanvasTexture(texCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.canopyMat = new THREE.MeshStandardMaterial({
      map: this.texture, side: THREE.DoubleSide, roughness: .95, metalness: 0,
      transparent: true, opacity: 1,
    });

    this.canopy = null;
    this.ribs = [];
    this.openness = 1;
    this.targetOpen = 1;
    this.angleX = .1;
    this.angleY = .35;
    this.zoom = 8.8;
    this.ribCount = 16;      // 当前可见伞骨数（组装工序用）
    this.showCanopy = true;  // 糊面后才有伞面
    this.oiled = false;      // 刷油后光泽
    this.spin = 0;           // 自动旋转
    this._running = false;

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.updateGeometry();
  }

  refreshTexture() { drawTexture(); this.texture.needsUpdate = true; }

  setRibCount(n) { this.ribCount = n; this.updateGeometry(); }
  setCanopyVisible(v) { this.showCanopy = v; this.updateGeometry(); }
  setOiled(v) {
    this.oiled = v;
    this.canopyMat.roughness = v ? .35 : .95;
    this.canopyMat.metalness = v ? .08 : 0;
    this.canopyMat.needsUpdate = true;
  }
  setCanopyOpacity(o) { this.canopyMat.opacity = o; }

  updateGeometry() {
    if (this.canopy) { this.canopyGroup.remove(this.canopy); this.canopy.geometry.dispose(); this.canopy = null; }
    this.ribs.forEach(m => { this.ribGroup.remove(m); m.geometry.dispose(); });
    this.ribs = [];
    const N = 64, M = 12;
    const R = 2.35 * Math.max(.12, this.openness);
    const depth = .68 * this.openness;
    if (this.showCanopy) {
      const pos = [], uv = [], indices = [];
      for (let j = 0; j <= M; j++) {
        const t = j / M;
        for (let i = 0; i <= N; i++) {
          const a = i / N * Math.PI * 2;
          pos.push(R * t * Math.cos(a), 1.1 + depth * (1 - t * t), R * t * Math.sin(a));
          uv.push(.5 + .48 * t * Math.cos(a), .5 + .48 * t * Math.sin(a));
        }
      }
      for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
        const k = j * (N + 1) + i;
        indices.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      this.canopy = new THREE.Mesh(geo, this.canopyMat);
      this.canopyGroup.add(this.canopy);
    }
    for (let i = 0; i < this.ribCount; i++) {
      const a = i * Math.PI * 2 / 16;
      const p1 = new THREE.Vector3(0, 1.1 + depth, 0);
      const p2 = new THREE.Vector3(R * Math.cos(a), 1.1, R * Math.sin(a));
      const dir = p2.clone().sub(p1);
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, dir.length(), 6), this.mats.bamboo);
      rib.position.copy(p1.clone().add(p2).multiplyScalar(.5));
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      this.ribGroup.add(rib);
      this.ribs.push(rib);
    }
  }

  // 分解展示模式：各部件沿 y 轴错开
  setExploded(t) { // t: 0..1
    this.canopyGroup.position.y = t * 1.4;
    this.ribGroup.position.y = t * .7;
    this.frameGroup.position.y = -t * .5;
  }

  open() { this.targetOpen = 1; }
  close() { this.targetOpen = .12; }

  resize() {
    const box = this.canvas.parentElement;
    if (!box || !box.clientWidth) return;
    this.renderer.setSize(box.clientWidth, box.clientHeight, false);
    this.camera.aspect = box.clientWidth / box.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  start() { if (!this._running) { this._running = true; this._frame(); } }
  stop() { this._running = false; }

  _frame() {
    if (!this._running) return;
    requestAnimationFrame(() => this._frame());
    if (Math.abs(this.openness - this.targetOpen) > .002) {
      this.openness += (this.targetOpen - this.openness) * .12;
      this.updateGeometry();
    }
    this.spin += .002;
    this.root.rotation.y = this.angleY + this.spin * (this.autoSpin ? 1 : 0);
    this.root.rotation.x = this.angleX;
    this.camera.position.set(0, 2.4, this.zoom);
    this.camera.lookAt(0, .3, 0);
    this.renderer.render(this.scene, this.camera);
  }

  // 绑定鼠标拖动旋转 / 滚轮缩放
  bindDrag({ onZoom } = {}) {
    let drag = false, lastX = 0, lastY = 0;
    this.canvas.addEventListener('pointerdown', e => {
      drag = true; lastX = e.clientX; lastY = e.clientY;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { }
    });
    this.canvas.addEventListener('pointerup', () => drag = false);
    this.canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      this.angleY += (e.clientX - lastX) * .009;
      this.angleX = Math.max(-.6, Math.min(.65, this.angleX + (e.clientY - lastY) * .005));
      lastX = e.clientX; lastY = e.clientY;
    });
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoom = Math.max(5, Math.min(15, this.zoom + e.deltaY * .009));
      onZoom && onZoom(this.zoom);
    }, { passive: false });
  }
}
