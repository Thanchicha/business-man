import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharSpec, Expr } from '../../game/specs';
import { ADVISOR, PLAYER_F, PLAYER_M, REI, SHION } from '../../game/specs';
import { Chibi } from './character';
import { Kuro } from '../chars/kuro/character/Kuro';
import { Kira } from '../chars/kira/character/Kira';
import { Miyu } from '../chars/miyu/character/Miyu';
import { Extra } from '../chars/extra/character/Extra';
import { Shion } from '../chars/shion/character/Shion';
import { Rei } from '../chars/rei/character/Rei';
import * as ShionAnim from '../chars/shion/character/anim/Animator';
import * as ReiAnim from '../chars/rei/character/anim/Animator';
import * as ShionFace from '../chars/shion/character/face/Face';
import * as ReiFace from '../chars/rei/character/face/Face';
import type { ExtraLook } from '../chars/extra/character/looks';
import * as KuroAnim from '../chars/kuro/character/anim/Animator';
import * as KiraAnim from '../chars/kira/character/anim/Animator';
import * as MiyuAnim from '../chars/miyu/character/anim/Animator';
import * as ExtraAnim from '../chars/extra/character/anim/Animator';
import * as KuroFace from '../chars/kuro/character/face/Face';
import * as KiraFace from '../chars/kira/character/face/Face';
import * as MiyuFace from '../chars/miyu/character/face/Face';
import * as ExtraFace from '../chars/extra/character/face/Face';
import type { Rig } from '../chars/miyu/character/anim/skeleton';
import type { Expression } from '../chars/miyu/character/types';
import type { Gesture } from '../chars/miyu/character/anim/Animator';

/**
 * MIYU and the two player characters (Kuro, Kira) use the rigged toon models from
 * kuro-viewer / kira-viewer / miyu-viewer (copied into src/three/chars). Building one takes a
 * couple of seconds, so each is built once at load and every character on screen is a skinned
 * clone with its own animator and face. They are about 1 unit tall facing +Z; this wraps them at
 * the game's character size and maps the game's expressions, walking and lip-sync onto them.
 */
/**
 * The background cast (kids, students, office workers, shop staff, rival owners, elders) uses one
 * more rigged model, built per look as `extra:<look id>` from the shared body and face. Those are
 * built in the background after start (or on first use) and scaled to the look's own size.
 */
type ModelKey = string;

const MAIN_KINDS = {
  kuro: { build: () => new Kuro({ inPlace: true }), Animator: KuroAnim.Animator, face: KuroFace.faceController },
  kira: { build: () => new Kira({ inPlace: true }), Animator: KiraAnim.Animator, face: KiraFace.faceController },
  miyu: { build: () => new Miyu({ inPlace: true }), Animator: MiyuAnim.Animator, face: MiyuFace.faceController },
  shion: { build: () => new Shion({ inPlace: true }), Animator: ShionAnim.Animator, face: ShionFace.faceController },
  rei: { build: () => new Rei({ inPlace: true }), Animator: ReiAnim.Animator, face: ReiFace.faceController },
};
const EXTRA_KIND = { Animator: ExtraAnim.Animator, face: ExtraFace.faceController };
const extraLooks = new Map<ModelKey, ExtraLook>();
const isExtra = (key: ModelKey) => key.startsWith('extra:');
const kindOf = (key: ModelKey) => (isExtra(key) ? EXTRA_KIND : MAIN_KINDS[key as keyof typeof MAIN_KINDS]);

/** Height the old models had (ground to hair top), so props, cameras and labels still line up. */
const TARGET_HEIGHT = 1.65;
const templates = new Map<ModelKey, { root: THREE.Object3D; bones: string[]; scale: number }>();
const failed = new Set<ModelKey>();

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

/** Builds a model once (measured to the game's size) for the characters to clone; false if it can't be built. */
function ensureTemplate(key: ModelKey): boolean {
  if (templates.has(key)) return true;
  if (failed.has(key)) return false;
  try {
    const look = extraLooks.get(key);
    const m = look ? new Extra({ inPlace: true, look }) : MAIN_KINDS[key as keyof typeof MAIN_KINDS].build();
    m.update(0, 0);
    m.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    m.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      // measure to the hair top: hats don't count
      if (mesh.isMesh && !isOutline(mesh) && mesh.name !== 'hat') box.expandByObject(mesh, true);
    });
    templates.set(key, { root: m.root, bones: [...m.rig.bones.keys()], scale: (TARGET_HEIGHT / Math.max(0.5, box.max.y)) * (look?.scale ?? 1) });
    return true;
  } catch (e) {
    failed.add(key);
    console.warn(`${key} model failed to build, using the simple chibi instead`, e);
    return false;
  }
}

