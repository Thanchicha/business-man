import * as THREE from 'three';
import { headFrontZ } from '../body/headShape';
import { RIG } from '../rig';
import { EXPRESSIONS, type Expression, type Part } from '../types';
import { paintEffect, paintFace, PLATE, type EffectKind } from './draw';

export interface FacePart extends Part {
  setExpression(expr: Expression): void;
  /** Lip-flap while talking (mouth frames cycle with a syllable-like rhythm). */
  setTalking(on: boolean): void;
}

/** Talking mouth frame at time t: a rough syllable rhythm with short pauses between phrases. */
function mouthFrame(t: number): 0 | 1 | 2 {
  if (Math.sin(t * 0.9) > 0.8) return 0;
  const v = Math.abs(Math.sin(t * 11.3) * (0.6 + 0.4 * Math.sin(t * 3.7 + 1)));
  return v > 0.62 ? 2 : v > 0.25 ? 1 : 0;
}

/** Offset of the decal above the skin. */
const LIFT = 0.0012;

/** A grid conforming to the front of the head over the PLATE rectangle (UVs = front projection). */
function facePlate(): THREE.BufferGeometry {
  const nx = 72, ny = 48;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / ny;
      const x = PLATE.x0 + (PLATE.x1 - PLATE.x0) * u;
      const y = PLATE.y0 + (PLATE.y1 - PLATE.y0) * v;
      const z = headFrontZ(x, y);
      // Off the head (below the jaw corners): tuck the vertex inside where it can't be seen.
      pos.push(x, y, Number.isNaN(z) ? RIG.headCenter.z : z + LIFT);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function texture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Effect symbols per expression: kind, position (world), size. */
const EFFECTS: Partial<Record<Expression, [EffectKind, [number, number, number], number][]>> = {
  smile: [['exclaim', [0.2, 0.88, 0.16], 0.09]],
  wink: [['note', [0.2, 0.88, 0.16], 0.08]],
  surprised: [['sweat', [0.2, 0.86, 0.16], 0.08], ['sweat', [-0.2, 0.80, 0.16], 0.06]],
  angry: [['anger', [0.2, 0.88, 0.16], 0.075], ['anger', [-0.2, 0.86, 0.16], 0.055]],
  crying: [['question', [0.2, 0.88, 0.16], 0.075]],
  sleepy: [['zzz', [0.2, 0.88, 0.16], 0.1]],
  blush: [['heart', [0.2, 0.88, 0.16], 0.07], ['heart', [-0.2, 0.83, 0.16], 0.05]],
};

// Textures per expression × blink × mouth frame, painted on first use and shared by every copy.
const cache = new Map<string, THREE.Texture>();
const tex = (e: Expression, blink: boolean, mouth: 0 | 1 | 2) => {
  const key = `${e}|${blink}|${mouth}`;
  let t = cache.get(key);
  if (!t) cache.set(key, (t = texture(paintFace(e, { blink, mouth }))));
  return t;
};
const effectTex = new Map<EffectKind, THREE.Texture>();
/** Expressions whose open eyes blink. */
const blinking = new Set<Expression>(['normal', 'surprised', 'angry', 'crying', 'blush']);

/** Face — painted eyes, brows, mouth, blush, tears on a conforming decal, plus effect symbols. */
export function buildFace(): FacePart {
  const group = new THREE.Group();
  group.name = 'face';
  const plate = new THREE.Mesh(facePlate());
  plate.name = 'faceDecal';
  plate.renderOrder = 1;
  group.add(plate);
  const effects = new THREE.Group();
  effects.name = 'faceEffects';
  group.add(effects);
  return { object: group, ...faceController(plate, effects) };
}

/**
 * Drives one face: its own decal material (so copies of a character can wear different
 * expressions) and its effect symbols. Also used for cloned characters.
 */
export function faceController(plate: THREE.Mesh, effects: THREE.Object3D): Omit<FacePart, 'object'> {
  for (const e of EXPRESSIONS) tex(e, false, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: tex('normal', false, 0),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  plate.material = mat;

  let current: Expression = 'normal';
  let talking = false;
  const showEffects = (expr: Expression) => {
    effects.clear();
    for (const [kind, p, size] of EFFECTS[expr] ?? []) {
      if (!effectTex.has(kind)) effectTex.set(kind, texture(paintEffect(kind)));
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: effectTex.get(kind)!, transparent: true, depthWrite: false }));
      s.position.set(...p);
      s.userData.baseY = p[1];
      s.scale.setScalar(size);
      s.renderOrder = 2;
      effects.add(s);
    }
  };

  return {
    setExpression(expr) {
      current = expr;
      mat.map = tex(expr, false, 0);
      mat.needsUpdate = true;
      showEffects(expr);
    },
    setTalking(on) {
      talking = on;
    },
    update(time) {
      // Idle blink and lip-flap (time stays 0 in plain screenshot mode, so shots are deterministic).
      if (time <= 0) return;
      const closed = blinking.has(current) && time % 4.3 < 0.12;
      const want = tex(current, closed, talking ? mouthFrame(time) : 0);
      if (mat.map !== want) {
        mat.map = want;
        mat.needsUpdate = true;
      }
      // Gentle bob of the effect symbols.
      effects.children.forEach((c, i) => (c.position.y = c.userData.baseY + Math.sin(time * 3 + i) * 0.006));
    },
  };
}
