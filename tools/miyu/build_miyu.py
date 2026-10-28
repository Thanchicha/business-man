"""Builds MIYU, the pink cat-ear advisor, as a detailed low-poly-but-smooth 3D model.

Run:  tools/.venv/Scripts/python.exe tools/miyu/build_miyu.py
Out:  public/models/miyu.glb

Units match the game's chibi characters: feet at y=0, facing +Z, head centre ~1.11.
Named nodes the game uses: body, legL, legR, armL, armR, tail, head, expr_<name>.
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from meshkit import (Mesh, Node, _colors, _grid_indices, bezier, disc, ellipsoid, heart, lathe, lerp_color, look_basis,
                     quat_from_matrix, rot_x, rot_y, rot_z, srgb, superellipsoid, torus, tube, write_glb)

# ---------------------------------------------------------------- palette (from the character sheet)
HAIR = srgb('#f8b6d0')
HAIR_LIGHT = srgb('#ffd6e6')
HAIR_SHADE = srgb('#e98db5')
SKIN = srgb('#ffe7dd')
BLUSH = srgb('#ff8fb2', 0.5)
BLUSH_LINE = srgb('#f2789f')
IRIS_TOP = srgb('#8a2853')
IRIS_BOTTOM = srgb('#ff9cc6')
PUPIL = srgb('#4a1430')
LASH = srgb('#3a2030')
WHITE = srgb('#ffffff')
MOUTH = srgb('#b0405e')
MOUTH_IN = srgb('#8a2f45')
TONGUE = srgb('#ff8fa8')
SWEATER = srgb('#fbf3f7')
SWEATER_SHADE = srgb('#ece0e7')
SKIRT = srgb('#ffb2cf')
SKIRT_SHADE = srgb('#f08fb6')
SKIRT_HEM = srgb('#ffd3e3')
BELT = srgb('#ff8fbd')
HEART = srgb('#ff6fa8')
SOCK = srgb('#fffafc')
BOOT = srgb('#f6e6ee')
BOOT_CUFF = srgb('#ffd3e3')
SOLE = srgb('#e98bb0')
SOLE_LIGHT = srgb('#f9bfd5')
LACE = srgb('#ff9cc4')
BOW = srgb('#ff92c4')
BOW_SHADE = srgb('#f070a8')
COLLAR = srgb('#2a2228')
GOLD = srgb('#f0c050')
GOLD_DARK = srgb('#b8862a')
EAR_INNER = srgb('#ff9cc0')
SKIRT_LIGHT = srgb('#ffdbe9')
SAILOR = srgb('#ff9cc4')
FRILL = srgb('#fffafd')
LOWER_LASH = srgb('#c0587e')

R = 0.43  # head radius
C = np.array([0.0, 0.25, 0.0])  # head centre in head-node space


def sph(ax: float, ay: float, r: float = R) -> np.ndarray:
    """Point on a sphere around the head centre. ax: around (0 = front), ay: up/down."""
    return C + r * np.array([math.sin(ax) * math.cos(ay), math.sin(ay), math.cos(ax) * math.cos(ay)])


def outward(ax: float, ay: float) -> np.ndarray:
    return np.array([math.sin(ax) * math.cos(ay), math.sin(ay), math.cos(ax) * math.cos(ay)])


def on_face(m: Mesh, ax: float, ay: float, out: float = 0.0) -> Mesh:
    """Stick a +Z-facing feature onto the head surface."""
    return m.transform(look_basis(outward(ax, ay)), t=sph(ax, ay, R + out))


def patch(radii, th0, th1, ph0, ph1, color_fn, segs=24, rings=14, center=(0, 0, 0)) -> Mesh:
    """Part of an ellipsoid (open), e.g. the back of the hair."""
    pts, cols = [], []
    for i in range(rings + 1):
        th = th0 + (th1 - th0) * i / rings
        for j in range(segs + 1):
            ph = ph0 + (ph1 - ph0) * j / segs
            n = np.array([math.sin(th) * math.sin(ph), math.cos(th), math.sin(th) * math.cos(ph)])
            p = n * np.array(radii) + np.array(center)
            pts.append(p)
            cols.append(color_fn(i / rings))
    return Mesh(np.array(pts), _grid_indices(rings + 1, segs + 1, False), np.array(cols, dtype=np.float32))


# ---------------------------------------------------------------- hair

def strand(ctrl, width, color=HAIR, tip=HAIR_LIGHT, flat=0.4, n=18) -> Mesh:
    pts = bezier(ctrl, n)
    radial = pts.mean(axis=0) - C
    return tube(pts, lambda t: width * (1 - t) ** 0.75 + 0.004, color, segs=8, flat=flat, up=radial,
                color_fn=lambda t: lerp_color(color, tip, t * 0.8))


def build_hair() -> list[Mesh]:
    parts: list[Mesh] = []
    # base volume: a cap tilted back so the forehead shows, plus the round back of a bob
    cap = lathe([(R * 1.055 * math.sin(t), R * 1.055 * math.cos(t)) for t in np.linspace(0.001, math.pi * 0.6, 16)], HAIR, segs=40,
                color_fn=lambda th, k: lerp_color(HAIR_LIGHT, HAIR, min(1, k / 9)))
    parts.append(cap.transform(rot_x(-0.5), t=C))
    parts.append(patch((R * 1.06, R * 1.04, R * 1.06), 0.05, math.pi * 0.84, math.pi / 2, math.pi * 1.5,
                       lambda v: lerp_color(HAIR, HAIR_SHADE, v), center=C + np.array([0, -0.02, -0.01])))

    rng = np.random.default_rng(7)

    def tint(base=HAIR):
        """Gentle per-strand variation instead of hard stripes."""
        return lerp_color(base, HAIR_SHADE, float(rng.uniform(0, 0.35)))

    # fringe: thin locks from the crown, a point between the eyes, longer at the sides.
    # Variation is drawn once per pair and mirrored, so the face reads symmetric.
    pair = [(rng.uniform(-0.03, 0.02), rng.uniform(-0.04, 0.04), 0.055 + rng.uniform(0, 0.015)) for _ in range(9)]
    for i in range(17):
        ax = -0.95 + i * 0.119
        side = abs(ax)
        jitter, wobble, width = pair[abs(i - 8)]
        tip_ay = 0.12 if side < 0.1 else 0.14 - side * 0.1 + jitter * 0.5  # fringe ends just above the eyes
        curl = np.sign(ax) * (wobble + 0.08 * side)
        parts.append(strand([sph(ax * 0.3, 1.1, R * 1.055), sph(ax * 0.75, 0.7, R * 1.1), sph(ax * 0.95, 0.4, R * 1.1), sph(ax + curl, tip_ay, R * 1.07)],
                            width, tint(HAIR_LIGHT if abs(i - 8) % 4 == 0 else HAIR), flat=0.35))
    # long side locks in front of the ears, curving in along the jaw so the face looks slimmer
    cheek = [(rng.uniform(0, 0.05), tint()) for _ in range(3)]
    for s in (-1, 1):
        for k in range(3):
            ax = s * (0.6 + 0.1 * k)
            drop, col = cheek[k]
            end = -0.7 - drop - 0.06 * (2 - k)
            parts.append(strand([sph(ax * 0.55, 0.95, R * 1.06), sph(ax * 0.95, 0.45, R * 1.1), sph(ax, 0.0, R * 1.11), sph(ax * 0.97, end + 0.25, R * 1.1),
                                 sph(ax * 0.9, end, R * 1.1)], 0.085, col, HAIR_LIGHT, flat=0.3))
    # outer side locks over the ears, flicking out a little at the ends
    outer = [(rng.uniform(0, 0.12), tint()) for _ in range(5)]
    for s in (-1, 1):
        for k in range(5):
            ax = s * (0.92 + 0.12 * k)
            drop, col = outer[k]
            end = -0.55 - drop
            parts.append(strand([sph(ax * 0.8, 0.8, R * 1.06), sph(ax, 0.2, R * 1.1), sph(ax * 1.02, end + 0.15, R * 1.12), sph(ax * 1.05, end, R * 1.2),
                                 sph(ax * 1.08, end + 0.06, R * 1.28)], 0.06, col, flat=0.35))
    # back of the bob in two layers: long underneath, shorter on top
    for layer, (count, end, w, rad) in enumerate([(20, -0.62, 0.07, 1.1), (16, -0.32, 0.075, 1.15)]):
        for j in range(count):
            ax = 1.55 + (2 * math.pi - 3.1) * (j + rng.uniform(-0.3, 0.3)) / (count - 1)
            e = end + rng.uniform(-0.06, 0.06)
            parts.append(strand([sph(ax, 0.95, R * 1.05), sph(ax, 0.3, R * rad), sph(ax, e + 0.12, R * (rad + 0.03)),
                                 sph(ax + rng.uniform(-0.1, 0.1), e, R * (rad + 0.08)), sph(ax + rng.uniform(-0.12, 0.12), e + 0.025, R * (rad + 0.12))],
                                w, tint(HAIR if layer else HAIR_SHADE), flat=0.32))
    # a few loose flyaways on top
    for ax in (0.4, 2.0, 3.6, 5.1):
        parts.append(strand([sph(ax, 1.3, R * 1.05), sph(ax, 1.0, R * 1.12), sph(ax + 0.2, 0.82, R * 1.14)], 0.04, HAIR_LIGHT, HAIR, flat=0.35))
    # ahoge: two curly strands on top
    top = C + np.array([0, R * 1.04, 0])
    for s in (1, -0.6):
        parts.append(strand([top, top + [0.02 * s, 0.1, 0.02], top + [0.09 * s, 0.17, 0.05], top + [0.15 * s, 0.13, 0.08], top + [0.13 * s, 0.07, 0.07]],
                            0.022, HAIR, HAIR_LIGHT, flat=0.7))
    return parts


def hair_shine(color, ay=0.6, rad=1.135, span=2.1) -> list[Mesh]:
    """Anime "angel ring": short glossy dashes across the crown, following the head's curve."""
    parts = []
    ax = -span
    while ax < span:
        seg = [sph(a, ay + 0.04 * math.cos(a * 2.3), R * rad) for a in np.linspace(ax, ax + 0.24, 6)]
        parts.append(tube(np.array(seg), lambda t: 0.012 * math.sin(math.pi * t) + 0.002, color, segs=5, flat=0.35))
        ax += 0.34
    return parts


