import * as THREE from 'three';
import type { BoneName, Rig } from './skeleton';

/**
 * Procedural animation: an idle/walk base layer, one-shot gestures blended over it, a talking
 * head bob and tail sway. Poses are Euler rotations per bone (order XYZ, rest = identity):
 *   x — pitch (negative swings a hanging limb forward), z — roll (raises an arm sideways:
 *   +z for her left, −z for her right), y — twist.
 */

export const GESTURES = ['wave', 'nod', 'bow', 'cheer', 'shy'] as const;
export type Gesture = (typeof GESTURES)[number];

type Euler3 = [number, number, number];
type Pose = Partial<Record<BoneName, Euler3>> & { hipsY?: number };

const DURATION: Record<Gesture, number> = { wave: 2.8, nod: 1.5, bow: 2.6, cheer: 2.4, shy: 3.2 };

/** Walk cycle period (two steps) and the ground speed that keeps feet from sliding. */
const CYCLE = 0.9;
const SPEED = 0.36;
/** Radius of the loop she walks around the stage. */
const LOOP_RADIUS = 0.35;

const TAU = Math.PI * 2;
const sides = [1, -1] as const;
const k = (s: number) => (s > 0 ? 'L' : 'R');
const env = (t: number, d: number, fadeIn = 0.35, fadeOut = 0.45) => THREE.MathUtils.smoothstep(t, 0, fadeIn) * (1 - THREE.MathUtils.smoothstep(t, d - fadeOut, d));
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function idlePose(t: number): Pose {
  const p: Pose = {
    chest: [0.015 * Math.sin(t * 2), 0, 0],
    head: [0.01 * Math.sin(t * 1.3), 0, 0.03 * Math.sin(t * 0.7)],
  };
  for (const s of sides) {
    p[`shoulder${k(s)}` as BoneName] = [0, 0, s * (0.05 + 0.015 * Math.sin(t * 2))];
    p[`elbow${k(s)}` as BoneName] = [-0.08, 0, 0];
  }
  return p;
}

function walkPose(phase: number, amount: number): Pose {
  const sin = Math.sin(phase), cos = Math.cos(phase);
  const p: Pose = {
    hipsY: 0.006 * Math.cos(2 * phase) * amount,
    hips: [0, 0.08 * sin * amount, 0],
    chest: [0.04 * amount, -0.07 * sin * amount, 0],
    head: [-0.03 * amount, 0.03 * sin * amount, 0],
  };
  for (const s of sides) {
    // Her left leg swings forward as sin(phase) rises; the right is opposite.
    const swing = s * sin;
    const thigh = -0.42 * swing * amount;
    const knee = (0.08 + 0.62 * Math.max(0, s * cos) ** 1.5) * amount;
    p[`thigh${k(s)}` as BoneName] = [thigh, 0, 0];
    p[`knee${k(s)}` as BoneName] = [knee, 0, 0];
    p[`ankle${k(s)}` as BoneName] = [-(thigh + knee) * 0.55, 0, 0];
    p[`shoulder${k(s)}` as BoneName] = [0.34 * swing * amount, 0, s * 0.1];
    p[`elbow${k(s)}` as BoneName] = [-0.3, 0, 0];
  }
  return p;
}

