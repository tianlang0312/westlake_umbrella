/**
 * 西湖绸伞 · 可连续开合的程序化三维伞模型
 *
 * 不再通过 scale 或简单缩小圆盘模拟收伞：
 * - 16 根伞骨围绕伞顶转轴，从近乎水平向下旋转成细长骨束；
 * - 同一张伞面网格保持纹样 UV，顶点沿伞骨方向运动；
 * - 收拢时产生纵向谷折/山折褶皱，伞面向下延展成细长的折伞；
 * - 可见支撑杆、滑动伞巢、收束绑带和伞柄流苏。
 *
 * 所有对象只构造一次，动画时只更新缓冲区和变换，避免逐帧生成/销毁几何体。
 */
import * as THREE from 'three';
import { texCanvas, drawTexture } from './store.js';
import { umbrellaPoint } from './umbrellaShape.js';

const RIBS = 16;
const SECTORS_PER_RIB = 12;
const ANGULAR_STEPS = RIBS * SECTORS_PER_RIB;
const RADIAL_STEPS = 28;
const HUB_Y = 1.58;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

function createRod(parent, radius, material, radialSegments = 7) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, radialSegments), material);
  parent.add(mesh);
  return mesh;
}

function fitRod(mesh, p1, p2) {
  const delta = new THREE.Vector3().subVectors(p2, p1);
  const len = delta.length();
  mesh.position.copy(p1).add(p2).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.multiplyScalar(1 / Math.max(len, 1e-6)));
  mesh.scale.y = Math.max(0.001, len);
}

function putCylinder(parent, radiusTop, radiusBottom, height, y, mat, segments = 16) {
  const obj = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  obj.position.y = y;
  parent.add(obj);
  return obj;
}