def build_ears() -> list[Node]:
    """Each ear is its own node pivoting at its base, so the game can make them twitch."""
    nodes = []
    for s in (-1, 1):
        parts = []
        ear = lathe([(0.135, 0), (0.125, 0.08), (0.095, 0.16), (0.055, 0.23), (0.018, 0.28), (0.0, 0.29)], HAIR, segs=24, cap_bottom=True,
                    color_fn=lambda th, k: lerp_color(HAIR, HAIR_LIGHT, k / 6))
        ear.transform(s=(1, 1, 0.5))
        inner = lathe([(0.085, 0.02), (0.075, 0.09), (0.05, 0.16), (0.015, 0.22), (0, 0.23)], EAR_INNER, segs=20, cap_bottom=True).transform(
            s=(1, 1, 0.25), t=(0, 0, 0.042))
        fluff = [tube(bezier([[dx, 0.02, 0.05], [dx * 1.4, 0.09, 0.06], [dx * 0.6, 0.15, 0.055]], 10), lambda t: 0.012 * (1 - t) + 0.002, WHITE, segs=6)
                 for dx in (-0.03, 0.0, 0.03)]
        rot = rot_z(-s * 0.42) @ rot_x(-0.12)
        base = sph(s * 0.6, 0.98, R * 0.97)
        for m in [ear, inner, *fluff]:
            parts.append(m.transform(rot))
        nodes.append(Node('earL' if s < 0 else 'earR', translation=tuple(float(v) for v in base)).add(*parts))
    return nodes


