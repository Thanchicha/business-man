import * as THREE from 'three';
import type { CharSpec, Expr } from '../../game/specs';
import { mat, mesh, texMat } from './mat';

const EYE_DARK = '#2b1d2b';
const MOUTH = '#b8475f';
const R = 0.42; // head radius; the head is about half the body height, which makes it chibi
const HEAD_Y = 1.08;

// geometries shared by every character
const shared = <T extends THREE.BufferGeometry>(g: T): T => {
  g.userData.shared = true;
  return g;
};
const SPHERE = shared(new THREE.SphereGeometry(1, 20, 14));
const ARC = shared(new THREE.TorusGeometry(0.05, 0.013, 6, 16, Math.PI));
const RING = shared(new THREE.TorusGeometry(0.03, 0.01, 6, 16));
const GLASS = shared(new THREE.TorusGeometry(0.1, 0.011, 8, 28));
const BLUSH = shared(new THREE.CircleGeometry(0.055, 16));

function ball(color: string, sx: number, sy = sx, sz = sx, shadow = false): THREE.Mesh {
  const m = mesh(SPHERE, mat(color), shadow);
  m.scale.set(sx, sy, sz);
  return m;
}

/** Point on the head surface. ax = left/right angle, ay = up/down angle (radians). */
function surf(ax: number, ay: number, out = 0): THREE.Vector3 {
  const r = R + out;
  return new THREE.Vector3(r * Math.sin(ax) * Math.cos(ay), r * Math.sin(ay), r * Math.cos(ax) * Math.cos(ay));
}

/** Places a face feature on the head and turns it to face outwards. */
function stick(head: THREE.Object3D, obj: THREE.Object3D, ax: number, ay: number, out = 0): THREE.Object3D {
  const p = surf(ax, ay, out);
  obj.position.copy(p);
  obj.lookAt(p.clone().multiplyScalar(2));
  head.add(obj);
  return obj;
}

function eyeOpen(spec: CharSpec, big = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(ball(EYE_DARK, 0.068 * big, 0.092 * big, 0.03));
  const iris = ball(spec.eye, 0.055 * big, 0.058 * big, 0.02);
  iris.position.set(0, -0.026 * big, 0.014);
  const hi = ball('#ffffff', 0.024 * big, 0.024 * big, 0.01);
  hi.position.set(-0.022, 0.03 * big, 0.03);
  const hi2 = ball('#ffffff', 0.011, 0.011, 0.01);
  hi2.position.set(0.022, -0.035 * big, 0.03);
  g.add(iris, hi, hi2);
  return g;
}

function eyeArc(up: boolean): THREE.Object3D {
  const m = mesh(ARC, mat(EYE_DARK), false);
  if (!up) m.rotation.z = Math.PI;
  return m;
}

function eyeLine(): THREE.Object3D {
  return ball(EYE_DARK, 0.06, 0.014, 0.012);
}

/** Torso texture: track jacket stripes, a striped shirt, or plain. */
function topMaterial(s: CharSpec): THREE.Material {
  if (s.topStyle === 'stripe') {
    return texMat(`stripe|${s.top}|${s.accent}`, 64, 64, (c) => {
      c.fillStyle = s.top;
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = s.accent;
      for (let y = 0; y < 64; y += 16) c.fillRect(0, y, 64, 7);
    });
  }
  if (s.topStyle === 'track') {
    return texMat(`track|${s.top}|${s.accent}`, 128, 64, (c) => {
      c.fillStyle = s.top;
      c.fillRect(0, 0, 128, 64);
      c.fillStyle = s.accent;
      c.fillRect(0, 20, 128, 5); // chest band
      c.fillRect(30, 0, 3, 64); // side stripes
      c.fillRect(95, 0, 3, 64);
      c.fillStyle = s.topShade;
      c.fillRect(63, 25, 2, 39); // zipper (front of the capsule is u = 0.5)
    });
  }
  return mat(s.top);
}

export class Chibi {
  readonly root = new THREE.Group();
  readonly head = new THREE.Group();
  private legs: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private eyes = new Map<Expr, THREE.Group>();
  private mouths = new Map<Expr, THREE.Object3D>();
  private tail?: THREE.Group;
  walking = false;
  /** Seated on a chair: legs forward, no walking swing. */
  sitting = false;
  private phase = Math.random() * 10;
  expr: Expr = 'normal';

