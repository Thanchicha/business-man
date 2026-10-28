import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { Cat, CAT_COATS } from '../three/models/character';
import { createCharacter, type Character } from '../three/models/miyu';
import type { CharSpec } from '../game/specs';
import { buildTown, type TownSet } from '../three/sets/town';

/** Adds an animated character to the stage. */
export function addChibi(stage: Stage, spec: CharSpec, x = 0, z = 0, yaw = 0): Character {
  const c = createCharacter(spec);
  c.root.position.set(x, 0, z);
  c.root.rotation.y = yaw;
  stage.add(c.root);
  stage.onUpdate((dt) => c.update(dt));
  return c;
}

export function addCat(stage: Stage, coat: number, x = 0, z = 0, yaw = 0): Cat {
  const [a, b] = CAT_COATS[coat % CAT_COATS.length];
  const c = new Cat(a, b);
  c.root.position.set(x, 0, z);
  c.root.rotation.y = yaw;
  stage.add(c.root);
  stage.onUpdate((dt) => c.update(dt));
  return c;
}

/** Walks a character to a point at a steady pace, facing where it goes. */
export async function walkTo(stage: Stage, c: { root: THREE.Object3D; walking: boolean }, x: number, z: number, speed = 2.4): Promise<void> {
  const p = c.root.position;
  const dist = Math.hypot(x - p.x, z - p.z);
  if (dist < 0.01) return;
  c.root.rotation.y = Math.atan2(x - p.x, z - p.z);
  c.walking = true;
  await stage.tween(p, { x, z }, (dist / speed) * 1000, (t) => t);
  c.walking = false;
}

/** The island town as a slowly orbiting background for menu screens. */
export function islandBackdrop(stage: Stage, o: { radius?: number; height?: number; speed?: number; look?: THREE.Vector3; orbit?: boolean } = {}): TownSet {
  const town = buildTown();
  stage.add(town.group);
  stage.onUpdate(town.update);
  let a = 0.6;
  const r = o.radius ?? 40;
  const hgt = o.height ?? 24;
  const look = o.look ?? new THREE.Vector3(0, 0, 0);
  if (o.orbit === false) return town;
  stage.onUpdate((dt) => {
    a += dt * (o.speed ?? 0.03);
    stage.engine.camera.position.set(Math.sin(a) * r, hgt, Math.cos(a) * r);
    stage.engine.look(look.x, look.y, look.z);
  });
  return town;
}
