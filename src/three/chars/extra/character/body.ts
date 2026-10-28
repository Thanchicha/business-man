import * as THREE from 'three';
import { toonMaterial, toonMesh } from '../render/toon';
import { BODY_BOUNDS, bodySdf } from './body/bodyShape';
import { HEAD_BOUNDS, headSdf } from './body/headShape';
import { meshSdf } from './body/surfaceNets';
import { memoGeometry } from './lib/memo';
import { PALETTE } from './palette';
import type { Part } from './types';

export { bodySdf } from './body/bodyShape';
export { headFrontZ, headSdf, scalpSdf, skullSdf } from './body/headShape';

/** Mesh resolution (world units per cell). */
const HEAD_CELL = 0.0026;
const BODY_CELL = 0.0032;

/**
 * Base body: a seamless sculpted head (mesh 'head', no ears, clean flattened face front for
 * decals) and one seamless body mesh (mesh 'body': neck, torso, arms, mitten hands, legs, feet).
 * Both are extracted from signed-distance shapes driven by RIG landmarks.
 */
export function buildBody(): Part {
  const group = new THREE.Group();
  group.name = 'body';
  const skin = toonMaterial({ color: PALETTE.skin, shade: PALETTE.skinShade, threshold: 0.6, rim: 0.08 });

  const head = toonMesh(memoGeometry('head', () => meshSdf(headSdf, HEAD_BOUNDS, HEAD_CELL)), skin, { name: 'head', outline: 0.0026 });
  group.add(head);

  const body = toonMesh(memoGeometry('body', () => meshSdf(bodySdf, BODY_BOUNDS, BODY_CELL)), skin, { name: 'body', outline: 0.0024 });
  group.add(body);

  return { object: group };
}
