import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Rei } from '../character/Rei';
import type { Expression } from '../character/types';
import { Stage } from '../scene/Stage';
import type { AppParams, ViewName } from './params';

interface ViewPreset {
  /** Azimuth in degrees from +Z toward +X. */
  azimuth: number;
  elevation: number;
  target: THREE.Vector3;
  /** Vertical world extent to fit in frame. */
  fitHeight: number;
}

// Rei is ≈1.12 tall (see character/build.ts), so the framing sits higher and wider than Shion's.
const BODY_TARGET = new THREE.Vector3(0, 0.575, 0);
/** Fraction of her walking movement the camera follows (more on narrow portrait screens). */
const FOLLOW = 0.6;
const FOLLOW_PORTRAIT = 0.85;
export const VIEW_PRESETS: Record<Exclude<ViewName, 'free'>, ViewPreset> = {
  front: { azimuth: 0, elevation: 2, target: BODY_TARGET, fitHeight: 1.27 },
  side: { azimuth: 90, elevation: 2, target: BODY_TARGET, fitHeight: 1.27 },
  back: { azimuth: 180, elevation: 2, target: BODY_TARGET, fitHeight: 1.27 },
  threequarter: { azimuth: 38, elevation: 4, target: BODY_TARGET, fitHeight: 1.27 },
  face: { azimuth: 0, elevation: 2, target: new THREE.Vector3(0, 0.825, 0), fitHeight: 0.48 },
};

interface CameraTween {
  from: THREE.Spherical;
  to: THREE.Spherical;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
}

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(20, 1, 0.05, 50);
  readonly controls: OrbitControls;
  readonly rei: Rei;
  /** How far the camera has been shifted to follow her. */
  private readonly followed = new THREE.Vector3();
  private shadow: THREE.Object3D | undefined;
  private readonly clock = new THREE.Clock();
  private tween: CameraTween | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly params: AppParams,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.shot });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    host.appendChild(this.renderer.domElement);

    new Stage(this.scene, this.camera);
    this.rei = new Rei({ instant: params.shot });
    this.scene.add(this.rei.root);
    this.shadow = this.scene.getObjectByName('contactShadow');

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !params.shot;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 9;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('start', () => (this.tween = null));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setView(params.view === 'free' ? 'threequarter' : params.view, true);
    this.rei.setExpression(params.expr);
    this.rei.setWalking(params.walk);
    this.rei.setTalking(params.talk);
    if (params.gesture) this.rei.playGesture(params.gesture);
  }

  setExpression(expr: Expression): void {
    this.rei.setExpression(expr);
  }

  /** Moves the camera to a named preset (animated unless `instant`). */
  setView(name: ViewName, instant = false): void {
    if (name === 'free') return;
    const preset = VIEW_PRESETS[name];
    const to = new THREE.Spherical(
      this.fitDistance(preset.fitHeight),
      THREE.MathUtils.degToRad(90 - preset.elevation),
      THREE.MathUtils.degToRad(preset.azimuth),
    );
    if (instant) {
      this.tween = null;
      this.applySpherical(to, this.presetTarget(name, preset));
      return;
    }
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    // Take the short way around.
    const dTheta = Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
    to.theta = from.theta + dTheta;
    this.tween = { from, to, fromTarget: this.controls.target.clone(), toTarget: this.presetTarget(name, preset), t: 0 };
  }

  /**
   * Camera target for a preset, shifted with her walking. On portrait screens the face close-up
   * aims a little lower so the face sits above the stacked control dock.
   */
  private presetTarget(name: Exclude<ViewName, 'free'>, preset: ViewPreset): THREE.Vector3 {
    const t = preset.target.clone().add(this.followed);
    if (name === 'face' && this.camera.aspect < 1) t.y -= 0.07;
    return t;
  }

  private fitDistance(fitHeight: number): number {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const byHeight = fitHeight / 2 / Math.tan(vFov / 2);
    // On narrow (portrait) screens make sure the hair width still fits.
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const byWidth = (fitHeight * 0.62) / 2 / Math.tan(hFov / 2);
    return Math.max(byHeight, byWidth);
  }

  private applySpherical(s: THREE.Spherical, target: THREE.Vector3): void {
    this.controls.target.copy(target);
    this.camera.position.setFromSpherical(s).add(target);
    this.camera.lookAt(target);
    this.controls.update();
  }

  private resize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(onFrame?: () => void): void {
    this.renderer.setAnimationLoop(() => {
      const delta = Math.min(this.clock.getDelta(), 0.05);
      const time = this.params.shot ? this.params.time : this.clock.elapsedTime;
      if (this.tween) this.stepTween(delta);
      this.rei.update(time, this.params.shot ? 0 : delta);
      this.follow();
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      onFrame?.();
    });
  }

  /**
   * Keeps her in frame while she walks around the stage: the camera follows part of her movement
   * (so the travel still reads against the backdrop) and the floor shadow stays under her feet.
   */
  private follow(): void {
    const ground = this.rei.groundPosition;
    const d = ground.clone().multiplyScalar(this.camera.aspect < 1 ? FOLLOW_PORTRAIT : FOLLOW).sub(this.followed);
    if (d.lengthSq() > 0) {
      this.camera.position.add(d);
      this.controls.target.add(d);
      if (this.tween) {
        this.tween.fromTarget.add(d);
        this.tween.toTarget.add(d);
      }
      this.followed.add(d);
    }
    if (this.shadow) {
      this.shadow.position.set(ground.x, this.shadow.position.y, ground.z);
      this.shadow.rotation.z = this.rei.rig.root.rotation.y;
    }
  }

  private stepTween(delta: number): void {
    const tw = this.tween!;
    tw.t = Math.min(1, tw.t + delta / 0.7);
    const e = 1 - Math.pow(1 - tw.t, 3);
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(tw.from.radius, tw.to.radius, e),
      THREE.MathUtils.lerp(tw.from.phi, tw.to.phi, e),
      THREE.MathUtils.lerp(tw.from.theta, tw.to.theta, e),
    );
    this.applySpherical(s, tw.fromTarget.clone().lerp(tw.toTarget, e));
    if (tw.t >= 1) this.tween = null;
  }
}