function gesturePose(g: Gesture, t: number): Pose {
  switch (g) {
    case 'wave':
      // Chibi arms are short: raised overhead they vanish into the head, so the upper arm goes out
      // to the side and the forearm stands up beside her cheek, waving side to side.
      return {
        shoulderR: [-0.8, 0, -1.1],
        elbowR: [0, 0, -1.35 - 0.35 * Math.sin(t * 9)],
        chest: [0, 0.08, 0.05],
        head: [0, 0.05, 0.1],
      };
    case 'nod':
      return { head: [0.28 * Math.max(0, Math.sin((t / 0.65) * TAU * 0.5)) ** 1.2, 0, 0], neck: [0.06, 0, 0] };
    case 'bow':
      return {
        spine: [0.3, 0, 0],
        chest: [0.32, 0, 0],
        head: [0.18, 0, 0],
        shoulderL: [-0.35, 0, -0.08],
        shoulderR: [-0.35, 0, 0.08],
        elbowL: [-0.4, 0, 0],
        elbowR: [-0.4, 0, 0],
      };
    case 'cheer': {
      const bounce = Math.abs(Math.sin(t * 7));
      return {
        hipsY: 0.016 * bounce,
        // Arms up and out in a V (straight overhead would hide them in the big head).
        shoulderL: [-0.4, 0, 1.75 + 0.1 * Math.sin(t * 14)],
        shoulderR: [-0.4, 0, -1.75 - 0.1 * Math.sin(t * 14 + 1)],
        elbowL: [0, 0, 0.5],
        elbowR: [0, 0, -0.5],
        head: [-0.12, 0, 0.05 * Math.sin(t * 7)],
        chest: [-0.06, 0, 0],
      };
    }
    case 'shy': {
      const sway = Math.sin(t * 2.2);
      return {
        // Hands clasped in front of her tummy.
        shoulderL: [-0.6, 0, -0.12],
        shoulderR: [-0.6, 0, 0.12],
        elbowL: [-1.2, 0, 0],
        elbowR: [-1.2, 0, 0],
        chest: [0.08, 0.12 * sway, 0],
        head: [0.2, 0.08 * sway, 0.14],
        hips: [0, -0.06 * sway, 0],
      };
    }
  }
}

const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler();
const toQuat = (r: Euler3 | undefined, out: THREE.Quaternion) => out.setFromEuler(e.set(r?.[0] ?? 0, r?.[1] ?? 0, r?.[2] ?? 0, 'XYZ'));

export interface AnimatorOptions {
  /** Snap to the target pose every frame (screenshots) and walk in place instead of travelling. */
  instant?: boolean;
}

export class Animator {
  walking = false;
  talking = false;
  private gesture: { name: Gesture; start: number } | null = null;
  /** 0..1 blend of the walk cycle (eases in/out when starting/stopping). */
  private walkAmount = 0;
  private phase = 0;
  /** Root motion: position on the ground and heading (radians from +Z toward +X). */
  private readonly pos = new THREE.Vector3();
  private yaw = 0;
  private loopAngle = 0;
  private tailVel = 0;
  private tailLag = 0;
  private time = 0;
  private readonly hipsRest: number;

  constructor(
    private readonly rig: Rig,
    private readonly mover: THREE.Object3D,
    private readonly opts: AnimatorOptions = {},
  ) {
    this.hipsRest = rig.bone('hips').position.y;
  }

  play(g: Gesture): void {
    this.gesture = { name: g, start: this.time };
  }

  /** Name of the gesture playing right now, if any. */
  get currentGesture(): Gesture | null {
    return this.gesture?.name ?? null;
  }

