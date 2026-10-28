import * as THREE from 'three';
import { createCharacter, type Character } from './models/miyu';
import type { CharSpec, Expr } from '../game/specs';

/**
 * Renders head-and-shoulders portraits of the 3D characters into images,
 * used by dialogue boxes and the advisor card. Results are cached.
 */
let renderer: THREE.WebGLRenderer | null = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
const cache = new Map<string, string>();
const models = new Map<string, Character>();

function setup(): void {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 256);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.HemisphereLight('#fff6fa', '#e0b8c8', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(1.5, 2, 3);
  scene.add(key);
  camera.position.set(0.35, 1.2, 2.6);
  camera.lookAt(0, 1.02, 0);
}

/** Renders any small object (e.g. a drink) into a cached image. */
export function snapshot(id: string, build: () => THREE.Object3D, look = new THREE.Vector3(0, 0.2, 0), dist = 1.1): string {
  const hit = cache.get(id);
  if (hit) return hit;
  if (!renderer) setup();
  const obj = build();
  scene.add(obj);
  const pos = camera.position.clone();
  camera.position.set(look.x + dist * 0.25, look.y + dist * 0.35, look.z + dist);
  camera.lookAt(look);
  renderer!.render(scene, camera);
  const url = renderer!.domElement.toDataURL('image/png');
  scene.remove(obj);
  camera.position.copy(pos);
  camera.lookAt(0, 1.02, 0);
  cache.set(id, url);
  return url;
}

export function portrait(key: string, spec: CharSpec, expr: Expr = 'normal'): string {
  const id = `${key}|${expr}`;
  const hit = cache.get(id);
  if (hit) return hit;
  if (!renderer) setup();
  let m = models.get(key);
  if (!m) {
    m = createCharacter(spec);
    m.root.rotation.y = 0.12;
    models.set(key, m);
  }
  scene.add(m.root);
  m.setExpr(expr);
  renderer!.render(scene, camera);
  const url = renderer!.domElement.toDataURL('image/png');
  scene.remove(m.root);
  cache.set(id, url);
  return url;
}
