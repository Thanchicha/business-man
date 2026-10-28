import type * as THREE from 'three';

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * Geometry that is identical in every look (the head, the body, the hair cap and bangs) is meshed
 * once; skinning copies it per model, so sharing the source is safe.
 */
export function memoGeometry(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = build()));
  return g;
}