def cat_face_bow(scale=1.0) -> list[Mesh]:
    """Pink ribbon with a little white cat face in the middle (hair clip / tail bow)."""
    parts = []
    for s in (-1, 1):
        lobe = ellipsoid((0.075, 0.048, 0.03), BOW, segs=18, rings=10,
                         color_fn=lambda p: lerp_color(BOW, BOW_SHADE, max(0, -p[1] / 0.05) * 0.6))
        parts.append(lobe.transform(rot_z(s * 0.35), t=(s * 0.07, 0, 0)))
        tail_r = tube(bezier([[s * 0.02, -0.01, 0], [s * 0.04, -0.06, 0.005], [s * 0.06, -0.1, 0]], 8), 0.014, BOW_SHADE, segs=6, flat=0.4)
        parts.append(tail_r)
    parts.append(ellipsoid((0.038, 0.032, 0.03), WHITE, segs=16, rings=10, center=(0, 0, 0.018)))
    for s in (-1, 1):
        parts.append(lathe([(0.014, 0), (0.0, 0.025)], WHITE, segs=8, cap_bottom=True).transform(rot_z(-s * 0.4), t=(s * 0.022, 0.02, 0.02)))
        parts.append(ellipsoid((0.005, 0.006, 0.003), LASH, segs=8, rings=5, center=(s * 0.013, 0.003, 0.047)))
    parts.append(ellipsoid((0.004, 0.003, 0.003), HEART, segs=8, rings=5, center=(0, -0.008, 0.048)))
    for m in parts:
        m.transform(s=(scale, scale, scale))
    return parts


def cat_clip(scale=1.0) -> list[Mesh]:
    """Just the little white cat face from the bow, worn as a hair clip."""
    return cat_face_bow(scale)[4:]