/** Builds MIYU and the two players up front. */
export async function loadMiyu(): Promise<void> {
  for (const key of Object.keys(MAIN_KINDS)) {
    await nextFrame();
    ensureTemplate(key);
  }
}

/** Builds the background-cast models one per frame, so the first customer doesn't stall the game. */
export async function preloadExtras(looks: ExtraLook[]): Promise<void> {
  for (const look of looks) {
    await new Promise((r) => setTimeout(r, 150));
    extraLooks.set(`extra:${look.id}`, look);
    ensureTemplate(`extra:${look.id}`);
  }
}

const isOutline = (m: THREE.Mesh) => m.material instanceof THREE.ShaderMaterial;

/** A skinned copy of a built model with its own bones, animator and face. */
function cloneModel(key: ModelKey) {
  const tpl = templates.get(key)!;
  const root = cloneSkinned(tpl.root);
  const found = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && !found.has(o.name)) found.set(o.name, o as THREE.Bone);
  });
  const bones = new Map(tpl.bones.map((n) => [n, found.get(n)!]));
  // the animator only reads the bones off the rig
  const rig = { bones, bone: (n: string) => bones.get(n)!, get root() { return bones.get('root')!; } } as unknown as Rig;
  // each copy declares its own (structurally equal) Rig type
  const animator = new (kindOf(key).Animator as any)(rig as any, rig.root, { inPlace: true });
  const face = kindOf(key).face(root.getObjectByName('faceDecal') as THREE.Mesh, root.getObjectByName('faceEffects')!);
  return {
    root,
    rig,
    get walking() { return animator.walking; },
    setWalking(on: boolean) { animator.walking = on; },
    /** Only the background cast has a seated pose. */
    setSitting(on: boolean) { (animator as { sitting?: boolean }).sitting = on; },
    setPose(p: Record<string, [number, number, number]> | null) { (animator as unknown as { override: unknown }).override = p; },
    setTalking(on: boolean) { animator.talking = on; face.setTalking(on); },
    setExpression(e: Expression) { face.setExpression(e); },
    playGesture(g: Gesture) { animator.play(g); },
    update(time: number, delta: number) { animator.update(time, delta); face.update?.(time, delta); },
  };
}
type Model = ReturnType<typeof cloneModel>;

export interface Character {
  root: THREE.Object3D;
  head: THREE.Object3D;
  walking: boolean;
  /** Seated on a chair (legs forward, no walking). */
  sitting?: boolean;
  expr: Expr;
  setExpr(e: Expr): unknown;
  faceTo(x: number, z: number): void;
  update(dt: number): void;
  hop(stage: { tween: (t: object, to: Record<string, number>, ms: number) => Promise<void> }): void;
  /** The arm group on one side (-1 left, 1 right), for holding props. */
  arm(side: -1 | 1): THREE.Object3D;
}

const EXPRESSION: Record<Expr, Expression> = {
  normal: 'normal',
  happy: 'smile',
  surprised: 'surprised',
  think: 'normal',
  sad: 'crying',
  annoyed: 'angry',
  wink: 'wink',
};
/** A small gesture that goes with switching to some expressions. */
const EXPR_GESTURE: Partial<Record<Expr, Gesture>> = { happy: 'nod', wink: 'wave', sad: 'shy', think: 'nod' };

/** The game walks characters faster than the viewers do, so the step cycle runs faster to keep feet planted. */
const WALK_TIME = 1.7;

const live = new Set<MiyuModel>();

/** Lip-sync whoever is speaking: 'miyu', the player ('me'), or nobody (null). */
export function setTalking(who: 'miyu' | 'me' | null): void {
  for (const m of live) {
    if (!m.root.parent) live.delete(m);
    else if (m.key === 'miyu' || m.key === 'kuro' || m.key === 'kira') m.talking = who === (m.key === 'miyu' ? 'miyu' : 'me');
  }
}

