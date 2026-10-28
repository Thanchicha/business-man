"""Small procedural mesh toolkit and GLB writer (numpy only).

Every shape is a Mesh with per-vertex colours. Nodes form a hierarchy with
names, so the game can animate limbs and switch facial expressions.
"""
from __future__ import annotations

import json
import math
import struct
from dataclasses import dataclass, field

import numpy as np


# ---------------------------------------------------------------- colours

def srgb(hex_color: str, alpha: float = 1.0) -> np.ndarray:
    """Hex sRGB colour -> linear RGBA, as glTF vertex colours are linear."""
    h = hex_color.lstrip('#')
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return np.array([*lin, alpha], dtype=np.float32)


def lerp_color(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    return a + (b - a) * t


# ---------------------------------------------------------------- matrices

def rot_x(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_z(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def look_basis(forward: np.ndarray, up_hint=(0.0, 1.0, 0.0)) -> np.ndarray:
    """Rotation whose +Z points along `forward` (columns are the new X, Y, Z)."""
    z = forward / np.linalg.norm(forward)
    x = np.cross(np.array(up_hint, dtype=float), z)
    if np.linalg.norm(x) < 1e-6:
        x = np.array([1.0, 0, 0])
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    return np.stack([x, y, z], axis=1)


def quat_from_matrix(m: np.ndarray) -> list[float]:
    t = np.trace(m)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2
        return [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s]
    i = int(np.argmax(np.diag(m)))
    j, k = (i + 1) % 3, (i + 2) % 3
    s = math.sqrt(1.0 + m[i, i] - m[j, j] - m[k, k]) * 2
    q = [0.0, 0.0, 0.0, 0.0]
    q[i] = 0.25 * s
    q[j] = (m[j, i] + m[i, j]) / s
    q[k] = (m[k, i] + m[i, k]) / s
    q[3] = (m[k, j] - m[j, k]) / s
    return q


# ---------------------------------------------------------------- mesh

@dataclass
class Mesh:
    pos: np.ndarray
    idx: np.ndarray
    col: np.ndarray
    material: str = 'opaque'  # 'opaque' | 'double' | 'blend'
    nrm: np.ndarray | None = None

    def copy(self) -> 'Mesh':
        return Mesh(self.pos.copy(), self.idx.copy(), self.col.copy(), self.material, None if self.nrm is None else self.nrm.copy())

    def transform(self, m: np.ndarray | None = None, t=(0, 0, 0), s=(1, 1, 1)) -> 'Mesh':
        p = self.pos * np.array(s, dtype=float)
        if m is not None:
            p = p @ np.asarray(m).T
        self.pos = p + np.array(t, dtype=float)
        self.nrm = None
        return self

    def normals(self) -> np.ndarray:
        if self.nrm is not None:
            return self.nrm
        n = np.zeros_like(self.pos)
        tri = self.idx.reshape(-1, 3)
        a, b, c = self.pos[tri[:, 0]], self.pos[tri[:, 1]], self.pos[tri[:, 2]]
        fn = np.cross(b - a, c - a)
        for k in range(3):
            np.add.at(n, tri[:, k], fn)
        ln = np.linalg.norm(n, axis=1, keepdims=True)
        ln[ln == 0] = 1
        n = n / ln
        # closed shapes should have normals pointing away from their centre
        out = self.pos - self.pos.mean(axis=0)
        score = float(np.mean(np.sum(n * out, axis=1)))
        if score < -1e-5:
            n = -n
            self.idx = self.idx.reshape(-1, 3)[:, ::-1].reshape(-1).copy()
        self.nrm = n
        return self.nrm


def merge(meshes: list[Mesh]) -> Mesh:
    pos, idx, col, off = [], [], [], 0
    for m in meshes:
        pos.append(m.pos)
        idx.append(m.idx + off)
        col.append(m.col)
        off += len(m.pos)
    return Mesh(np.vstack(pos), np.concatenate(idx), np.vstack(col), meshes[0].material)


def _grid_indices(rows: int, cols: int, wrap: bool) -> np.ndarray:
    """Quads between rows of `cols` vertices; if wrap, the last column joins the first."""
    out = []
    cw = cols if wrap else cols - 1
    for r in range(rows - 1):
        for c in range(cw):
            a = r * cols + c
            b = r * cols + (c + 1) % cols
            d = (r + 1) * cols + c
            e = (r + 1) * cols + (c + 1) % cols
            out += [a, d, b, b, d, e]
    return np.array(out, dtype=np.uint32)


def _colors(n: int, color) -> np.ndarray:
    c = np.asarray(color, dtype=np.float32)
    return np.tile(c, (n, 1)) if c.ndim == 1 else c


# ---------------------------------------------------------------- primitives

def ellipsoid(radii, color, segs=32, rings=20, center=(0, 0, 0), deform=None, color_fn=None, material='opaque') -> Mesh:
    """UV sphere scaled to radii. deform(p, n) may move points; color_fn(p) may colour them."""
    pts, cols = [], []
    for i in range(rings + 1):
        v = i / rings
        th = math.pi * v
        for j in range(segs):
            ph = 2 * math.pi * j / segs
            n = np.array([math.sin(th) * math.sin(ph), math.cos(th), math.sin(th) * math.cos(ph)])
            p = n * np.array(radii, dtype=float)
            if deform:
                p = deform(p, n)
            pts.append(p)
            cols.append(color_fn(p) if color_fn else color)
    m = Mesh(np.array(pts) + np.array(center, dtype=float), _grid_indices(rings + 1, segs, True), np.array(cols, dtype=np.float32), material)
    return m


def superellipsoid(radii, color, e=0.3, segs=28, rings=18, center=(0, 0, 0)) -> Mesh:
    """Rounded box: e near 0 is boxy, 1 is a sphere."""
    def sgnpow(x, k):
        return np.sign(x) * np.abs(x) ** k

    pts = []
    for i in range(rings + 1):
        th = -math.pi / 2 + math.pi * i / rings
        for j in range(segs):
            ph = -math.pi + 2 * math.pi * j / segs
            x = sgnpow(math.cos(th), e) * sgnpow(math.sin(ph), e)
            y = sgnpow(math.sin(th), e)
            z = sgnpow(math.cos(th), e) * sgnpow(math.cos(ph), e)
            pts.append([x * radii[0], y * radii[1], z * radii[2]])
    return Mesh(np.array(pts) + np.array(center, dtype=float), _grid_indices(rings + 1, segs, True), _colors((rings + 1) * segs, color))


def lathe(profile, color, segs=36, rmod=None, color_fn=None, material='opaque', cap_top=False, cap_bottom=False) -> Mesh:
    """Revolve a list of (radius, y) around Y. rmod(theta, k) scales the radius per angle."""
    pts, cols = [], []
    for k, (r, y) in enumerate(profile):
        for j in range(segs):
            th = 2 * math.pi * j / segs
            rr = r * (rmod(th, k) if rmod else 1)
            p = [rr * math.sin(th), y, rr * math.cos(th)]
            pts.append(p)
            cols.append(color_fn(th, k) if color_fn else color)
    idx = list(_grid_indices(len(profile), segs, True))
    pts_a = np.array(pts, dtype=float)
    cols_a = np.array(cols, dtype=np.float32)
    for cap, row in ((cap_bottom, 0), (cap_top, len(profile) - 1)):
        if not cap:
            continue
        ci = len(pts_a)
        pts_a = np.vstack([pts_a, [[0, profile[row][1], 0]]])
        cols_a = np.vstack([cols_a, cols_a[row * segs]])
        for j in range(segs):
            a, b = row * segs + j, row * segs + (j + 1) % segs
            idx += [ci, a, b] if row == 0 else [ci, b, a]
    return Mesh(pts_a, np.array(idx, dtype=np.uint32), cols_a, material)


def frames(points: np.ndarray):
    """Parallel-transport frames along a polyline: tangents, normals, binormals."""
    t = np.gradient(points, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    n = np.zeros_like(t)
    ref = np.array([0.0, 0.0, 1.0]) if abs(t[0][1]) > 0.9 else np.array([0.0, 1.0, 0.0])
    n[0] = np.cross(t[0], ref)
    n[0] /= np.linalg.norm(n[0])
    for i in range(1, len(points)):
        v = np.cross(t[i - 1], t[i])
        if np.linalg.norm(v) < 1e-8:
            n[i] = n[i - 1]
        else:
            ang = math.acos(max(-1, min(1, float(np.dot(t[i - 1], t[i])))))
            v /= np.linalg.norm(v)
            k = v
            nn = n[i - 1]
            n[i] = nn * math.cos(ang) + np.cross(k, nn) * math.sin(ang) + k * np.dot(k, nn) * (1 - math.cos(ang))
    b = np.cross(t, n)
    return t, n, b


def tube(points, radius, color, segs=12, flat=1.0, up=None, color_fn=None, cap=True, material='opaque') -> Mesh:
    """Tube along a polyline. radius may be a function of t in [0, 1].
    flat < 1 squashes the cross section (ribbon / hair strand); `up` orients the flat side."""
    P = np.asarray(points, dtype=float)
    T, N, B = frames(P)
    if up is not None:
        u = np.asarray(up, dtype=float)
        for i in range(len(P)):
            n = u - T[i] * np.dot(u, T[i])
            if np.linalg.norm(n) > 1e-6:
                N[i] = n / np.linalg.norm(n)
                B[i] = np.cross(T[i], N[i])
    pts, cols = [], []
    L = len(P)
    for i in range(L):
        t = i / (L - 1)
        r = radius(t) if callable(radius) else radius
        for j in range(segs):
            a = 2 * math.pi * j / segs
            pts.append(P[i] + B[i] * math.cos(a) * r + N[i] * math.sin(a) * r * flat)
            cols.append(color_fn(t) if color_fn else color)
    idx = list(_grid_indices(L, segs, True))
    pts_a = np.array(pts)
    cols_a = np.array(cols, dtype=np.float32)
    if cap:
        for row, pnt in ((0, P[0]), (L - 1, P[-1])):
            ci = len(pts_a)
            pts_a = np.vstack([pts_a, [pnt]])
            cols_a = np.vstack([cols_a, cols_a[row * segs]])
            for j in range(segs):
                a, b = row * segs + j, row * segs + (j + 1) % segs
                idx += [ci, b, a] if row == 0 else [ci, a, b]
    return Mesh(pts_a, np.array(idx, dtype=np.uint32), cols_a, material)


def torus(R, r, color, segs=32, tube_segs=12, arc=2 * math.pi) -> Mesh:
    """Torus in the XZ plane (ring lying flat)."""
    n = segs + (0 if arc >= 2 * math.pi else 1)
    pts = [[(R * math.cos(arc * i / segs)), 0, (R * math.sin(arc * i / segs))] for i in range(n)]
    closed = arc >= 2 * math.pi
    if closed:
        pts.append(pts[0])
    return tube(np.array(pts), r, color, segs=tube_segs, cap=not closed)


def disc(rx, ry, color, segs=32, dome=0.0, material='opaque', color_fn=None) -> Mesh:
    """Ellipse facing +Z, optionally domed outwards."""
    pts = [[0, 0, dome]]
    cols = [color_fn(0, 0) if color_fn else color]
    for j in range(segs):
        a = 2 * math.pi * j / segs
        x, y = math.cos(a) * rx, math.sin(a) * ry
        pts.append([x, y, 0])
        cols.append(color_fn(x / rx, y / ry) if color_fn else color)
    idx = []
    for j in range(segs):
        idx += [0, 1 + j, 1 + (j + 1) % segs]
    return Mesh(np.array(pts, dtype=float), np.array(idx, dtype=np.uint32), np.array(cols, dtype=np.float32), material)


def extrude(poly2d, depth, color) -> Mesh:
    """Extrude a convex-ish 2D polygon (XY) along Z, centred on z=0. Triangle-fan caps."""
    P = np.asarray(poly2d, dtype=float)
    n = len(P)
    c = P.mean(axis=0)
    front = np.c_[P, np.full(n, depth / 2)]
    back = np.c_[P, np.full(n, -depth / 2)]
    pts = np.vstack([front, back, [[*c, depth / 2]], [[*c, -depth / 2]]])
    idx = []
    for i in range(n):
        j = (i + 1) % n
        idx += [i, j, n + i, j, n + j, n + i]
        idx += [2 * n, i, j]
        idx += [2 * n + 1, n + j, n + i]
    return Mesh(pts, np.array(idx, dtype=np.uint32), _colors(len(pts), color))


def heart(size, depth, color) -> Mesh:
    pts = []
    for k in range(40):
        t = 2 * math.pi * k / 40
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append([x / 17 * size, y / 17 * size])
    return extrude(pts[::-1], depth, color)


def bezier(ctrl, n=24) -> np.ndarray:
    """Catmull-Rom-ish smooth curve through control points (quadratic B-spline sampling)."""
    C = np.asarray(ctrl, dtype=float)
    if len(C) == 2:
        return np.linspace(C[0], C[1], n)
    out = []
    segs = len(C) - 1
    for i in range(n):
        u = i / (n - 1) * segs
        k = min(int(u), segs - 1)
        t = u - k
        p0 = C[max(k - 1, 0)]
        p1, p2 = C[k], C[k + 1]
        p3 = C[min(k + 2, len(C) - 1)]
        t2, t3 = t * t, t * t * t
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


# ---------------------------------------------------------------- scene + GLB

@dataclass
class Node:
    name: str
    meshes: list[Mesh] = field(default_factory=list)
    children: list['Node'] = field(default_factory=list)
    translation: tuple = (0, 0, 0)
    rotation: list | None = None
    scale: tuple | None = None

    def add(self, *items):
        for it in items:
            if isinstance(it, Node):
                self.children.append(it)
            else:
                self.meshes.append(it)
        return self


MATERIALS = {
    'opaque': {'name': 'toon', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.72}},
    'double': {'name': 'cloth', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.8}},
    'blend': {'name': 'blush', 'alphaMode': 'BLEND', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.9}},
    'gloss': {'name': 'gloss', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.1, 'roughnessFactor': 0.25}},
}


