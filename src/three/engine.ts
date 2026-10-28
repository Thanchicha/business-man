import * as THREE from 'three';

export type Ease = (t: number) => number;
export const easeOut: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const linear: Ease = (t) => t;
export const backOut: Ease = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

interface Label {
  el: HTMLElement;
  target: THREE.Object3D;
  offset: number;
}

/**
 * Everything one screen puts into the 3D world. Disposing a stage removes its
 * objects, per-frame updates, click targets and floating labels in one go.
 */
export class Stage {
  readonly group = new THREE.Group();
  private updaters = new Set<(dt: number) => void>();
  readonly clickables = new Map<THREE.Object3D, () => void>();
  private labels: Label[] = [];
  /** Multiplies dt for this stage's updates, tweens and waits (fast-forward). */
  timeScale = 1;
  paused = false;
  disposed = false;

  constructor(readonly engine: Engine) {}

  add<T extends THREE.Object3D>(...objs: T[]): T {
    this.group.add(...objs);
    return objs[0];
  }

  /** Keeps speech bubbles this far (px) inside the screen edges; screens with film bars raise 	op. */
  readonly labelInset = { top: 8, bottom: 8, side: 10 };

  onUpdate(fn: (dt: number) => void): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  click(obj: THREE.Object3D, fn: () => void): void {
    this.clickables.set(obj, fn);
  }

  /** A DOM element that follows a 3D object on screen. */
  label(target: THREE.Object3D, el: HTMLElement, offset = 0): HTMLElement {
    el.classList.add('label3d');
    this.engine.labelLayer.appendChild(el);
    this.labels.push({ el, target, offset });
    return el;
  }

  unlabel(el: HTMLElement): void {
    this.labels = this.labels.filter((l) => l.el !== el);
    el.remove();
  }

  tick(dt: number): void {
    if (this.paused) return;
    const d = dt * this.timeScale;
    for (const fn of [...this.updaters]) fn(d);
  }

  placeLabels(): void {
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      if (!l.el.isConnected) continue;
      l.target.getWorldPosition(v);
      v.y += l.offset;
      const p = this.engine.project(v);
      l.el.style.display = p.visible ? '' : 'none';
      // speech bubbles stay fully on screen: a big bubble near an edge slides inward instead of being cut off
      let x = p.x;
      let y = p.y;
      if (l.el.querySelector('.say, .tip-head') || l.el.classList.contains('bubble')) {
        const W = this.engine.labelLayer.clientWidth || window.innerWidth;
        const H = this.engine.labelLayer.clientHeight || window.innerHeight;
        const w = l.el.offsetWidth;
        const hh = l.el.offsetHeight;
        const side = this.labelInset.side;
        x = Math.min(W - w / 2 - side, Math.max(w / 2 + side, x));
        y = Math.min(H - this.labelInset.bottom, Math.max(hh + this.labelInset.top, y));
      }
      l.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
  }

  /** Animates numeric properties of any object, on this stage's clock. */
  tween<T extends object>(target: T, to: Partial<Record<keyof T, number>>, ms: number, ease: Ease = easeInOut): Promise<void> {
    const from: Record<string, number> = {};
    for (const k of Object.keys(to)) from[k] = (target as Record<string, number>)[k];
    let t = 0;
    return new Promise((res) => {
      const off = this.onUpdate((dt) => {
        t = Math.min(1, t + (dt * 1000) / Math.max(1, ms));
        const e = ease(t);
        for (const [k, v] of Object.entries(to)) (target as Record<string, number>)[k] = from[k] + ((v as number) - from[k]) * e;
        if (t >= 1) {
          off();
          res();
        }
      });
    });
  }

  wait(ms: number): Promise<void> {
    let t = 0;
    return new Promise((res) => {
      const off = this.onUpdate((dt) => {
        t += dt * 1000;
        if (t >= ms) {
          off();
          res();
        }
      });
    });
  }

  /** Moves the camera smoothly to a position, looking at a point. */
  async cameraTo(pos: THREE.Vector3Like, look: THREE.Vector3Like, ms = 1200): Promise<void> {
    const cam = this.engine.camera;
    const look0 = this.engine.lookAt.clone();
    const p = { x: cam.position.x, y: cam.position.y, z: cam.position.z, lx: look0.x, ly: look0.y, lz: look0.z };
    const off = this.onUpdate(() => {
      cam.position.set(p.x, p.y, p.z);
      this.engine.look(p.lx, p.ly, p.lz);
    });
    await this.tween(p, { x: pos.x, y: pos.y, z: pos.z, lx: look.x, ly: look.y, lz: look.z }, ms);
    off();
    cam.position.set(pos.x, pos.y, pos.z);
    this.engine.look(look.x, look.y, look.z);
  }

  dispose(): void {
    this.disposed = true;
    this.updaters.clear();
    this.clickables.clear();
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
    });
  }
}