export class UmbrellaScene {
  constructor(canvas, opts = {}) {
    this.opts = opts;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, preserveDrawingBuffer: true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    if (opts.night) this.scene.fog = new THREE.Fog(0x1a2530, 8, 26);

    this.camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    this.camera.position.set(0, 2.4, 8.8);
    this.camera.lookAt(0, .3, 0);
    this.scene.add(new THREE.HemisphereLight(opts.night ? 0x8fa8c0 : 0xffffff, opts.night ? 0x1a2530 : 0x82918b, opts.night ? 1.3 : 2.4));
    const key = new THREE.DirectionalLight(opts.night ? 0xd3def3 : 0xffffff, opts.night ? 1.65 : 2.1);
    key.position.set(3, 7, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xd9b88d, .7);
    rim.position.set(-3, 3, -4); this.scene.add(rim);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.canopyGroup = new THREE.Group(); this.root.add(this.canopyGroup);
    this.ribGroup = new THREE.Group(); this.root.add(this.ribGroup);
    this.frameGroup = new THREE.Group(); this.root.add(this.frameGroup);

    const bamboo = new THREE.MeshStandardMaterial({color: 0x98744c, roughness: .7});
    const paleBamboo = new THREE.MeshStandardMaterial({color: 0xc8ae83, roughness: .74});
    const dark = new THREE.MeshStandardMaterial({color: 0x334a48, roughness: .68});
    const brass = new THREE.MeshStandardMaterial({color: 0xb48b51, metalness: .65, roughness: .38});
    const cord = new THREE.MeshStandardMaterial({color: 0xa55643, roughness: .86});
    this.mats = {bamboo, paleBamboo, dark, brass, cord};

    // 核心木杆是固定长度的；收伞时不会缩小。
    putCylinder(this.frameGroup, .045, .051, 4.02, -.43, bamboo);
    putCylinder(this.frameGroup, .073, .066, .23, -2.53, dark);
    putCylinder(this.frameGroup, .063, .07, .16, HUB_Y, brass);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.062, .28, 16), brass);
    tip.position.y = HUB_Y + .18; this.frameGroup.add(tip);
    const endCap = new THREE.Mesh(new THREE.TorusGeometry(.13, .036, 10, 24, Math.PI * 1.1), dark);
    endCap.rotation.z = Math.PI / 2;
    endCap.position.set(.12, -2.62, 0);
    this.frameGroup.add(endCap);

    // 杆尾吊穗，用于接近用户参考图的西湖绸伞视觉语言。
    const tasselTop = new THREE.Vector3(.03, -2.62, 0);
    const tasselEnd = new THREE.Vector3(.18, -2.89, 0);
    fitRod(createRod(this.frameGroup, .014, cord), tasselTop, tasselEnd);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(.052, 12, 9), brass);
    bead.position.copy(tasselEnd); this.frameGroup.add(bead);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      fitRod(createRod(this.frameGroup, .007, paleBamboo, 5),
        tasselEnd, new THREE.Vector3(.18 + .065 * Math.cos(a), -3.15 - (i % 3) * .035, .065 * Math.sin(a)));
    }

    drawTexture();
    this.texture = new THREE.CanvasTexture(texCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    window.addEventListener('silk-pattern-ready', () => { this.refreshTexture(); });
    // store 重绘贴图后只通知置脏，避免再次触发 drawTexture 造成递归
    window.addEventListener('silk-texture-refresh', () => {
      if (this.texture) this.texture.needsUpdate = true;
    });
    this.canopyMat = new THREE.MeshStandardMaterial({
      map: this.texture, side: THREE.DoubleSide, roughness: .94,
      metalness: 0, transparent: true, opacity: 1, vertexColors: true,
    });

    const count = (RADIAL_STEPS + 1) * (ANGULAR_STEPS + 1);
    this.positions = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const colors = new Float32Array(count * 3);
    const indices = [];
    for (let j = 0; j <= RADIAL_STEPS; j++) {
      const t = j / RADIAL_STEPS;
      for (let i = 0; i <= ANGULAR_STEPS; i++) {
        const a = i / ANGULAR_STEPS * Math.PI * 2;
        const idx = j * (ANGULAR_STEPS + 1) + i;
        // 原有 Canvas 纹理在开合中保持同一 UV，不丢失用户上传图案。
        uv[idx * 2] = .5 + .475 * t * Math.cos(a);
        uv[idx * 2 + 1] = .5 + .475 * t * Math.sin(a);
        const panel = Math.floor((i % ANGULAR_STEPS) / SECTORS_PER_RIB);
        const tint = panel % 2 === 0 ? 1 : .94;
        colors[idx * 3] = tint;
        colors[idx * 3 + 1] = tint * .99;
        colors[idx * 3 + 2] = tint * .97;
      }
    }
    for (let j = 0; j < RADIAL_STEPS; j++) for (let i = 0; i < ANGULAR_STEPS; i++) {
      const k = j * (ANGULAR_STEPS + 1) + i;
      indices.push(k, k + 1, k + ANGULAR_STEPS + 1, k + 1, k + ANGULAR_STEPS + 2, k + ANGULAR_STEPS + 1);
    }
    this.canopyGeo = new THREE.BufferGeometry();
    this.canopyGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.canopyGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.canopyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.canopyGeo.setIndex(indices);
    this.canopy = new THREE.Mesh(this.canopyGeo, this.canopyMat);
    this.canopy.frustumCulled = false; // 顶点更新后始终正常渲染
    this.canopyGroup.add(this.canopy);

    // 每根主骨都有一条可见的细竹骨和一条内侧撑骨。
    this.ribs = [];
    this.braces = [];
    this.stitches = [];
    for (let k = 0; k < RIBS; k++) {
      this.ribs.push(createRod(this.ribGroup, .018, paleBamboo));
      this.braces.push(createRod(this.ribGroup, .014, bamboo));
      const points = new Float32Array((RADIAL_STEPS + 1) * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage));
      const seam = new THREE.Line(g, new THREE.LineBasicMaterial({color: 0x72583c, transparent: true, opacity: .38}));
      seam.frustumCulled = false;
      this.canopyGroup.add(seam);
      this.stitches.push(seam);
    }

    // 在收伞时下滑的撑伞滑环，以及闭合伞束上的系带。
    this.slider = putCylinder(this.frameGroup, .085, .085, .14, -.7, brass);
    this.bindGroup = new THREE.Group(); this.frameGroup.add(this.bindGroup);
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(.245, .24, .105, 32, 1, true),
      new THREE.MeshStandardMaterial({color: 0x9b6550, roughness: .88, side: THREE.DoubleSide, transparent: true, opacity: 1}));
    this.bindGroup.add(strap);
    for (const v of [-.052, .052]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(.248, .009, 5, 36), cord);
      hoop.rotation.x = Math.PI / 2; hoop.position.y = v;
      this.bindGroup.add(hoop);
    }
    this.bindGroup.position.y = -.38;

    this.openness = 1;
    this.targetOpen = 1;
    this.angleX = .10;
    this.angleY = .35;
    this.zoom = 8.8;
    this.ribCount = RIBS;
    this.showCanopy = true;
    this.oiled = false;
    this.autoSpin = false;
    this.spin = 0;
    this._running = false;
    this._exploded = 0;

    this.resize();
    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(canvas.parentElement);
    this.updateGeometry();
  }

  // 保留历史调用接口：几何核心由独立的纯函数统一计算，可用于单元测试。
  surface(t, a, q) { return umbrellaPoint(t, a, q); }

  refreshTexture() { drawTexture(); this.texture.needsUpdate = true; }
  setRibCount(n) { this.ribCount = Math.max(0, Math.min(RIBS, Math.round(n))); this.updateGeometry(); }
  setCanopyVisible(v) { this.showCanopy = Boolean(v); this.updateGeometry(); }
  setOiled(v) {
    this.oiled = Boolean(v);
    this.canopyMat.roughness = v ? .43 : .94;
    this.canopyMat.metalness = v ? .05 : 0;
    this.canopyMat.needsUpdate = true;
  }
  setCanopyOpacity(o) { this.canopyMat.opacity = clamp01(o); }

  // 保留历史项目的开放 API：改变 openness 后可调用 updateGeometry 强制刷新。
  updateGeometry() {
    const q = ease(this.openness);
    const arr = this.positions;
    for (let j = 0; j <= RADIAL_STEPS; j++) {
      const t = j / RADIAL_STEPS;
      for (let i = 0; i <= ANGULAR_STEPS; i++) {
        const a = i / ANGULAR_STEPS * Math.PI * 2;
        const idx = (j * (ANGULAR_STEPS + 1) + i) * 3;
        const p = this.surface(t, a, this.openness);
        arr[idx] = p[0]; arr[idx + 1] = p[1]; arr[idx + 2] = p[2];
      }
    }
    this.canopyGeo.attributes.position.needsUpdate = true;
    this.canopyGeo.computeVertexNormals();
    this.canopy.visible = this.showCanopy;
    const collarY = THREE.MathUtils.lerp(-.86, .48, q);
    this.slider.position.y = collarY;
    for (let k = 0; k < RIBS; k++) {
      const a = 2 * Math.PI * k / RIBS;
      const hub = new THREE.Vector3(0, HUB_Y, 0);
      const rim = new THREE.Vector3(...this.surface(1, a, this.openness));
      const mid = new THREE.Vector3(...this.surface(.58, a, this.openness));
      fitRod(this.ribs[k], hub, rim);
      fitRod(this.braces[k], new THREE.Vector3(0, collarY, 0), mid);
      this.ribs[k].visible = k < this.ribCount;
      this.braces[k].visible = k < this.ribCount && q > .03;
      const attr = this.stitches[k].geometry.attributes.position;
      for (let j = 0; j <= RADIAL_STEPS; j++) {
        const p = this.surface(j / RADIAL_STEPS, a, this.openness);
        attr.setXYZ(j, p[0], p[1] + .003, p[2]);
      }
      attr.needsUpdate = true;
      this.stitches[k].visible = this.showCanopy;
    }
    this.bindGroup.visible = this.showCanopy && q < .12;
    // 真实折叠时半径仍有细微变化，让绑带始终套在伞束外。
    this.bindGroup.scale.setScalar(1);
  }

  setExploded(t) {
    this._exploded = clamp01(t);
    this.canopyGroup.position.y = this._exploded * 1.4;
    this.ribGroup.position.y = this._exploded * .7;
    this.frameGroup.position.y = -this._exploded * .5;
  }
  open() { this.targetOpen = 1; }
  close() { this.targetOpen = 0; }
  setOpenness(v, immediate = false) {
    this.targetOpen = clamp01(v);
    if (immediate) { this.openness = this.targetOpen; this.updateGeometry(); }
  }

  resize() {
    const box = this.canvas.parentElement;
    if (!box || !box.clientWidth || !box.clientHeight) return;
    this.renderer.setSize(box.clientWidth, box.clientHeight, false);
    this.camera.aspect = box.clientWidth / box.clientHeight;
    this.camera.updateProjectionMatrix();
  }
  start() { if (!this._running) { this._running = true; this._frame(); } }
  stop() { this._running = false; }
  _frame() {
    if (!this._running) return;
    requestAnimationFrame(() => this._frame());
    if (Math.abs(this.openness - this.targetOpen) > .0008) {
      this.openness += (this.targetOpen - this.openness) * .095;
      this.updateGeometry();
    } else if (this.openness !== this.targetOpen) {
      this.openness = this.targetOpen;
      this.updateGeometry();
    }
    this.spin += .002;
    this.root.rotation.y = this.angleY + (this.autoSpin ? this.spin : 0);
    this.root.rotation.x = this.angleX;
    this.camera.position.set(0, 2.4, this.zoom);
    this.camera.lookAt(0, .3, 0);
    this.renderer.render(this.scene, this.camera);
  }

  bindDrag({onZoom} = {}) {
    let drag = false, lastX = 0, lastY = 0;
    this.canvas.addEventListener('pointerdown', e => {
      drag = true; lastX = e.clientX; lastY = e.clientY;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    this.canvas.addEventListener('pointerup', () => { drag = false; });
    this.canvas.addEventListener('pointercancel', () => { drag = false; });
    this.canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      this.angleY += (e.clientX - lastX) * .009;
      this.angleX = Math.max(-.85, Math.min(.85, this.angleX + (e.clientY - lastY) * .005));
      lastX = e.clientX; lastY = e.clientY;
    });
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoom = Math.max(5, Math.min(15, this.zoom + e.deltaY * .009));
      if (onZoom) onZoom(this.zoom);
    }, {passive: false});
  }
}