def ribbon_bow(scale=1.0, heart_center=False, tails=0.1) -> list[Mesh]:
    """Plain pink ribbon bow facing +Z: two loops, a knot and two tails."""
    parts = []
    for s in (-1, 1):
        lobe = ellipsoid((0.075, 0.05, 0.028), BOW, segs=18, rings=10,
                         color_fn=lambda p: lerp_color(BOW, BOW_SHADE, max(0, -p[1] / 0.05) * 0.6))
        parts.append(lobe.transform(rot_z(s * 0.3), t=(s * 0.068, 0.004, 0)))
        # inner fold line so the loops read as ribbon, not balls
        parts.append(tube(bezier([[s * 0.03, 0.0, 0.026], [s * 0.07, 0.012, 0.03], [s * 0.11, 0.02, 0.022]], 8), 0.004, BOW_SHADE, segs=5))
        parts.append(tube(bezier([[s * 0.015, -0.01, 0.0], [s * 0.035, -tails * 0.5, 0.008], [s * 0.05, -tails, 0.0]], 8),
                          lambda t: 0.016 - 0.004 * t, BOW_SHADE, segs=6, flat=0.35))
    if heart_center:
        parts.append(heart(0.042, 0.024, HEART).transform(t=(0, 0.004, 0.022)))
    else:
        parts.append(ellipsoid((0.026, 0.028, 0.024), BOW_SHADE, segs=12, rings=8, center=(0, 0, 0.012)))
    for m in parts:
        m.transform(s=(scale, scale, scale))
    return parts


def x_clip(scale=1.0) -> list[Mesh]:
    """Two crossed pink hair pins (the "×" on her fringe)."""
    return [tube(np.array([[-0.035, -0.035 * k, 0], [0.035, 0.035 * k, 0]]), 0.009, BOW_SHADE, segs=6).transform(s=(scale, scale, scale))
            for k in (-1, 1)]


# ---------------------------------------------------------------- face & expressions

def eye_open(side: int, big=1.0, lid=1.0, iris=None, sparkle='heart', lower=None, boy=False) -> list[Mesh]:
    """iris = (top, bottom, pupil) colours; MIYU's pink by default. sparkle: 'heart' or 'dot'."""
    big *= EYE
    top_c, bottom_c, pupil_c = iris or (IRIS_TOP, IRIS_BOTTOM, PUPIL)
    parts = [
        # big anime iris: dark at the top, glowing at the bottom
        disc(0.084, 0.104, top_c, material='gloss', dome=0.01,
             color_fn=lambda x, y: lerp_color(bottom_c, top_c, min(1, max(0, (y + 0.6) / 1.4)))),
        disc(0.062, 0.07, bottom_c, material='gloss', color_fn=lambda x, y: lerp_color(bottom_c, top_c, (y + 1) / 2.4)).transform(t=(0, -0.022, 0.004)),
        disc(0.03, 0.04, pupil_c, material='gloss').transform(t=(0, 0.0, 0.007)),
        disc(0.03, 0.034, WHITE, material='gloss').transform(t=(-0.03 * side, 0.04, 0.011)),
        # little sparkle low in the iris, like the close-up on the sheet
        heart(0.026, 0.002, WHITE).transform(t=(0.026 * side, -0.046, 0.012)) if sparkle == 'heart'
        else disc(0.014, 0.014, WHITE, material='gloss').transform(t=(0.026 * side, -0.046, 0.012)),
        disc(0.008, 0.008, WHITE, material='gloss').transform(t=(0.012 * side, 0.058, 0.011)),
        disc(0.006, 0.006, WHITE, material='gloss').transform(t=(-0.045 * side, -0.02, 0.011)),
    ]
    if boy:
        # boyish eye: no lashes, just a flatter upper lid line that thickens a little towards the outer corner
        # from the inner corner (low) to the outer corner (a touch higher), flatter than a girl's round lid
        arc = []
        for u in np.linspace(-1, 1, 14):
            x = u * 0.092
            arc.append([side * x, 0.072 * math.sqrt(max(0.0, 1 - u * u)) + 0.028 + 0.012 * u, 0.013])
        parts.append(tube(np.array(arc), lambda t: 0.0045 + 0.004 * t, LASH, segs=6, flat=0.6))
    else:
        # soft lower lash line and two tiny lashes at the outer corner
        low = [[math.cos(a) * 0.082, math.sin(a) * 0.098, 0.012] for a in np.linspace(math.radians(235), math.radians(305), 8)]
        parts.append(tube(np.array(low), lambda t: 0.0025 + 0.002 * math.sin(math.pi * t), lower if lower is not None else LOWER_LASH, segs=5, flat=0.6))
        for k in (0, 1):
            a = math.radians(30 - k * 18)
            p0 = [side * math.cos(a) * 0.09, math.sin(a) * 0.108, 0.013]
            p1 = [side * (math.cos(a) * 0.09 + 0.022), math.sin(a) * 0.108 + 0.012 - k * 0.012, 0.012]
            parts.append(tube(np.array([p0, p1]), lambda t: 0.004 * (1 - t) + 0.001, LASH, segs=5))
        # upper lash line with a little wing at the outer corner
        arc = [[math.cos(a) * 0.09, math.sin(a) * 0.108, 0.013] for a in np.linspace(math.radians(165), math.radians(15), 16)]
        if side < 0:
            arc = arc[::-1]
        arc.append([0.118 * side, 0.075, 0.012])  # wing
        parts.append(tube(np.array(arc), lambda t: 0.006 + 0.008 * math.sin(math.pi * min(1, t * 1.1)), LASH, segs=6, flat=0.6))
    for m in parts:
        m.transform(s=(big, big * lid, 1), t=(0, 0.11 * (1 - lid) * 0.5, 0))
    return parts


