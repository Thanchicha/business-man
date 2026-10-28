import * as THREE from 'three';
import { torsoCore } from '../body/bodyShape';
import { smax } from '../body/sdf';
import { meshSdf } from '../body/surfaceNets';
import { sweep, vec } from '../lib/geometry';
import { butterflySmooth } from '../lib/shapes';
import { trace } from '../lib/surface';
import { RIG } from '../rig';

/** Cloth offset of the blouse over the torso. */
const T = 0.0075;
export const BLOUSE_BOTTOM = 0.392;

/** Blouse solid: torso inflated by the cloth thickness, ending below the waist (tucked in). */
export function blouseSdf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  // Slightly looser over the tummy, a few soft folds.
  const fold = 0.0012 * Math.sin(ax * 140 + y * 30) * Math.max(0, Math.min(1, (0.5 - y) / 0.08));
  const d = torsoCore(ax, y, z) - T - fold;
  return smax(d, BLOUSE_BOTTOM - y, 0.004);
}

export function blouseGeometry(): THREE.BufferGeometry {
  return meshSdf(blouseSdf, { min: [-0.13, BLOUSE_BOTTOM - 0.01, -0.09], max: [0.13, 0.6, 0.09] }, 0.0032);
}

/** Front surface point of the blouse at (x, y). */
export function blouseFront(x: number, y: number, lift = 0): THREE.Vector3 {
  const p = trace(blouseSdf, vec(x, y, 0.3), vec(0, 0, -1), 0.5) ?? vec(x, y, 0.06);
  p.z += lift;
  return p;
}

/** Small white frill around the neckline. */
export function neckFrill(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = RIG.neckRadius + 0.009 + 0.0022 * Math.sin(a * 14);
    pts.push(vec(Math.sin(a) * r, 0.561 - 0.004 * Math.cos(a) + 0.0015 * Math.cos(a * 14), RIG.neckZ + Math.cos(a) * r * 1.02));
  }
  return sweep(pts, {
    closed: true,
    width: () => 0.009,
    thickness: () => 0.0022,
    // Tilt the ruffle outward like a little stand-up collar flaring open.
    normalRef: (p) => vec(p.x, 0, p.z - RIG.neckZ).normalize().add(vec(0, -0.6, 0)).normalize(),
    segments: n * 2,
    radial: 8,
    squareness: 3,
  });
}

/** Black butterfly print on the chest: canvas texture on a small curved patch. */
export function butterflyPrint(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d')!;
  const shape = butterflySmooth();
  const pts = shape.getPoints(12);
  g.translate(128, 128);
  g.scale(220, -220);
  g.fillStyle = '#1d1c22';
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
  g.fill();
  // Wing veins in white.
  g.strokeStyle = 'rgba(247,246,248,0.8)';
  g.lineWidth = 0.012;
  for (const s of [-1, 1]) {
    for (const [x, y] of [[0.3, 0.32], [0.38, 0.15], [0.28, -0.25]]) {
      g.beginPath();
      g.moveTo(0, 0.02);
      g.quadraticCurveTo(s * x * 0.5, y * 0.8, s * x, y);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  // Patch conforming to the blouse front.
  const size = 0.045, cy = 0.488, n = 12;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = (i / n - 0.5) * size, y = cy + (j / n - 0.5) * size;
      const p = blouseFront(x, y, 0.0008);
      pos.push(p.x, p.y, p.z);
      uv.push(i / n, j / n);
    }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i;
    idx.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.name = 'butterflyPrint';
  mesh.renderOrder = 1;
  return mesh;
}