def write_glb(root: Node, path: str) -> dict:
    gltf = {'asset': {'version': '2.0', 'generator': 'miyu meshkit'}, 'scenes': [{'nodes': [0]}], 'scene': 0, 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'buffers': []}
    mat_names = list(MATERIALS)
    gltf['materials'] = [MATERIALS[k] for k in mat_names]
    blob = bytearray()
    stats = {'vertices': 0, 'triangles': 0, 'nodes': 0}

    def view(data: bytes, target: int) -> int:
        while len(blob) % 4:
            blob.append(0)
        gltf['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data), 'target': target})
        blob.extend(data)
        return len(gltf['bufferViews']) - 1

    def accessor(arr: np.ndarray, kind: str, comp: int, target: int, minmax=False) -> int:
        bv = view(arr.tobytes(), target)
        acc = {'bufferView': bv, 'componentType': comp, 'count': int(arr.shape[0]), 'type': kind}
        if minmax:
            acc['min'] = arr.min(axis=0).tolist()
            acc['max'] = arr.max(axis=0).tolist()
        gltf['accessors'].append(acc)
        return len(gltf['accessors']) - 1

    def visit(node: Node) -> int:
        i = len(gltf['nodes'])
        entry: dict = {'name': node.name}
        gltf['nodes'].append(entry)
        stats['nodes'] += 1
        if any(node.translation):
            entry['translation'] = [float(v) for v in node.translation]
        if node.scale:
            entry['scale'] = [float(v) for v in node.scale]
        if node.rotation:
            entry['rotation'] = [float(v) for v in node.rotation]
        if node.meshes:
            prims = []
            by_mat: dict[str, list[Mesh]] = {}
            for m in node.meshes:
                by_mat.setdefault(m.material, []).append(m)
            for mname, ms in by_mat.items():
                for m in ms:
                    m.normals()
                mm = merge(ms)
                nrm = np.vstack([m.normals() for m in ms]).astype(np.float32)
                pos = mm.pos.astype(np.float32)
                col = mm.col.astype(np.float32)
                ind = mm.idx.astype(np.uint32)
                stats['vertices'] += len(pos)
                stats['triangles'] += len(ind) // 3
                prims.append({
                    'attributes': {
                        'POSITION': accessor(pos, 'VEC3', 5126, 34962, True),
                        'NORMAL': accessor(nrm, 'VEC3', 5126, 34962),
                        'COLOR_0': accessor(col, 'VEC4', 5126, 34962),
                    },
                    'indices': accessor(ind, 'SCALAR', 5125, 34963),
                    'material': mat_names.index(mname),
                })
            gltf['meshes'].append({'name': node.name, 'primitives': prims})
            entry['mesh'] = len(gltf['meshes']) - 1
        kids = [visit(c) for c in node.children]
        if kids:
            entry['children'] = kids
        return i

    visit(root)
    while len(blob) % 4:
        blob.append(0)
    gltf['buffers'].append({'byteLength': len(blob)})
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack('<II', len(blob), 0x004E4942))
        f.write(bytes(blob))
    return stats