def eye_closed(side: int, happy=True) -> list[Mesh]:
    a0, a1 = (math.radians(200), math.radians(-20)) if happy else (math.radians(160), math.radians(380))
    pts = [[math.cos(a) * 0.075, math.sin(a) * 0.05 + (0.0 if happy else 0.02), 0.01] for a in np.linspace(a0, a1, 14)] if happy else \
        [[math.cos(a) * 0.075, -abs(math.sin(a)) * 0.045 + 0.02, 0.01] for a in np.linspace(math.radians(180), math.radians(360), 14)]
    parts = [tube(np.array(pts), lambda t: 0.006 + 0.007 * math.sin(math.pi * t), LASH, segs=6, flat=0.6)]
    outer = 1 if side > 0 else -1
    parts.append(tube(np.array([[outer * 0.075, 0.0, 0.01], [outer * 0.1, 0.025, 0.01]]), 0.005, LASH, segs=5))
    for m in parts:
        m.transform(s=(EYE, EYE, 1))
    return parts


def mouth(kind: str, fang=True) -> list[Mesh]:
    if kind == 'cat':
        left = [[-0.018 + math.cos(a) * 0.018, -math.sin(a) * 0.014, 0.004] for a in np.linspace(math.pi, 0, 8)]
        right = [[0.018 + math.cos(a) * 0.018, -math.sin(a) * 0.014, 0.004] for a in np.linspace(math.pi, 0, 8)]
        return [tube(np.array(left), 0.005, MOUTH, segs=5), tube(np.array(right), 0.005, MOUTH, segs=5)]
    if kind in ('open', 'smile'):
        k = 1.0 if kind == 'open' else 0.68
        shape = disc(0.058, 0.045, MOUTH_IN, color_fn=lambda x, y: MOUTH_IN)
        shape.pos[:, 1] = np.where(shape.pos[:, 1] > 0, shape.pos[:, 1] * 0.25, shape.pos[:, 1])  # D shape
        # one little cat fang at the top corner
        fang = disc(0.009, 0.012, WHITE, segs=3).transform(rot_z(-math.pi / 2), t=(0.02, 0.002, 0.005))
        parts = [shape, disc(0.034, 0.02, TONGUE).transform(t=(0, -0.022, 0.003))] + ([fang] if fang else [])
        return [m.transform(s=(k, k, 1)) for m in parts]
    if kind == 'o':
        return [torus(0.02, 0.007, MOUTH_IN, segs=18, tube_segs=6).transform(rot_x(math.pi / 2))]
    if kind == 'frown':
        pts = [[math.cos(a) * 0.026, math.sin(a) * 0.014 - 0.01, 0.004] for a in np.linspace(math.pi * 0.9, math.pi * 0.1, 8)]
        return [tube(np.array(pts), 0.005, MOUTH, segs=5)]
    if kind == 'flat':
        return [tube(np.array([[-0.022, 0, 0.004], [0.022, 0.004, 0.004]]), 0.005, MOUTH, segs=5)]
    # 'pout'
    return [tube(np.array([[-0.015, 0.0, 0.004], [0, 0.008, 0.006], [0.015, 0.0, 0.004]]), 0.006, MOUTH, segs=5)]


EX, EY, MY = 0.3, -0.08, -0.42
EYE = 0.84  # overall eye size
HEAD_SCALE = 0.86  # smaller head than before so the body and neck read better
HEAD_Y = 0.9  # head node height: the chin rests on the collar


