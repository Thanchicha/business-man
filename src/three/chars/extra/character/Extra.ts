import * as THREE from 'three';
import { Animator, type Gesture } from './anim/Animator';
import { Rig, skinCharacter } from './anim/skeleton';
import { buildBody } from './body';
import { buildBoots } from './boots';
import { buildFace, type FacePart } from './face/Face';
import { buildHair } from './hair';
import { buildOutfit } from './outfit';
import { resetMaterials } from './lib/materials';
import { KID, type ExtraLook } from './looks';
import { applyLook } from './palette';
import type { Expression, Part } from './types';

export interface ExtraOptions {
  /** Deterministic posing for screenshots (no smoothing, walking stays in place). */
  instant?: boolean;
  /** Walk in place; the host moves `root` itself. */
  inPlace?: boolean;
  look?: ExtraLook;
}

/**
 * A background character built on the same body, face, rig and toon look as the main cast,
 * with only the basics: the hair, the clothes and the shoes chosen by its ExtraLook.
 */
export class Extra {
  readonly root = new THREE.Group();
  readonly rig = new Rig();
  private readonly parts: Part[];
  private readonly face: FacePart;
  private readonly animator: Animator;
  private expression: Expression = 'normal';
  private talking = false;

  constructor(opts: ExtraOptions = {}) {
    const look = opts.look ?? KID;
    this.root.name = `Extra:${look.id}`;
    applyLook(look.colors);
    resetMaterials();
    this.face = buildFace();
    this.parts = [buildBody(), this.face, buildHair(look), buildOutfit(look), buildBoots()];
    const parts = new THREE.Group();
    for (const part of this.parts) parts.add(part.object);
    this.root.add(parts);
    skinCharacter(this.root, this.rig);
    // Expression symbols (sprites) ride on the head bone.
    const effects = this.root.getObjectByName('faceEffects');
    if (effects) this.rig.bone('head').attach(effects);
    this.animator = new Animator(this.rig, this.rig.root, { instant: opts.instant, inPlace: opts.inPlace });
  }

  get currentExpression(): Expression {
    return this.expression;
  }

  setExpression(expr: Expression): void {
    this.expression = expr;
    this.face.setExpression(expr);
  }

  get walking(): boolean {
    return this.animator.walking;
  }

  setWalking(on: boolean): void {
    this.animator.walking = on;
  }

  get isTalking(): boolean {
    return this.talking;
  }

  setTalking(on: boolean): void {
    this.talking = on;
    this.animator.talking = on;
    this.face.setTalking(on);
  }

  playGesture(g: Gesture): void {
    this.animator.play(g);
  }

  update(time: number, delta: number): void {
    this.animator.update(time, delta);
    for (const part of this.parts) part.update?.(time, delta);
  }
}
