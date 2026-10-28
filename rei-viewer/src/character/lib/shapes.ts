import * as THREE from 'three';
import { sweep, vec } from './geometry';

/**
 * Flat motif shapes (butterfly, cross, buckle frame) and band/strap builders.
 */

/** Butterfly outline (unit size ≈ 1 wide), centered, wings up. */
export function butterflyShape(): THREE.Shape {
  const s = new THREE.Shape();
  // Right half then mirrored: upper wing big, lower wing small.
  const half: [number, number][] = [
    [0.02, 0.05], [0.12, 0.3], [0.32, 0.45], [0.48, 0.4], [0.5, 0.22], [0.38, 0.06], [0.2, 0.0],
    [0.36, -0.08], [0.42, -0.25], [0.3, -0.38], [0.16, -0.32], [0.04, -0.12], [0.02, -0.2],
  ];
  s.moveTo(0, 0.1);
  for (const [x, y] of half) s.lineTo(x, y);
  s.lineTo(0, -0.22);
  for (let i = half.length - 1; i >= 0; i--) s.lineTo(-half[i][0], half[i][1]);
  s.closePath();
  return s;
}

/** Smooth version of the butterfly using quadratic curves through the polygon midpoints. */
export function smoothShape(points: THREE.Vector2[]): THREE.Shape {
  const s = new THREE.Shape();
  const n = points.length;
  const mid = (a: THREE.Vector2, b: THREE.Vector2) => a.clone().add(b).multiplyScalar(0.5);
  s.moveTo(mid(points[n - 1], points[0]).x, mid(points[n - 1], points[0]).y);
  for (let i = 0; i < n; i++) {
    const m = mid(points[i], points[(i + 1) % n]);
    s.quadraticCurveTo(points[i].x, points[i].y, m.x, m.y);
  }
  return s;
}

export function butterflySmooth(): THREE.Shape {
  return smoothShape(butterflyShape().getPoints(1));
}

/** Latin cross outline, unit height (−0.5..0.5). */
export function crossShape(armWidth = 0.22): THREE.Shape {
  const w = armWidth / 2;
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [-w, 0.5], [w, 0.5], [w, 0.22], [0.3, 0.22], [0.3, 0.22 - 2 * w], [w, 0.22 - 2 * w], [w, -0.5], [-w, -0.5],
    [-w, 0.22 - 2 * w], [-0.3, 0.22 - 2 * w], [-0.3, 0.22], [-w, 0.22],
  ];
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  return s;
}

/** Rectangular buckle frame (outer w×h, bar thickness t) with a center prong bar. */
export function buckleShape(w: number, h: number, t: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + t, -h / 2 + t);
  hole.lineTo(-w / 2 + t, h / 2 - t);
  hole.lineTo(w / 2 - t, h / 2 - t);
  hole.lineTo(w / 2 - t, -h / 2 + t);
  hole.closePath();
  s.holes.push(hole);
  return s;
}

/** Extrudes a flat shape (in XY) to depth d along +Z, centered on z, with a small bevel. */
export function extrude(shape: THREE.Shape, depth: number, scale = 1, bevel = depth * 0.3): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 2,
    curveSegments: 8,
  });
  g.translate(0, 0, -depth / 2 + bevel);
  g.scale(scale, scale, 1);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/**
 * Closed band around an ellipse (center, radii) — belts, straps around legs and sleeves.
 * `height` is the vertical width, `thick` the radial thickness.
 */
export function band(center: THREE.Vector3, rx: number, rz: number, height: number, thick: number, tilt = 0, segments = 48): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(vec(center.x + Math.sin(a) * rx, center.y + Math.sin(a) * tilt, center.z + Math.cos(a) * rz));
  }
  return sweep(pts, {
    closed: true,
    width: () => height,
    thickness: () => thick,
    normalRef: (p) => p.clone().sub(center).setY(0).normalize(),
    squareness: 6,
    segments,
    radial: 12,
  });
}

/** Flat strap (rounded-rectangle cross-section) through points, lying on a surface with normal fn. */
export function strap(points: THREE.Vector3[], width: number, thick: number, normal: (p: THREE.Vector3) => THREE.Vector3, segments = 32): THREE.BufferGeometry {
  return sweep(points, {
    width: () => width,
    thickness: () => thick,
    normalRef: normal,
    squareness: 6,
    segments,
    radial: 12,
    curveType: 'centripetal',
  });
}