def head_shell() -> Mesh:
    """The one chibi head shared by every character: round full cheeks and a short, soft chin."""
    def shape(p, n):
        q = p.copy()
        if n[1] < 0:
            k = -n[1]
            q[1] *= 1 - 0.1 * k  # shorter chin
            q[0] *= 1 - 0.05 * k ** 2  # only a little narrower right at the bottom, so the cheeks stay round
            q[2] *= 1 + 0.03 * k  # full cheeks, not a flat face
        return q

    return ellipsoid((R, R * 0.94, R), SKIN, segs=40, rings=28, center=C, deform=shape)


def eyes_node(name: str, left: list[Mesh], right: list[Mesh]) -> Node:
    n = Node(name)
    for part in left:
        n.add(on_face(part, -EX, EY, 0.004))
    for part in right:
        n.add(on_face(part, EX, EY, 0.004))
    return n


def mouth_node(name: str, m: list[Mesh]) -> Node:
    n = Node(name)
    for part in m:
        n.add(on_face(part, 0, MY, 0.004))
    return n


def expression(name: str, left: list[Mesh], right: list[Mesh], m: list[Mesh]) -> Node:
    """Eyes and mouth live in separate child nodes so the game can blink and lip-sync over any expression."""
    return Node(f'expr_{name}').add(eyes_node(f'eyes_{name}', left, right), mouth_node(f'mouth_{name}', m))


def build_head() -> Node:
    head = Node('head', translation=(0, HEAD_Y, 0), scale=(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE))
    head.add(head_shell())
    for m in build_hair() + build_ears() + hair_shine(srgb('#fff1f7')):
        head.add(m)
    for m in cat_face_bow(0.9):
        head.add(m.transform(look_basis(outward(0.78, 0.62)), t=sph(0.78, 0.62, R * 1.14)))
    # the other side: a white cat clip by the ear and a pink "×" on the fringe
    for m in cat_clip(1.0):
        head.add(m.transform(look_basis(outward(-0.72, 0.66)), t=sph(-0.72, 0.66, R * 1.13)))
    for m in x_clip(1.0):
        head.add(m.transform(look_basis(outward(-0.6, 0.36)), t=sph(-0.6, 0.36, R * 1.12)))
    # ribbon ties wound into the side locks, with small bows, hanging to the shoulders
    for s in (-1, 1):
        ax = s * 1.12
        rib = bezier([sph(ax * 0.95, 0.42, R * 1.16), sph(ax, 0.05, R * 1.2), sph(ax * 1.02, -0.3, R * 1.24), sph(ax * 1.04, -0.6, R * 1.28)], 16)
        head.add(tube(rib, lambda t: 0.014, BOW_SHADE, segs=6, flat=0.35, up=rib.mean(axis=0) - C))
        for m in ribbon_bow(0.55):
            head.add(m.transform(look_basis(outward(ax * 0.95, 0.42)), t=sph(ax * 0.95, 0.42, R * 1.18)))
    for s in (-1, 1):
        head.add(on_face(disc(0.058, 0.032, BLUSH, material='blend'), s * 0.45, -0.33, 0.0))
        for k in range(3):
            line = tube(np.array([[-0.012 + k * 0.022, -0.01, 0], [0.0 + k * 0.022, 0.012, 0]]), 0.0028, BLUSH_LINE, segs=4)
            head.add(on_face(line.transform(t=(-0.02, 0, 0.008)), s * 0.45, -0.33, 0.0))
    head.add(
        expression('normal', eye_open(-1), eye_open(1), mouth('smile')),
        expression('happy', eye_closed(-1), eye_closed(1), mouth('open')),
        expression('wink', eye_closed(-1), eye_open(1), mouth('open')),
        expression('surprised', eye_open(-1, 1.12), eye_open(1, 1.12), mouth('o')),
        expression('think', eye_open(-1, 1, 0.8), eye_open(1, 1, 0.8), mouth('flat')),
        expression('sad', eye_closed(-1, False), eye_closed(1, False), mouth('frown')),
        expression('annoyed', eye_open(-1, 1, 0.55), eye_open(1, 1, 0.55), mouth('pout')),
        # shown by the game over any expression: closed eyes for blinking, mouth shapes for talking
        eyes_node('blink', eye_closed(-1, False), eye_closed(1, False)),
        mouth_node('talk_open', mouth('open')),
        mouth_node('talk_mid', mouth('smile')),
        mouth_node('talk_o', mouth('o')),
    )
    return head


# ---------------------------------------------------------------- body