/** Lip-sync every MIYU in the scene while one of her dialogue lines is being typed out. */
export function setMiyuTalking(on: boolean): void {
  setTalking(on ? 'miyu' : null);
}

export class MiyuModel implements Character {
  /** Positioned and turned by the game. */
  readonly root = new THREE.Group();
  readonly head: THREE.Object3D;
  /** Lifted for hops; holds the scaled model. */
  private readonly lift = new THREE.Group();
  private readonly model: Model;
  private readonly hands: THREE.Object3D[];
  expr: Expr = 'normal';
  private t = Math.random() * 10;
  private isTalking = false;
  private isSitting = false;

  constructor(readonly key: ModelKey = 'miyu') {
    this.model = cloneModel(key);
    const s = templates.get(key)!.scale;
    this.model.root.scale.setScalar(s);
    this.model.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !isOutline(mesh)) mesh.castShadow = true;
    });
    this.lift.add(this.model.root);
    this.root.add(this.lift);
    this.head = this.model.rig.bone('head');
    // Prop holders on the wrists, in game units and placed so the old arm-pivot offsets
    // (cups at about (0, -0.36, 0.07)) land in the hand.
    this.hands = (['wristR', 'wristL'] as const).map((b) => {
      const g = new THREE.Group();
      g.scale.setScalar(1 / s);
      g.position.set(0, (0.36 - 0.05) / s, (-0.07 + 0.03) / s);
      this.model.rig.bone(b).add(g);
      return g;
    });
    live.add(this);
    this.setExpr('normal');
    this.model.update(this.t, 0);
  }

  get walking(): boolean {
    return this.model.walking;
  }

  set walking(on: boolean) {
    this.model.setWalking(on);
  }

  get sitting(): boolean {
    return this.isSitting;
  }

  set sitting(on: boolean) {
    if (on === this.isSitting) return;
    this.isSitting = on;
    this.model.setSitting(on);
  }

  get talking(): boolean {
    return this.isTalking;
  }

  set talking(on: boolean) {
    if (on === this.isTalking) return;
    this.isTalking = on;
    this.model.setTalking(on);
  }

  setExpr(e: Expr): this {
    const changed = e !== this.expr;
    this.expr = e;
    this.model.setExpression(EXPRESSION[e]);
    const g = EXPR_GESTURE[e];
    if (changed && g && !this.walking) this.model.playGesture(g);
    return this;
  }

  faceTo(x: number, z: number): void {
    this.root.rotation.y = Math.atan2(x - this.root.position.x, z - this.root.position.z);
  }

  /** Pins bones to a pose, e.g. { shoulderR: [-1, 0, 0.1] }; null lets the idle and walk motion take over again. */
  pose(p: Record<string, [number, number, number]> | null): void {
    this.model.setPose(p);
  }

  /** A holder on any bone, in game units, so props follow that bone (the chest, a hand...). */
  holder(bone: string): THREE.Object3D {
    const g = new THREE.Group();
    g.scale.setScalar(1 / templates.get(this.key)!.scale);
    this.model.rig.bone(bone as never).add(g);
    return g;
  }

  /** -1 is the hand on the -X side (her right), 1 the +X side, like the old models. */
  arm(side: -1 | 1): THREE.Object3D {
    return this.hands[side < 0 ? 0 : 1];
  }

  update(dt: number): void {
    const d = dt * (this.walking ? WALK_TIME : 1);
    this.t += d;
    this.model.update(this.t, d);
  }

  hop(stage: { tween: (t: object, to: Record<string, number>, ms: number) => Promise<void> }): void {
    this.model.playGesture('cheer');
    stage.tween(this.lift.position, { y: 0.18 }, 140).then(() => stage.tween(this.lift.position, { y: 0 }, 180));
  }
}

/** Builds a character: detailed models for MIYU and the two players, the rigged background cast for specs with a look, chibis for everyone else. */
export function createCharacter(spec: CharSpec): Character {
  let key: ModelKey | null = spec === ADVISOR ? 'miyu' : spec === PLAYER_M ? 'kuro' : spec === PLAYER_F ? 'kira' : spec === SHION ? 'shion' : spec === REI ? 'rei' : null;
  if (spec.extra) {
    key = `extra:${spec.extra.id}`;
    extraLooks.set(key, spec.extra);
    ensureTemplate(key);
  }
  if (key && templates.has(key)) return new MiyuModel(key);
  return new Chibi(spec);
}