  constructor(readonly spec: CharSpec) {
    this.build();
    this.setExpr('normal');
  }

  private build(): void {
    const s = this.spec;
    const body = new THREE.Group();
    this.root.add(body);

    // legs and shoes, pivoting at the hip
    const legColor = s.bottomStyle === 'pants' ? s.bottom : s.legs ?? s.skin;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.1, 0.36, 0);
      const leg = mesh(new THREE.CapsuleGeometry(0.08, 0.14, 4, 10), mat(legColor));
      leg.position.y = -0.14;
      pivot.add(leg);
      if (s.bottomStyle === 'pants' && s.topStyle === 'track') {
        const stripe = mesh(new THREE.CapsuleGeometry(0.082, 0.14, 4, 10), mat(s.accent));
        stripe.scale.set(0.18, 1, 1);
        stripe.position.set(side * 0.07, -0.14, 0);
        pivot.add(stripe);
      }
      if (s.chunkyBoots) {
        const boot = mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.2, 14), mat(s.shoes));
        boot.position.y = -0.24;
        const sole = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 14), mat('#b996a8'));
        sole.position.y = -0.33;
        sole.scale.z = 1.25;
        const toe = ball(s.shoes, 0.12, 0.08, 0.12, true);
        toe.position.set(0, -0.29, 0.07);
        const lace = mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), mat('#ff9cc4'));
        lace.position.set(0, -0.2, 0.1);
        pivot.add(boot, sole, toe, lace);
      } else {
        const shoe = ball(s.shoes, 0.1, 0.07, 0.14, true);
        shoe.position.set(0, -0.3, 0.03);
        pivot.add(shoe);
      }
      body.add(pivot);
      this.legs.push(pivot);
    }

    // hips: pants or a pleated skirt
    if (s.bottomStyle === 'skirt') {
      const skirt = mesh(new THREE.CylinderGeometry(0.17, 0.31, 0.24, 14, 1, true), mat(s.bottom, { side: THREE.DoubleSide, flat: true }));
      skirt.position.y = 0.4;
      body.add(skirt);
    } else {
      const hips = mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.14, 16), mat(s.bottom));
      hips.position.y = 0.42;
      body.add(hips);
    }

    // torso
    const torso = mesh(new THREE.CapsuleGeometry(0.18, 0.16, 6, 18), topMaterial(s));
    torso.position.y = 0.6;
    torso.scale.set(1, 1, 0.86);
    body.add(torso);
    if (s.topStyle === 'sweater') {
      const heart = ball(s.accent, 0.035, 0.03, 0.02);
      heart.position.set(0, 0.47, 0.16);
      body.add(heart);
    } else if (s.topStyle === 'hoodie') {
      const hood = mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 20), mat(s.topShade));
      hood.position.set(0, 0.77, -0.05);
      hood.rotation.x = Math.PI / 2.4;
      body.add(hood);
    } else if (s.topStyle === 'shirt') {
      const tie = mesh(new THREE.BoxGeometry(0.05, 0.18, 0.02), mat(s.accent));
      tie.position.set(0, 0.62, 0.165);
      body.add(tie);
    }

    // arms with hands, pivoting at the shoulders
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.22, 0.73, 0);
      pivot.rotation.z = side * 0.18;
      const arm = mesh(new THREE.CapsuleGeometry(0.062, 0.15, 4, 10), mat(s.top));
      arm.position.y = -0.11;
      pivot.add(arm);
      if (s.topStyle === 'track') {
        const st = mesh(new THREE.CapsuleGeometry(0.064, 0.15, 4, 10), mat(s.accent));
        st.scale.set(0.25, 1, 1);
        st.position.set(side * 0.045, -0.11, 0);
        pivot.add(st);
      }
      const hand = ball(s.skin, 0.065, 0.065, 0.065, true);
      hand.position.y = -0.24;
      pivot.add(hand);
      body.add(pivot);
      this.arms.push(pivot);
    }

    const neck = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), mat(s.skin));
    neck.position.y = 0.8;
    body.add(neck);
    if (s.choker) {
      const ch = mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 20), mat(s.choker));
      ch.position.y = 0.8;
      ch.rotation.x = Math.PI / 2;
      const bell = ball('#f2c14e', 0.03, 0.03, 0.03, true);
      bell.position.set(0, 0.765, 0.085);
      body.add(ch, bell);
    }
    if (s.tail) this.buildTail(body, s.tail);

    this.buildHead();
    body.add(this.head);
  }

  private buildTail(body: THREE.Group, t: NonNullable<CharSpec['tail']>): void {
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.42, -0.14);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.02, -0.18),
      new THREE.Vector3(0.05, 0.22, -0.3),
      new THREE.Vector3(0.1, 0.4, -0.22),
    ]);
    this.tail.add(mesh(new THREE.TubeGeometry(curve, 20, 0.035, 8), mat(t.color)));
    const tip = ball(t.color, 0.05, 0.05, 0.05, true);
    tip.position.copy(curve.getPoint(1));
    this.tail.add(tip);
    if (t.bow) {
      const bow = this.bowMesh(t.bow, 0.6);
      bow.position.copy(curve.getPoint(0.55));
      this.tail.add(bow);
    }
    body.add(this.tail);
  }

  private bowMesh(color: string, size = 1): THREE.Group {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const wing = mesh(new THREE.ConeGeometry(0.05 * size, 0.1 * size, 10), mat(color));
      wing.rotation.z = (side * Math.PI) / 2;
      wing.position.x = side * 0.05 * size;
      g.add(wing);
    }
    g.add(ball('#ffffff', 0.025 * size));
    return g;
  }

  private buildHead(): void {
    const s = this.spec;
    const h = this.head;
    h.position.y = HEAD_Y;
    const skull = mesh(SPHERE, mat(s.skin));
    skull.scale.set(R, R * 0.95, R);
    h.add(skull);

    // hair: a tilted cap, a rounded back shell, fringe bumps and side locks
    const hairMat = mat(s.hair);
    const cap = mesh(new THREE.SphereGeometry(R * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
    cap.rotation.x = -0.5;
    h.add(cap);
    if (s.hairStyle !== 'short') {
      const back = mesh(new THREE.SphereGeometry(R * 1.1, 28, 16, Math.PI, Math.PI, 0, Math.PI * (s.hairStyle === 'messy' ? 0.7 : 0.82)), hairMat);
      back.position.y = -0.02;
      h.add(back);
    }
    const fringe = [-0.56, -0.28, 0, 0.28, 0.56];
    fringe.forEach((ax, i) => {
      const b = mesh(SPHERE, hairMat, true);
      b.scale.set(0.12, 0.1 + (i % 2) * 0.02, 0.06);
      stick(h, b, ax, 0.25 - (i % 2) * 0.03, 0.03);
    });
    const lockLen = { short: 0.08, messy: 0.12, bob: 0.26, long: 0.42 }[s.hairStyle];
    for (const side of [-1, 1]) {
      const lock = mesh(new THREE.CapsuleGeometry(0.08, lockLen, 4, 10), hairMat);
      lock.position.set(side * R * 0.86, -0.08 - lockLen / 2, 0.04);
      lock.rotation.z = side * 0.08;
      h.add(lock);
    }
    if (s.hairStyle === 'long') {
      const slab = mesh(new THREE.CapsuleGeometry(0.3, 0.42, 6, 14), hairMat);
      slab.position.set(0, -0.42, -0.2);
      slab.scale.set(1.15, 1, 0.5);
      h.add(slab);
    }
    if (s.hairStyle === 'messy') {
      for (const [x, z, rz] of [[-0.12, 0.05, 0.5], [0.04, -0.05, -0.3], [0.16, 0.1, -0.7]]) {
        const tuft = mesh(new THREE.ConeGeometry(0.06, 0.18, 8), hairMat);
        tuft.position.set(x, R * 0.98, z);
        tuft.rotation.z = rz;
        h.add(tuft);
      }
    }

    // ears
    if (s.ears) {
      for (const side of [-1, 1]) {
        if (s.ears.style === 'cat') {
          const ear = mesh(new THREE.ConeGeometry(0.14, 0.3, 14), mat(s.ears.color));
          ear.position.set(side * 0.26, 0.44, -0.04);
          ear.rotation.z = -side * 0.38;
          const inner = mesh(new THREE.ConeGeometry(0.075, 0.16, 12), mat(s.ears.inner));
          inner.position.set(0, -0.03, 0.06);
          inner.scale.z = 0.45;
          ear.add(inner);
          h.add(ear);
        } else {
          const ear = ball(s.ears.color, 0.1, 0.1, 0.07, true);
          ear.position.set(side * 0.3, 0.32, -0.02);
          const inner = ball(s.ears.inner, 0.055, 0.055, 0.03);
          inner.position.z = 0.05;
          ear.add(inner);
          h.add(ear);
        }
      }
    }
    if (s.bow) {
      const bow = this.bowMesh(s.bow);
      bow.position.copy(surf(0.62, 0.45, 0.04));
      bow.lookAt(bow.position.clone().multiplyScalar(2));
      h.add(bow);
    }

    // blush
    for (const side of [-1, 1]) {
      const b = mesh(BLUSH, mat('#ff9db4', { opacity: 0.55 }), false);
      stick(h, b, side * 0.5, -0.3, 0.006);
    }

    // eyes for every expression; only one set is visible at a time
    const EX = 0.3;
    const EY = -0.15;
    const pair = (l: () => THREE.Object3D, r: () => THREE.Object3D): THREE.Group => {
      const g = new THREE.Group();
      stick(g, l(), -EX, EY, 0.005);
      stick(g, r(), EX, EY, 0.005);
      h.add(g);
      return g;
    };
    this.eyes.set('normal', pair(() => eyeOpen(s), () => eyeOpen(s)));
    this.eyes.set('surprised', pair(() => eyeOpen(s, 1.2), () => eyeOpen(s, 1.2)));
    this.eyes.set('happy', pair(() => eyeArc(true), () => eyeArc(true)));
    this.eyes.set('wink', pair(() => eyeOpen(s), () => eyeArc(true)));
    this.eyes.set('sad', pair(() => eyeArc(false), () => eyeArc(false)));
    this.eyes.set('think', pair(() => eyeOpen(s), () => eyeLine()));
    this.eyes.set('annoyed', pair(() => eyeLine(), () => eyeLine()));

    // mouths
    const MY = -0.4;
    const smile = () => mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI), mat(MOUTH), false);
    const open = () => {
      const g = new THREE.Group();
      g.add(ball('#8a2f45', 0.055, 0.042, 0.02));
      const tongue = ball('#ff8fa8', 0.034, 0.02, 0.02);
      tongue.position.set(0, -0.018, 0.006);
      g.add(tongue);
      return g;
    };
    const m = (e: Expr, o: THREE.Object3D, rot = 0) => {
      o.rotation.z = rot;
      const holder = new THREE.Group();
      holder.add(o);
      stick(h, holder, 0, MY, 0.005);
      this.mouths.set(e, holder);
    };
    m('normal', smile(), Math.PI);
    m('happy', open());
    m('wink', open());
    m('surprised', mesh(RING, mat('#8a2f45'), false));
    m('sad', smile());
    m('think', ball(MOUTH, 0.025, 0.008, 0.008));
    m('annoyed', ball(MOUTH, 0.045, 0.009, 0.008));

    if (s.glasses) {
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        const ring = mesh(GLASS, mat(s.glasses), false);
        stick(g, ring, side * EX, EY, 0.04);
        const temple = mesh(new THREE.BoxGeometry(0.015, 0.015, 0.3), mat(s.glasses), false);
        temple.position.set(side * 0.37, -0.02, 0.12);
        temple.rotation.y = side * 0.25;
        g.add(temple);
      }
      const bridge = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.08, 6), mat(s.glasses), false);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.copy(surf(0, EY + 0.03, 0.05));
      g.add(bridge);
      h.add(g);
    }
  }

  setExpr(e: Expr): this {
    this.expr = e;
    for (const [k, g] of this.eyes) g.visible = k === e;
    for (const [k, m] of this.mouths) m.visible = k === e;
    return this;
  }

  /** Turns to face a point on the ground. */
  faceTo(x: number, z: number): void {
    this.root.rotation.y = Math.atan2(x - this.root.position.x, z - this.root.position.z);
  }

  update(dt: number): void {
    this.phase += dt * (this.walking ? 11 : 2.2);
    const p = this.phase;
    if (this.sitting) {
      for (const l of this.legs) l.rotation.x = -1.4;
    } else if (this.walking) {
      const swing = Math.sin(p) * 0.6;
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.arms[0].rotation.x = -swing * 0.8;
      this.arms[1].rotation.x = swing * 0.8;
      this.root.children[0].position.y = Math.abs(Math.sin(p)) * 0.05;
      this.head.rotation.z = Math.sin(p) * 0.04;
    } else {
      for (const l of this.legs) l.rotation.x *= 0.8;
      for (const a of this.arms) a.rotation.x *= 0.8;
      this.root.children[0].position.y = 0;
      this.head.position.y = HEAD_Y + Math.sin(p) * 0.012;
      this.head.rotation.z = Math.sin(p * 0.5) * 0.03;
    }
    if (this.tail) this.tail.rotation.y = Math.sin(p * 0.8) * 0.35;
  }

  arm(side: -1 | 1): THREE.Object3D {
    return this.arms[side < 0 ? 0 : 1];
  }

  /** Bounces in place, for reactions. */
  hop(stage: { tween: (t: object, to: Record<string, number>, ms: number) => Promise<void> }): void {
    const body = this.root.children[0];
    stage.tween(body.position, { y: 0.18 }, 140).then(() => stage.tween(body.position, { y: 0 }, 180));
  }
}