/** Renderer, camera, lights and the frame loop. One instance for the whole game. */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
  readonly lookAt = new THREE.Vector3();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly labelLayer: HTMLElement;
  stage: Stage;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private last = performance.now();
  /** Called on clicks that hit no clickable; receives the ray for ground picking. */
  onMiss: ((ray: THREE.Raycaster) => void) | null = null;
  /**
   * The player's own camera adjustment (drag to orbit, right-drag to pan,
   * wheel/pinch to zoom), layered on top of whatever camera the screen sets.
   * Screens keep driving the "base" camera; this is applied just for rendering.
   */
  readonly view = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
  private base: { pos: THREE.Vector3; look: THREE.Vector3; applied: THREE.Vector3 } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { button: number; moved: number; pinch: number } | null = null;
  private resetBtn!: HTMLButtonElement;
  /** Screens like the cover keep a fixed, composed shot. */
  viewLocked = false;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'label-layer';
    host.appendChild(this.labelLayer);

    this.hemi = new THREE.HemisphereLight('#e6f2ff', '#cdb8a8', 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3e6', 2.2);
    this.sun.position.set(12, 24, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    this.setSky('#cfe6f5');

    this.stage = new Stage(this);
    this.scene.add(this.stage.group);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.setupViewControls();
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      const dragged = (this.drag?.moved ?? 0) > 6;
      this.pointers.delete(e.pointerId);
      if (!this.pointers.size) this.drag = null;
      if (!dragged && e.button === 0) this.onClick(e);
    });
    this.renderer.domElement.addEventListener('pointermove', (e) => this.onMove(e));
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setSky(color: string, fog = true, near = 40, far = 140): void {
    this.scene.background = new THREE.Color(color);
    this.scene.fog = fog ? new THREE.Fog(color, near, far) : null;
  }

  private skyTex: THREE.Texture | null = null;

  /** Golden-hour sky like the key art: lavender overhead, pink to peach at the horizon, glowing clouds, warm low sun. */
  daySky(near = 60, far = 190): void {
    if (!this.skyTex) {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 1024;
      const ctx = c.getContext('2d')!;
      const grd = ctx.createLinearGradient(0, 0, 0, 1024);
      grd.addColorStop(0, '#6f73c9');
      grd.addColorStop(0.3, '#a58fdc');
      grd.addColorStop(0.58, '#e7a3d0');
      grd.addColorStop(0.8, '#ffc3c4');
      grd.addColorStop(1, '#ffe0bf');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 1024, 1024);
      // soft sun glow low on the right
      const sun = ctx.createRadialGradient(820, 780, 10, 820, 780, 420);
      sun.addColorStop(0, 'rgba(255,240,210,0.95)');
      sun.addColorStop(0.25, 'rgba(255,214,190,0.55)');
      sun.addColorStop(1, 'rgba(255,200,200,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, 1024, 1024);
      // anime clouds lit from below: lilac tops, pink-peach bellies, a few tiny wisps
      const cloud = (x: number, y: number, s: number) => {
        const puffs = [[0, 0, 26], [28, -12, 30], [62, -2, 26], [34, 8, 26], [-26, 6, 18], [90, 8, 18], [-48, 12, 12]];
        for (const [layer, col, oy] of [[0, 'rgba(196,170,226,0.85)', -4], [1, 'rgba(255,214,228,0.95)', 2], [2, 'rgba(255,190,190,0.7)', 10]] as [number, string, number][]) {
          ctx.fillStyle = col;
          for (const [dx, dy, r] of puffs) {
            ctx.beginPath();
            ctx.arc(x + dx * s, y + (dy + oy) * s, r * s * (layer === 2 ? 0.8 : 1), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };
      cloud(90, 300, 1.4);
      cloud(560, 170, 1.9);
      cloud(840, 420, 1.1);
      cloud(320, 560, 1.0);
      cloud(700, 640, 0.8);
      ctx.fillStyle = 'rgba(255,222,236,0.6)';
      for (const [x, y, w] of [[60, 470, 220], [520, 520, 300], [250, 720, 260], [700, 820, 240]]) ctx.fillRect(x, y, w, 7);
      // a handful of early stars in the lavender
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 18; i++) ctx.fillRect((i * 337) % 1024, (i * 131) % 220, 2, 2);
      this.skyTex = new THREE.CanvasTexture(c);
      this.skyTex.colorSpace = THREE.SRGBColorSpace;
    }
    this.scene.background = this.skyTex;
    this.scene.fog = new THREE.Fog('#f2c4d2', near, far);
    this.hemi.color.set('#e2d4ff');
    this.hemi.groundColor.set('#e8bba8');
    this.hemi.intensity = 1.45;
    this.sun.color.set('#ffd2a6');
    this.sun.intensity = 2.7;
    this.sun.position.set(18, 16, 14);
  }

  newStage(): Stage {
    this.stage.dispose();
    this.stage = new Stage(this);
    this.scene.add(this.stage.group);
    this.resetView();
    this.viewLocked = false;
    this.onMiss = null;
    return this.stage;
  }

  look(x: number, y: number, z: number): void {
    this.lookAt.set(x, y, z);
    this.camera.lookAt(this.lookAt);
  }

  project(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.camera);
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && p.z > -1 };
  }

  private resize(): void {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // On tall screens (phones, iPads in portrait) keep roughly the same horizontal view as on
    // a landscape screen by widening the vertical field of view, so scenes aren't cropped.
    const minAspect = 1.35;
    const half = THREE.MathUtils.degToRad(38 / 2);
    this.camera.fov = this.camera.aspect >= minAspect ? 38 : Math.min(76, THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(half) * minAspect) / this.camera.aspect)));
    this.camera.updateProjectionMatrix();
  }

  private setPointer(e: PointerEvent): void {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
  }

  private hitClickable(): (() => void) | null {
    const targets = [...this.stage.clickables.keys()];
    if (!targets.length) return null;
    const hits = this.ray.intersectObjects(targets, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const fn = this.stage.clickables.get(o);
        if (fn) return fn;
        o = o.parent;
      }
    }
    return null;
  }

  private onClick(e: PointerEvent): void {
    this.setPointer(e);
    const fn = this.hitClickable();
    if (fn) fn();
    else this.onMiss?.(this.ray);
  }

  private onMove(e: PointerEvent): void {
    this.setPointer(e);
    this.renderer.domElement.style.cursor = this.hitClickable() ? 'pointer' : '';
  }

  /** Undo last frame's player view so screens see (and move) their own camera. */
  private restoreCamera(): void {
    const b = this.base;
    this.base = null;
    if (!b) return;
    // if a screen moved the camera since the last frame, keep its new position
    if (this.camera.position.equals(b.applied)) this.camera.position.copy(b.pos);
    this.camera.lookAt(this.lookAt);
  }

  /** Orbit/zoom/pan the screen's camera around its look-at point by the player's view. */
  private applyView(): void {
    const v = this.view;
    const cam = this.camera;
    const pos = cam.position.clone();
    const look = this.lookAt.clone();
    const off = pos.clone().sub(look);
    const s = new THREE.Spherical().setFromVector3(off);
    s.theta += v.yaw;
    s.phi = Math.min(Math.PI - 0.15, Math.max(0.12, s.phi - v.pitch));
    s.radius *= v.zoom;
    cam.lookAt(look);
    cam.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const target = look.clone().addScaledVector(right, v.panX * s.radius).addScaledVector(up, v.panY * s.radius);
    cam.position.copy(target).add(new THREE.Vector3().setFromSpherical(s));
    cam.lookAt(target);
    cam.updateMatrixWorld();
    this.base = { pos, look, applied: cam.position.clone() };
  }

  resetView(): void {
    Object.assign(this.view, { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 });
    this.resetBtn.style.display = 'none';
  }

  private viewChanged(): void {
    const v = this.view;
    v.pitch = Math.max(-0.9, Math.min(0.9, v.pitch));
    v.zoom = Math.max(0.45, Math.min(1.8, v.zoom));
    v.panX = Math.max(-0.6, Math.min(0.6, v.panX));
    v.panY = Math.max(-0.4, Math.min(0.4, v.panY));
    this.resetBtn.style.display = '';
  }

  /** Mouse: drag = rotate, right/middle-drag or shift-drag = pan, wheel = zoom. Touch: drag / two-finger pinch & pan. */
  private setupViewControls(): void {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.drag = { button: e.shiftKey ? 2 : e.button, moved: 0, pinch: this.pinchDist() };
    });
    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev || !this.drag) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.moved <= 6 || this.viewLocked) return;
      const h = this.host.clientHeight || 1;
      if (this.pointers.size >= 2) {
        const d = this.pinchDist();
        if (this.drag.pinch > 0 && d > 0) this.view.zoom *= this.drag.pinch / d;
        this.drag.pinch = d;
        this.view.panX -= (dx / h) * 0.5;
        this.view.panY += (dy / h) * 0.5;
      } else if (this.drag.button === 0) {
        this.view.yaw -= dx * 0.008;
        this.view.pitch += dy * 0.006;
      } else {
        this.view.panX -= dx / h;
        this.view.panY += dy / h;
      }
      this.viewChanged();
    });
    el.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      if (!this.pointers.size) this.drag = null;
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.viewLocked) return;
        this.view.zoom *= Math.exp(e.deltaY * 0.0012);
        this.viewChanged();
      },
      { passive: false },
    );
    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'btn small view-reset';
    this.resetBtn.textContent = '⟲ รีเซ็ตมุมกล้อง';
    this.resetBtn.style.display = 'none';
    this.resetBtn.addEventListener('click', () => this.resetView());
    this.host.appendChild(this.resetBtn);
  }

  private pinchDist(): number {
    const p = [...this.pointers.values()];
    return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
  }

  /** Dev/testing: advance the game clock without waiting for animation frames. */
  step(seconds: number, fps = 30): void {
    this.restoreCamera();
    for (let t = 0; t < seconds; t += 1 / fps) this.stage.tick(1 / fps);
    this.applyView();
    this.renderer.render(this.scene, this.camera);
    this.stage.placeLabels();
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // ?shots=1 (tools/opening-shots.mjs): time only moves when step() is called, so frames repeat exactly
    const manual = location.search.includes('shots=1');
    this.restoreCamera();
    if (!manual) this.stage.tick(dt);
    this.applyView();
    this.renderer.render(this.scene, this.camera);
    this.stage.placeLabels();
  }
}
