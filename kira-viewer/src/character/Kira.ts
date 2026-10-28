import * as THREE from 'three';
import { buildAccessories } from './accessories';
import { Animator, type Gesture } from './anim/Animator';
import { Rig, skinCharacter } from './anim/skeleton';
import { buildBag } from './bag';
import { buildBody } from './body';
import { buildBoots } from './boots';
import { buildFace, type FacePart } from './face/Face';
import { buildHair } from './hair';
import { buildHarness } from './harness';
import { buildOutfit } from './outfit';
import type { Expression, Part } from './types';

export interface KiraOptions {
  /** Deterministic posing for screenshots (no smoothing, walking stays in place). */
  instant?: boolean;
}

/** Assembles every part of Kira, rigs and skins it, and exposes the runtime controls. */
export class Kira {
  readonly root = new THREE.Group();
  readonly rig = new Rig();
  private readonly parts: Part[];
  private readonly face: FacePart;
  private readonly animator: Animator;
  private expression: Expression = 'normal';
  private talking = false;

  constructor(opts: KiraOptions = {}) {
    this.root.name = 'Kira';
    this.face = buildFace();
    this.parts = [buildBody(), this.face, buildHair(), buildOutfit(), buildHarness(), buildAccessories(), buildBoots(), buildBag()];
    const parts = new THREE.Group();
    for (const part of this.parts) parts.add(part.object);
    this.root.add(parts);
    skinCharacter(this.root, this.rig);
    // Expression symbols (sprites) ride on the head bone.
    const effects = this.root.getObjectByName('faceEffects');
    if (effects) this.rig.bone('head').attach(effects);
    this.animator = new Animator(this.rig, this.rig.root, { instant: opts.instant });
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

  /** Where she stands on the ground plane (moves while walking). */
  get groundPosition(): THREE.Vector3 {
    return this.rig.root.position;
  }

  update(time: number, delta: number): void {
    this.animator.update(time, delta);
    for (const part of this.parts) part.update?.(time, delta);
  }
}