/** Cat for the cat café: round body, little legs, waving tail. */
export class Cat {
  readonly root = new THREE.Group();
  private legs: THREE.Object3D[] = [];
  private tail: THREE.Group;
  private headG: THREE.Group;
  walking = false;
  sitting = true;
  private phase = Math.random() * 10;

  constructor(coat: string, belly: string) {
    const body = ball(coat, 0.2, 0.17, 0.28, true);
    body.position.y = 0.24;
    this.root.add(body);
    const bellyM = ball(belly, 0.15, 0.12, 0.22);
    bellyM.position.set(0, 0.2, 0.02);
    this.root.add(bellyM);
    for (const [x, z] of [[-0.1, 0.15], [0.1, 0.15], [-0.1, -0.15], [0.1, -0.15]]) {
      const leg = mesh(new THREE.CapsuleGeometry(0.045, 0.08, 4, 8), mat(coat));
      leg.position.set(x, 0.08, z);
      this.root.add(leg);
      this.legs.push(leg);
    }
    this.headG = new THREE.Group();
    this.headG.position.set(0, 0.42, 0.25);
    this.headG.add(ball(coat, 0.17, 0.15, 0.15, true));
    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.06, 0.12, 10), mat(coat));
      ear.position.set(side * 0.1, 0.13, -0.01);
      ear.rotation.z = -side * 0.3;
      const inner = mesh(new THREE.ConeGeometry(0.035, 0.07, 8), mat('#ffb3c8'));
      inner.position.set(0, -0.01, 0.025);
      inner.scale.z = 0.4;
      ear.add(inner);
      const eye = ball(EYE_DARK, 0.025, 0.032, 0.015);
      eye.position.set(side * 0.065, 0.01, 0.135);
      const hi = ball('#ffffff', 0.009);
      hi.position.set(side * 0.06, 0.025, 0.148);
      this.headG.add(ear, eye, hi);
    }
    const nose = ball('#ff7ea8', 0.018, 0.013, 0.012);
    nose.position.set(0, -0.03, 0.15);
    this.headG.add(nose);
    this.root.add(this.headG);
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.28, -0.26);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.12, -0.1), new THREE.Vector3(0, 0.3, -0.08)]);
    this.tail.add(mesh(new THREE.TubeGeometry(curve, 12, 0.035, 8), mat(coat)));
    this.root.add(this.tail);
  }

  update(dt: number): void {
    this.phase += dt * (this.walking ? 12 : 2);
    const p = this.phase;
    this.tail.rotation.z = Math.sin(p * (this.walking ? 0.5 : 1)) * 0.5;
    this.legs.forEach((l, i) => (l.rotation.x = this.walking ? Math.sin(p + (i % 2) * Math.PI) * 0.6 : 0));
    this.headG.rotation.z = this.walking ? 0 : Math.sin(p * 0.6) * 0.15;
    this.root.children[0].position.y = 0.24 + (this.walking ? Math.abs(Math.sin(p)) * 0.02 : 0);
  }
}

export const CAT_COATS: [string, string][] = [
  ['#ffffff', '#fff1f5'],
  ['#f6b06e', '#ffe2c4'],
  ['#3e3844', '#6a6272'],
];
