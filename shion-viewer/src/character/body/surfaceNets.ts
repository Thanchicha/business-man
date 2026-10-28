import * as THREE from 'three';
import { gradient, type Sdf } from './sdf';

export interface MeshBounds {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Naive Surface Nets isosurface extraction of an SDF, followed by projecting each vertex onto the
 * true surface (Newton steps along the gradient) and using the analytic-ish gradient as normal.
 * Produces a single watertight, smoothly shaded mesh with no part seams.
 */
export function meshSdf(f: Sdf, bounds: MeshBounds, cell: number): THREE.BufferGeometry {
  const [x0, y0, z0] = bounds.min;
  const nx = Math.ceil((bounds.max[0] - x0) / cell) + 1;
  const ny = Math.ceil((bounds.max[1] - y0) / cell) + 1;
  const nz = Math.ceil((bounds.max[2] - z0) / cell) + 1;
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  const field = sampleField(f, x0, y0, z0, nx, ny, nz, cell);

  // One vertex per sign-changing cell: average of the edge crossings.
  const cellVertex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cIdx = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const positions: number[] = [];
  const corner = new Float32Array(8);
  const CORNERS = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [di, dj, dk] = CORNERS[c];
          const v = field[idx(i + di, j + dj, k + dk)];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a], vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const ca = CORNERS[a], cb = CORNERS[b];
          sx += ca[0] + (cb[0] - ca[0]) * t;
          sy += ca[1] + (cb[1] - ca[1]) * t;
          sz += ca[2] + (cb[2] - ca[2]) * t;
          n++;
        }
        cellVertex[cIdx(i, j, k)] = positions.length / 3;
        positions.push(x0 + (i + sx / n) * cell, y0 + (j + sy / n) * cell, z0 + (k + sz / n) * cell);
      }
    }
  }

  // One quad per sign-changing grid edge, joining the four cells around it.
  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const inside = field[idx(i, j, k)] < 0;
        if (inside !== field[idx(i + 1, j, k)] < 0) {
          quad(cellVertex[cIdx(i, j - 1, k - 1)], cellVertex[cIdx(i, j, k - 1)], cellVertex[cIdx(i, j, k)], cellVertex[cIdx(i, j - 1, k)], !inside);
        }
        if (inside !== field[idx(i, j + 1, k)] < 0) {
          quad(cellVertex[cIdx(i - 1, j, k - 1)], cellVertex[cIdx(i - 1, j, k)], cellVertex[cIdx(i, j, k)], cellVertex[cIdx(i, j, k - 1)], !inside);
        }
        if (inside !== field[idx(i, j, k + 1)] < 0) {
          quad(cellVertex[cIdx(i - 1, j - 1, k)], cellVertex[cIdx(i, j - 1, k)], cellVertex[cIdx(i, j, k)], cellVertex[cIdx(i - 1, j, k)], !inside);
        }
      }
    }
  }
  // Winding is re-checked against the gradient in finalize(), so the flip flags only need to be consistent.
  return finalize(f, positions, indices, cell);
}

/**
 * Samples the SDF on the grid. Blocks of BLOCK³ cells whose center is provably far from the
 * surface (|d| > block half-diagonal) are filled with that value instead of being evaluated —
 * only the sign matters there.
 */
const BLOCK = 4;
function sampleField(f: Sdf, x0: number, y0: number, z0: number, nx: number, ny: number, nz: number, cell: number): Float32Array {
  const field = new Float32Array(nx * ny * nz);
  const reach = Math.sqrt(3) * (BLOCK / 2) * cell * 1.25;
  for (let bk = 0; bk < nz; bk += BLOCK) {
    for (let bj = 0; bj < ny; bj += BLOCK) {
      for (let bi = 0; bi < nx; bi += BLOCK) {
        const ie = Math.min(bi + BLOCK, nx - 1), je = Math.min(bj + BLOCK, ny - 1), ke = Math.min(bk + BLOCK, nz - 1);
        const center = f(x0 + ((bi + ie) / 2) * cell, y0 + ((bj + je) / 2) * cell, z0 + ((bk + ke) / 2) * cell);
        const far = Math.abs(center) > reach;
        for (let k = bk; k <= ke; k++) {
          const z = z0 + k * cell;
          for (let j = bj; j <= je; j++) {
            const y = y0 + j * cell;
            let o = bi + nx * (j + ny * k);
            for (let i = bi; i <= ie; i++) field[o++] = far ? center : f(x0 + i * cell, y, z);
          }
        }
      }
    }
  }
  return field;
}

/** Projects vertices onto the isosurface, computes gradient normals and orients triangles outward. */
function finalize(f: Sdf, positions: number[], indices: number[], cell: number): THREE.BufferGeometry {
  const g = [0, 0, 0];
  const vCount = positions.length / 3;
  const normals = new Float32Array(positions.length);
  const pos = new Float32Array(positions);
  for (let v = 0; v < vCount; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    for (let it = 0; it < 3; it++) {
      const d = f(x, y, z);
      gradient(f, x, y, z, g);
      const gl2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
      if (gl2 < 1e-12) break;
      const s = Math.max(-cell, Math.min(cell, d / gl2));
      x -= g[0] * s; y -= g[1] * s; z -= g[2] * s;
      if (Math.abs(d) < 1e-6) break;
    }
    gradient(f, x, y, z, g, cell * 0.25);
    const len = Math.hypot(g[0], g[1], g[2]) || 1;
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    normals[v * 3] = g[0] / len; normals[v * 3 + 1] = g[1] / len; normals[v * 3 + 2] = g[2] / len;
  }

  // Orient each triangle so its face normal agrees with the averaged vertex normals.
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const abx = pos[b * 3] - pos[a * 3], aby = pos[b * 3 + 1] - pos[a * 3 + 1], abz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const acx = pos[c * 3] - pos[a * 3], acy = pos[c * 3 + 1] - pos[a * 3 + 1], acz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const fx = aby * acz - abz * acy, fy = abz * acx - abx * acz, fz = abx * acy - aby * acx;
    const nx = normals[a * 3] + normals[b * 3] + normals[c * 3];
    const ny = normals[a * 3 + 1] + normals[b * 3 + 1] + normals[c * 3 + 1];
    const nz = normals[a * 3 + 2] + normals[b * 3 + 2] + normals[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz < 0) {
      indices[t + 1] = c;
      indices[t + 2] = b;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(vCount > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}