def build_leg(side: int) -> Node:
    leg = Node('legL' if side < 0 else 'legR', translation=(side * 0.1, 0.442, 0))
    leg.add(tube(np.array([[0, 0.02, 0], [0, -0.12, 0.005], [0, -0.24, 0]]), lambda t: 0.076 - 0.014 * t, SOCK, segs=16))
    if side < 0:  # knee band with a heart, like the sheet
        leg.add(torus(0.07, 0.014, BOOT_CUFF, segs=24, tube_segs=8).transform(t=(0, -0.15, 0.003)))
        leg.add(heart(0.022, 0.012, HEART).transform(t=(0, -0.15, 0.08)))
    leg.add(lathe([(0.094, -0.19), (0.099, -0.27), (0.104, -0.34), (0.106, -0.37)], BOOT, segs=24))
    # fluffy fur cuff: a ring of soft puffs instead of a plain band
    for k in range(14):
        a = 2 * math.pi * k / 14
        leg.add(ellipsoid((0.034, 0.03, 0.03), FRILL if k % 2 else BOOT_CUFF, segs=10, rings=6,
                          center=(math.sin(a) * 0.1, -0.19 + (k % 2) * 0.006, math.cos(a) * 0.1)))
    # pink heart on the outer side of each boot
    leg.add(heart(0.034, 0.012, HEART).transform(rot_y(side * math.pi / 2), t=(side * 0.104, -0.3, 0.0)))
    leg.add(ellipsoid((0.112, 0.08, 0.14), BOOT, segs=24, rings=14, center=(0, -0.37, 0.05)))
    leg.add(superellipsoid((0.126, 0.04, 0.175), SOLE, e=0.35, center=(0, -0.405, 0.035)))
    leg.add(superellipsoid((0.128, 0.013, 0.177), SOLE_LIGHT, e=0.3, center=(0, -0.378, 0.035)))
    for k, y in enumerate((-0.24, -0.285, -0.33)):
        z = 0.103
        leg.add(tube(np.array([[-0.035, y + 0.015, z], [0.035, y - 0.015, z]]), 0.006, LACE, segs=5))
        leg.add(tube(np.array([[-0.035, y - 0.015, z], [0.035, y + 0.015, z]]), 0.006, LACE, segs=5))
    for s in (-1, 1):  # little bow at the top of the laces
        leg.add(ellipsoid((0.025, 0.016, 0.01), LACE, segs=10, rings=6, center=(s * 0.024, -0.215, 0.1)))
    return leg


def build_arm(side: int) -> Node:
    arm = Node('armL' if side < 0 else 'armR', translation=(side * 0.185, 0.785, 0), rotation=quat_from_matrix(rot_z(side * 0.2)))
    arm.add(ellipsoid((0.075, 0.07, 0.075), SWEATER, segs=18, rings=10, center=(0, -0.01, 0)))
    arm.add(tube(np.array([[0, 0, 0], [0, -0.13, 0.01], [0, -0.26, 0.02]]), lambda t: 0.062 + 0.04 * t ** 1.4, SWEATER, segs=18,
                 color_fn=lambda t: lerp_color(SWEATER, SWEATER_SHADE, t * 0.6), cap=False))
    # puffy cuff tied with a pink ribbon and a little bow on the front
    arm.add(torus(0.1, 0.022, SWEATER_SHADE, segs=24, tube_segs=8).transform(t=(0, -0.255, 0.02)))
    arm.add(torus(0.094, 0.012, BOW, segs=24, tube_segs=6).transform(t=(0, -0.235, 0.02)))
    for m in ribbon_bow(0.38, tails=0.08):
        arm.add(m.transform(t=(0, -0.235, 0.118)))
    arm.add(ellipsoid((0.05, 0.058, 0.046), SKIN, segs=16, rings=10, center=(0, -0.31, 0.025)))
    arm.add(ellipsoid((0.018, 0.028, 0.018), SKIN, segs=8, rings=6, center=(-side * 0.04, -0.3, 0.05)))
    return arm


def build_tail() -> Node:
    tail = Node('tail', translation=(0, 0.45, -0.16))
    ctrl = [[0, 0, 0], [0, -0.04, -0.14], [0.04, 0.06, -0.3], [0.1, 0.25, -0.33], [0.14, 0.42, -0.24]]
    pts = bezier(ctrl, 28)
    tail.add(tube(pts, lambda t: 0.034 + 0.014 * t, HAIR, segs=12, color_fn=lambda t: lerp_color(HAIR, HAIR_LIGHT, t)))
    tail.add(ellipsoid((0.062, 0.07, 0.062), HAIR_LIGHT, segs=16, rings=10, center=pts[-1] + np.array([0.01, 0.03, 0.01])))
    for t in (0.3, 0.38):  # ribbon rings
        i = int(t * (len(pts) - 1))
        d = pts[i + 1] - pts[i]
        tail.add(torus(0.046, 0.01, BOW_SHADE, segs=18, tube_segs=6).transform(look_basis(d) @ rot_x(math.pi / 2), t=pts[i]))
    i = int(0.34 * (len(pts) - 1))
    for m in cat_face_bow(0.75):
        tail.add(m.transform(rot_y(math.pi), t=pts[i] + np.array([0, 0.02, -0.04])))
    return tail