  update(time: number, delta: number): void {
    this.time = time;
    const instant = this.opts.instant || delta <= 0;
    const dt = instant ? 0 : delta;

    const moving = this.updateRootMotion(dt);
    const wantWalk = this.walking || moving;
    this.walkAmount = instant ? (wantWalk ? 1 : 0) : THREE.MathUtils.damp(this.walkAmount, wantWalk ? 1 : 0, 6, dt);
    this.phase = instant ? (time / CYCLE) * TAU : this.phase + (dt / CYCLE) * TAU * Math.max(0.3, this.walkAmount);

    const base = idlePose(time);
    const walk = walkPose(this.phase, this.walkAmount);
    const pose: Pose = { ...base };
    for (const [name, r] of Object.entries(walk) as [keyof Pose, Euler3 | number][]) {
      if (name === 'hipsY') pose.hipsY = r as number;
      else {
        const b = base[name as BoneName] ?? [0, 0, 0];
        const w = r as Euler3;
        pose[name as BoneName] = [b[0] * (1 - this.walkAmount) + w[0], b[1] + w[1], b[2] * (1 - this.walkAmount) + w[2]];
      }
    }

    let gw = 0;
    let gp: Pose = {};
    if (this.gesture) {
      const gt = time - this.gesture.start;
      const d = DURATION[this.gesture.name];
      if (gt >= d && !this.opts.instant) this.gesture = null;
      else {
        gw = this.opts.instant ? 1 : env(gt, d);
        gp = gesturePose(this.gesture.name, gt);
      }
    }

    if (this.talking) {
      const head = pose.head ?? [0, 0, 0];
      pose.head = [head[0] + 0.025 * Math.sin(time * 7.3) * Math.max(0, Math.sin(time * 1.7)), head[1] + 0.03 * Math.sin(time * 1.1), head[2]];
    }

    this.updateTails(pose, dt, time);

    const rate = 1 - Math.exp(-dt * 14);
    for (const [name, bone] of this.rig.bones) {
      if (name === 'root') continue;
      toQuat(pose[name], q1);
      if (gw > 0 && gp[name]) q1.slerp(toQuat(gp[name], q2), gw);
      if (instant) bone.quaternion.copy(q1);
      else bone.quaternion.slerp(q1, rate);
    }
    const hipsY = (pose.hipsY ?? 0) * (1 - gw) + (gp.hipsY ?? 0) * gw;
    const hips = this.rig.bone('hips');
    hips.position.y = instant ? this.hipsRest + hipsY : THREE.MathUtils.lerp(hips.position.y, this.hipsRest + hipsY, rate);

    this.mover.position.copy(this.pos);
    this.mover.rotation.y = this.yaw;
  }

  /**
   * Walking travels around a loop on the stage; when walking stops she heads back to the center
   * and turns to face front. Returns whether she is still travelling.
   */
  private updateRootMotion(dt: number): boolean {
    if (this.opts.instant || dt <= 0) return false;
    const step = SPEED * dt * this.walkAmount;
    if (this.walking) {
      if (this.pos.lengthSq() < 1e-6) this.loopAngle = 0;
      // The loop's center sits to her left (+X) of the stage center, so she sets off forward (+Z).
      this.loopAngle += step / LOOP_RADIUS;
      const a = this.loopAngle;
      const target = new THREE.Vector3(LOOP_RADIUS * (1 - Math.cos(a)), 0, LOOP_RADIUS * Math.sin(a));
      this.pos.lerp(target, 1 - Math.exp(-dt * 8));
      this.yaw += angleDiff(a, this.yaw) * (1 - Math.exp(-dt * 6));
      return true;
    }
    const dist = this.pos.length();
    if (dist > 0.004) {
      const heading = Math.atan2(-this.pos.x, -this.pos.z);
      this.yaw += angleDiff(heading, this.yaw) * (1 - Math.exp(-dt * 5));
      const facing = Math.max(0, Math.cos(angleDiff(heading, this.yaw)));
      const move = Math.min(dist, SPEED * dt * Math.max(0.35, facing));
      this.pos.addScaledVector(this.pos.clone().normalize(), -move);
      return true;
    }
    this.pos.set(0, 0, 0);
    const err = angleDiff(0, this.yaw);
    this.yaw += err * (1 - Math.exp(-dt * 5));
    return Math.abs(err) > 0.08;
  }

  /** Twin tails trail behind with a damped spring driven by the body's motion. */
  private updateTails(pose: Pose, dt: number, time: number): void {
    const drive = this.walkAmount * Math.sin(this.phase * 2 - 0.9) * 0.06 + 0.025 * Math.sin(time * 1.1);
    if (dt > 0) {
      this.tailVel += ((drive - this.tailLag) * 60 - this.tailVel * 9) * dt;
      this.tailLag += this.tailVel * dt;
    } else this.tailLag = drive;
    const back = 0.06 * this.walkAmount;
    for (const s of sides) {
      pose[`tail${k(s)}1` as BoneName] = [back, 0, s * this.tailLag];
      pose[`tail${k(s)}2` as BoneName] = [back * 0.8, 0, s * this.tailLag * 1.4];
    }
  }
}