def build_body() -> Node:
    body = Node('body')
    body.add(build_leg(-1), build_leg(1))
    # pleated skirt with a light hem band
    pleats = 16
    prof = [(0.166, 0.565), (0.19, 0.51), (0.24, 0.43), (0.295, 0.345), (0.3, 0.325), (0.302, 0.315)]

    def rmod(th, k):
        saw = abs(((th * pleats / (2 * math.pi)) % 1) - 0.5) * 2
        return 1 + 0.07 * saw * (k / (len(prof) - 1))

    def scol(th, k):
        if k >= len(prof) - 2:
            return SKIRT_HEM
        # pink and pale-pink stripes, darker in the pleat folds
        phase = (th * pleats / (2 * math.pi)) % 1
        stripe = SKIRT if int(th * pleats / (2 * math.pi)) % 2 else SKIRT_LIGHT
        return lerp_color(stripe, SKIRT_SHADE, 0.45) if phase < 0.22 else stripe

    body.add(lathe(prof, SKIRT, segs=pleats * 8, rmod=rmod, color_fn=scol, material='double'))
    # white lace ruffle peeking out under the hem
    body.add(lathe([(0.29, 0.33), (0.31, 0.3), (0.33, 0.272)], FRILL, segs=pleats * 8, material='double',
                   rmod=lambda th, k: 1 + 0.045 * math.sin(th * 40) * (k / 2)))
    body.add(torus(0.172, 0.022, BELT, segs=40, tube_segs=8).transform(t=(0, 0.555, 0)))
    body.add(heart(0.05, 0.024, HEART).transform(t=(0, 0.555, 0.185)))
    body.add(heart(0.03, 0.03, srgb('#ffc2dc')).transform(t=(0, 0.557, 0.188)))
    # small white puffy hearts on the belt either side of the buckle
    for s in (-1, 1):
        a = s * 0.62
        body.add(heart(0.032, 0.022, FRILL).transform(rot_y(a), t=(math.sin(a) * 0.186, 0.556, math.cos(a) * 0.186)))
    # big bow at the back of the waist with a heart knot
    for m in ribbon_bow(1.9, heart_center=True, tails=0.13):
        body.add(m.transform(rot_y(math.pi), t=(0, 0.565, -0.19)))
    # sweater
    body.add(lathe([(0.168, 0.5), (0.178, 0.58), (0.182, 0.66), (0.168, 0.73), (0.12, 0.78), (0.055, 0.8)], SWEATER, segs=48,
                   color_fn=lambda th, k: SWEATER_SHADE if int(th * 48 / (2 * math.pi)) % 4 == 0 else SWEATER).transform(s=(1, 1, 0.84)))
    body.add(heart(0.034, 0.014, srgb('#ff9cc4')).transform(t=(0, 0.6, 0.158)))
    body.add(tube(np.array([[0, 0.76, 0], [0, 0.84, 0]]), 0.046, SKIN, segs=14))  # tiny neck, hidden under the chin
    # pink sailor collar over the shoulders with a white trim line, and a bow at the front
    collar_prof = [(0.062, 0.808), (0.13, 0.775), (0.172, 0.73), (0.192, 0.69), (0.198, 0.672)]
    body.add(lathe(collar_prof, SAILOR, segs=48, material='double',
                   color_fn=lambda th, k: FRILL if k == 2 else SAILOR).transform(s=(1, 1, 0.86)))
    for m in ribbon_bow(0.9, tails=0.09):
        body.add(m.transform(rot_x(-0.25), t=(0, 0.75, 0.152)))
    body.add(build_arm(-1), build_arm(1), build_tail(), build_head())
    return body


def main() -> None:
    root = Node('miyu')
    root.add(build_body())
    out = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'miyu.glb')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    stats = write_glb(root, out)
    print(f"wrote {os.path.normpath(out)}: {stats['vertices']} vertices, {stats['triangles']} triangles, {stats['nodes']} nodes")


if __name__ == '__main__':
    main()
