"""Builds the two player characters from their character sheets, in the same style as MIYU.

Run:  tools/.venv/Scripts/python.exe tools/miyu/build_players.py
Out:  public/models/kuro.glb (boy) and public/models/kira.glb (girl)

Both share MIYU's skeleton so the game animates them the same way:
body, legL/R, armL/R, head, expr_<name> (eyes_<name> + mouth_<name>), blink, talk_*.
Kuro: messy black hair, square glasses, black track jacket with white stripes, cargo pants,
sneakers and a buckled backpack. Kira: long wavy black hair with white bows, cat and "×" clips,
glasses, white shirt with a black bow, oversized jacket, pleated skirt with a garter,
slouchy leg warmers, platform boots and a backpack with a cat keychain.
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import build_miyu as bm  # noqa: E402
from build_miyu import C, R, eye_closed, eye_open, eyes_node, expression, mouth, mouth_node, on_face, outward, patch, sph, strand  # noqa: E402
from meshkit import (Mesh, Node, bezier, disc, ellipsoid, heart, lathe, lerp_color, look_basis, quat_from_matrix, rot_x, rot_y,  # noqa: E402
                     rot_z, srgb, superellipsoid, torus, tube, write_glb)

SKIN = bm.SKIN
WHITE = srgb('#ffffff')
OFFWHITE = srgb('#f2f0f4')
BLACK = srgb('#28252c')
BLACK_SHADE = srgb('#18161b')
BLACK_LIGHT = srgb('#3d3943')
SILVER = srgb('#c9ccd3')
SILVER_DARK = srgb('#8e929b')
SOLE = srgb('#f4f4f6')
GLASSES = srgb('#1b181d')
IRIS = (srgb('#2b272e'), srgb('#a7a2ad'), srgb('#121014'))
LOW_LASH = srgb('#5a4a52')
BLUSH = srgb('#ff9fb8', 0.42)


def face_pt(ax: float, ay: float, out: float, x: float = 0.0, y: float = 0.0) -> np.ndarray:
    """A point on a little plane stuck to the face, in head space (like on_face for one point)."""
    return look_basis(outward(ax, ay)) @ np.array([x, y, 0.0]) + sph(ax, ay, R + out)


# ---------------------------------------------------------------- shared face pieces

def glasses(square: bool) -> list[Mesh]:
    """Thin black frames over both eyes, a bridge and temple arms back to the ears."""
    parts: list[Mesh] = []
    hw, hh, rad, out = (0.112, 0.086, 0.026, 0.036) if square else (0.108, 0.09, 0.04, 0.036)
    inner, outer = {}, {}
    for s in (-1, 1):
        pts = []
        for cx, cy, a0 in ((hw - rad, hh - rad, 0), (-hw + rad, hh - rad, 90), (-hw + rad, -hh + rad, 180), (hw - rad, -hh + rad, 270)):
            for a in np.linspace(math.radians(a0), math.radians(a0 + 90), 5):
                pts.append([cx + math.cos(a) * rad, cy + math.sin(a) * rad, 0.0])
        pts.append(pts[0])
        parts.append(on_face(tube(np.array(pts), 0.0075, GLASSES, segs=6), s * bm.EX, bm.EY, out))
        inner[s] = face_pt(s * bm.EX, bm.EY, out, -s * hw, 0.02)
        outer[s] = face_pt(s * bm.EX, bm.EY, out, s * hw, 0.03)
    parts.append(tube(bezier([inner[-1], face_pt(0, bm.EY + 0.04, out + 0.01), inner[1]], 10), 0.006, GLASSES, segs=5))
    for s in (-1, 1):
        parts.append(tube(bezier([outer[s], sph(s * 1.0, bm.EY + 0.06, R * 1.08), sph(s * 1.45, bm.EY + 0.04, R * 1.04), sph(s * 1.62, -0.02, R * 1.0)], 12),
                          0.006, GLASSES, segs=5))
    return parts


def sharp_eye(side: int, open_: float = 1.0) -> list[Mesh]:
    """Kuro's cool, slanted eye: almond shape with the inner corner low and a heavy outer lid,
    a smaller grey iris tucked under the lid, no lashes. +X points to the outer corner on `side`."""
    hy = 0.046 * open_
    parts = [
        disc(0.056, hy, IRIS[0], material='gloss', color_fn=lambda x, y: lerp_color(IRIS[1], IRIS[0], min(1, max(0, (y + 0.5) / 1.3)))).transform(t=(side * 0.006, -0.008, 0.01)),
        disc(0.022, hy * 0.7, IRIS[2], material='gloss').transform(t=(side * 0.006, -0.008, 0.013)),
        disc(0.012, 0.01, WHITE, material='gloss').transform(t=(-side * 0.018, hy * 0.35, 0.016)),
    ]
    lid = []
    for u in np.linspace(-1, 1, 14):
        lid.append([side * u * 0.096, 0.022 * (u + 1) + 0.03 * math.sqrt(max(0.0, 1 - u * u)) * open_ - 0.004, 0.014])
    lid.append([side * 0.118, 0.03, 0.013])  # sharp tip flicking out at the corner
    parts.append(tube(np.array(lid), lambda t: 0.006 + 0.007 * t, srgb('#17141a'), segs=6, flat=0.6))
    low = [[side * x, -0.05 * open_ + 0.3 * (x - 0.03), 0.013] for x in np.linspace(0.03, 0.09, 5)]
    parts.append(tube(np.array(low), 0.0028, LOW_LASH, segs=4, flat=0.6))
    return [m.transform(s=(bm.EYE, bm.EYE, 1)) for m in parts]


def player_face(head: Node, boy: bool) -> None:
    """Grey anime eyes, soft blush and the expression set (no fang, unlike MIYU).
    Kuro gets smaller, narrower eyes without lashes so he reads as a boy."""
    def e(side, big=1.0, lid=1.0):
        if boy:
            return sharp_eye(side, big * lid)
        return eye_open(side, big, lid, iris=IRIS, sparkle='dot', lower=LOW_LASH)

    def closed(side, happy=True):
        parts = eye_closed(side, happy)
        return [m.transform(s=(1.0, 0.55, 1)) for m in parts[:1]] if boy else parts  # flatter, no little outer lash for him

    if boy:
        # straight, stern brows angled down towards the nose, just under the fringe
        for s in (-1, 1):
            brow = tube(np.array([[-s * 0.075, -0.014, 0.0], [s * 0.01, 0.004, 0.0], [s * 0.095, 0.016, 0.0]]), lambda t: 0.012 - 0.005 * t, srgb('#1e1a20'), segs=6, flat=0.5)
            head.add(on_face(brow, s * bm.EX, 0.18, 0.012))
        # silver stud and hoop in his left ear
        head.add(torus(0.016, 0.004, SILVER, segs=14, tube_segs=4).transform(rot_x(math.pi / 2) @ rot_z(math.pi / 2), t=sph(-1.6, -0.24, R * 0.99)))
        head.add(ellipsoid((0.008, 0.008, 0.008), SILVER, segs=8, rings=5, center=sph(-1.5, -0.12, R * 1.0)))
    for s in (-1, 1):
        if not boy:
            head.add(on_face(disc(0.056, 0.03, BLUSH, material='blend'), s * 0.45, -0.33, 0.0))
        # human ears, mostly tucked under the hair
        head.add(ellipsoid((0.032, 0.05, 0.022), SKIN, segs=14, rings=10, center=sph(s * 1.57, -0.12, R * 0.97)))
    small = [m.transform(s=(0.75, 1, 1)) for m in mouth('flat')]
    head.add(
        expression('normal', e(-1), e(1), small),
        expression('happy', closed(-1), closed(1), mouth('open', fang=False)),
        expression('wink', closed(-1), e(1), mouth('open', fang=False)),
        expression('surprised', e(-1, 1.1), e(1, 1.1), mouth('o')),
        expression('think', e(-1, 1, 0.8), e(1, 1, 0.8), mouth('flat')),
        expression('sad', closed(-1, False), closed(1, False), mouth('frown')),
        expression('annoyed', e(-1, 1, 0.55), e(1, 1, 0.55), mouth('pout')),
        eyes_node('blink', closed(-1, False), closed(1, False)),
        mouth_node('talk_open', mouth('open', fang=False)),
        mouth_node('talk_mid', mouth('smile', fang=False)),
        mouth_node('talk_o', mouth('o')),
    )


def head_base(hair: list[Mesh], square_glasses: bool) -> Node:
    head = Node('head', translation=(0, bm.HEAD_Y, 0), scale=(bm.HEAD_SCALE,) * 3)
    head.add(bm.head_shell())
    player_face(head, boy=square_glasses)
    for m in hair + glasses(square_glasses) + bm.hair_shine(srgb('#7a6b7c')):
        head.add(m)
    return head


def hair_cap(col, light, shade) -> list[Mesh]:
    cap = lathe([(R * 1.055 * math.sin(t), R * 1.055 * math.cos(t)) for t in np.linspace(0.001, math.pi * 0.6, 16)], col, segs=40,
                color_fn=lambda th, k: lerp_color(light, col, min(1, k / 9)))
    return [cap.transform(rot_x(-0.5), t=C),
            patch((R * 1.06, R * 1.04, R * 1.06), 0.05, math.pi * 0.84, math.pi / 2, math.pi * 1.5,
                  lambda v: lerp_color(col, shade, v), center=C + np.array([0, -0.02, -0.01]))]


def bow(scale: float, col, shade) -> list[Mesh]:
    """Small ribbon bow facing +Z in any colour."""
    parts = []
    for s in (-1, 1):
        parts.append(ellipsoid((0.07, 0.046, 0.026), col, segs=16, rings=10,
                               color_fn=lambda p: lerp_color(col, shade, max(0, -p[1] / 0.05) * 0.5)).transform(rot_z(s * 0.3), t=(s * 0.064, 0.004, 0)))
        parts.append(tube(bezier([[s * 0.015, -0.01, 0.0], [s * 0.035, -0.06, 0.008], [s * 0.055, -0.12, 0.0]], 8),
                          lambda t: 0.015 - 0.004 * t, shade, segs=6, flat=0.35))
    parts.append(ellipsoid((0.024, 0.026, 0.022), shade, segs=12, rings=8, center=(0, 0, 0.012)))
    return [m.transform(s=(scale, scale, scale)) for m in parts]


def x_pins(col) -> list[Mesh]:
    return [tube(np.array([[-0.035, -0.035 * k, 0], [0.035, 0.035 * k, 0]]), 0.009, col, segs=6) for k in (-1, 1)]


# ---------------------------------------------------------------- shared body pieces

def sleeve_arm(side: int, long_cuff: bool, stripes: int = 2) -> Node:
    """Black jacket sleeve with two white stripes down the outside, ribbed cuff and a hand."""
    arm = Node('armL' if side < 0 else 'armR', translation=(side * 0.19, 0.785, 0), rotation=quat_from_matrix(rot_z(side * 0.2)))
    arm.add(ellipsoid((0.08, 0.075, 0.08), BLACK, segs=18, rings=10, center=(0, -0.01, 0)))
    arm.add(tube(np.array([[0, 0, 0], [0, -0.13, 0.01], [0, -0.27, 0.02]]), lambda t: 0.066 + 0.03 * t, BLACK, segs=18,
                 color_fn=lambda t: lerp_color(BLACK, BLACK_SHADE, t * 0.6), cap=False))
    for k in range(stripes):
        off = side * (0.074 + 0.004 * k)
        dz = (k - (stripes - 1) / 2) * 0.024
        pts = np.array([[off, -0.0, dz], [off * 1.12, -0.13, 0.01 + dz], [off * 1.3, -0.25, 0.02 + dz]])
        arm.add(tube(pts, 0.008, OFFWHITE, segs=5))
    cuff_y = -0.3 if long_cuff else -0.27
    arm.add(lathe([(0.088, cuff_y + 0.04), (0.092, cuff_y), (0.084, cuff_y - 0.03)], BLACK_SHADE, segs=24,
                  color_fn=lambda th, k: BLACK_LIGHT if int(th * 24 / (2 * math.pi)) % 2 else BLACK_SHADE).transform(t=(0, 0, 0.02)))
    hand_y = cuff_y - 0.055
    arm.add(ellipsoid((0.048, 0.052 if long_cuff else 0.058, 0.045), SKIN, segs=16, rings=10, center=(0, hand_y, 0.025)))
    arm.add(ellipsoid((0.017, 0.026, 0.017), SKIN, segs=8, rings=6, center=(-side * 0.038, hand_y + 0.01, 0.05)))
    return arm


def jacket_torso(body: Node, hem_y: float, open_front: float) -> None:
    """Oversized black track jacket, open at the front (th near 0) by `open_front` radians."""
    prof = [(0.2, hem_y), (0.198, hem_y + 0.06), (0.192, 0.58), (0.19, 0.66), (0.172, 0.73), (0.122, 0.78), (0.06, 0.8)]

    def rmod(th, k):
        a = min(abs(th), abs(th - 2 * math.pi))
        return 1.0 if a > open_front else 0.94  # lapels fold slightly inwards

    def col(th, k):
        a = min(abs(th), abs(th - 2 * math.pi))
        if k == 0:
            return BLACK_SHADE
        return BLACK_LIGHT if a < open_front + 0.12 else BLACK

    body.add(lathe(prof, BLACK, segs=64, rmod=rmod, color_fn=col, material='double').transform(s=(1, 1, 0.86)))
    # ribbed hem band
    body.add(torus(0.2, 0.02, BLACK_SHADE, segs=48, tube_segs=6).transform(s=(1, 1, 0.86), t=(0, hem_y + 0.01, 0)))
    # silver zipper teeth on both edges of the opening and a pull tab
    for s in (-1, 1):
        a = s * (open_front + 0.03)
        pts = np.array([[math.sin(a) * r * 1.01, y, math.cos(a) * r * 0.86 * 1.01] for r, y in prof[1:5]])
        body.add(tube(pts, 0.006, SILVER, segs=5))
    body.add(superellipsoid((0.012, 0.022, 0.006), SILVER, e=0.3, center=(math.sin(0.2) * 0.19, 0.69, 0.165)))
    # tall collar and the hood lying on the back
    body.add(lathe([(0.085, 0.77), (0.088, 0.81), (0.082, 0.84)], BLACK, segs=32, material='double').transform(s=(1, 1, 0.9)))
    body.add(ellipsoid((0.16, 0.085, 0.07), BLACK_SHADE, segs=20, rings=10, center=(0, 0.78, -0.15)))
    body.add(torus(0.1, 0.02, BLACK, segs=24, tube_segs=6, arc=math.pi).transform(rot_y(math.pi), t=(0, 0.8, -0.13)))


def backpack(body: Node, keychain: bool) -> None:
    """Black buckled backpack with straps over the shoulders."""
    z = -0.31
    body.add(superellipsoid((0.15, 0.17, 0.075), BLACK, e=0.35, center=(0, 0.57, z)))
    body.add(superellipsoid((0.12, 0.08, 0.04), BLACK_LIGHT, e=0.4, center=(0, 0.5, z - 0.07)))  # front pocket
    body.add(superellipsoid((0.152, 0.07, 0.08), BLACK_SHADE, e=0.4, center=(0, 0.69, z - 0.01)))  # top flap
    for s in (-1, 1):
        body.add(superellipsoid((0.016, 0.06, 0.006), BLACK_SHADE, e=0.3, center=(s * 0.06, 0.62, z - 0.087)))  # flap straps
        body.add(superellipsoid((0.02, 0.016, 0.008), SILVER, e=0.3, center=(s * 0.06, 0.585, z - 0.09)))  # buckles
        body.add(superellipsoid((0.022, 0.05, 0.035), BLACK_SHADE, e=0.4, center=(s * 0.155, 0.53, z)))  # side pockets
        strap = bezier([[s * 0.1, 0.7, z + 0.06], [s * 0.13, 0.82, -0.08], [s * 0.15, 0.8, 0.1], [s * 0.13, 0.62, 0.16], [s * 0.12, 0.47, z + 0.07]], 18)
        body.add(tube(strap, 0.015, BLACK_SHADE, segs=6, flat=0.4))
        body.add(superellipsoid((0.014, 0.01, 0.006), SILVER, e=0.3, center=(s * 0.135, 0.62, 0.168)))
    body.add(torus(0.035, 0.008, BLACK_SHADE, segs=14, tube_segs=5, arc=math.pi).transform(rot_x(math.pi / 2) @ rot_z(math.pi), t=(0, 0.74, z)))
    body.add(disc(0.012, 0.012, OFFWHITE).transform(rot_y(math.pi), t=(0.07, 0.48, z - 0.112)))  # tiny logo
    if keychain:
        # white cat-face keychain dangling from the right side
        body.add(tube(np.array([[0.11, 0.52, z - 0.08], [0.115, 0.47, z - 0.09]]), 0.003, SILVER, segs=4))
        for m in bm.cat_clip(0.9):
            body.add(m.transform(rot_y(math.pi), t=(0.115, 0.44, z - 0.1)))
        body.add(superellipsoid((0.016, 0.022, 0.004), OFFWHITE, e=0.3, center=(-0.09, 0.46, z - 0.1)))  # little tag


# ---------------------------------------------------------------- Kuro (boy)

KH = srgb('#2a2226')
KH_LIGHT = srgb('#4b3d44')
KH_SHADE = srgb('#141016')


def kuro_hair() -> list[Mesh]:
    parts = hair_cap(KH, KH_LIGHT, KH_SHADE)
    rng = np.random.default_rng(11)

    def tint():
        return lerp_color(KH, KH_LIGHT if rng.uniform() < 0.35 else KH_SHADE, float(rng.uniform(0, 0.5)))

    # pointed fringe: longest in the middle (down between the eyes), rising towards the temples
    # in a zigzag of triangular locks, so it never reads as a straight-cut bang
    for i in range(13):
        ax = -0.9 + i * 0.15
        zig = 0.0 if i % 2 == 0 else 0.09
        tip = -0.04 + abs(ax) * 0.3 + zig + rng.uniform(-0.015, 0.015)
        curl = (0.1 if ax > 0 else -0.1) * min(1.0, abs(ax) * 2) + rng.uniform(-0.04, 0.04)
        parts.append(strand([sph(ax * 0.3, 1.15, R * 1.06), sph(ax * 0.8, 0.72, R * 1.13), sph(ax * 0.95 + curl * 0.3, 0.42, R * 1.13),
                             sph(ax + curl, tip, R * 1.1)], 0.1 + rng.uniform(0, 0.015), tint(), KH_LIGHT, flat=0.3))
    # fluffy messy volume: thick, short tufts lying on the head and flicking out at the tips
    for j in range(20):
        ax = (j / 20) * 2 * math.pi + rng.uniform(-0.1, 0.1)
        if math.cos(ax) > 0.75:
            continue  # leave the face clear
        ay = rng.uniform(0.4, 0.95)
        parts.append(strand([sph(ax, ay + 0.3, R * 1.05), sph(ax, ay, R * 1.14), sph(ax + rng.uniform(-0.12, 0.12), ay - 0.2, R * 1.2),
                             sph(ax + rng.uniform(-0.18, 0.18), ay - 0.16 + rng.uniform(0, 0.1), R * 1.26)], 0.1, tint(), KH_LIGHT, flat=0.3))
    # locks in front of the ears that cover the cheeks
    for s in (-1, 1):
        for k in range(3):
            ax = s * (0.6 + 0.12 * k)
            parts.append(strand([sph(ax * 0.6, 0.85, R * 1.06), sph(ax, 0.15, R * 1.11), sph(ax * 0.97, -0.28, R * 1.1),
                                 sph(ax * 0.9, -0.52 + 0.05 * k, R * 1.12)], 0.1, tint(), KH_LIGHT, flat=0.3))
    # side hair over the ears and a short shaggy back with flicks at the nape
    for s in (-1, 1):
        for k in range(4):
            ax = s * (0.95 + 0.17 * k)
            parts.append(strand([sph(ax * 0.85, 0.75, R * 1.07), sph(ax, 0.2, R * 1.13), sph(ax * 1.02, -0.22 - 0.04 * k, R * 1.12),
                                 sph(ax * 1.03, -0.3 - 0.04 * k, R * 1.14)], 0.07, tint(), KH_SHADE, flat=0.3))
    for j in range(14):
        ax = 2.1 + (2 * math.pi - 4.2) * j / 13
        parts.append(strand([sph(ax, 0.9, R * 1.05), sph(ax, 0.2, R * 1.14), sph(ax, -0.3, R * 1.14), sph(ax + rng.uniform(-0.2, 0.2), -0.42, R * 1.26)],
                            0.08, tint(), KH_SHADE, flat=0.3))
    # ahoge
    top = C + np.array([0, R * 1.06, 0])
    parts.append(strand([top, top + [0.0, 0.1, 0.02], top + [0.06, 0.16, 0.02], top + [0.1, 0.11, 0.0]], 0.024, KH, KH_LIGHT, flat=0.7))
    return parts


def kuro_leg(side: int) -> Node:
    leg = Node('legL' if side < 0 else 'legR', translation=(side * 0.1, 0.442, 0))
    # baggy cargo trousers, bunching above the shoes
    leg.add(tube(np.array([[0, 0.04, 0], [0, -0.12, 0.005], [0, -0.28, 0]]), lambda t: 0.098 + 0.004 * t, BLACK, segs=18,
                 color_fn=lambda t: lerp_color(BLACK, BLACK_SHADE, t * 0.5)))
    for k in range(2):
        leg.add(torus(0.1, 0.012, BLACK_SHADE, segs=24, tube_segs=6).transform(rot_x(0.08 * (k * 2 - 1)), t=(0, -0.25 - 0.03 * k, 0.003)))
    # three white stripes down the outside of the track pants, and a little logo on one thigh
    for k in range(3):
        dz = (k - 1) * 0.026
        leg.add(tube(np.array([[side * 0.099, 0.04, dz], [side * 0.101, -0.12, dz + 0.003], [side * 0.104, -0.25, dz]]), 0.0075, OFFWHITE, segs=5))
    if side > 0:
        for k in range(3):
            a = math.pi / 2 + (k - 1) * 0.7
            leg.add(ellipsoid((0.01, 0.016, 0.004), OFFWHITE, segs=8, rings=5, center=(0.035 + math.cos(a) * 0.012, -0.02 + math.sin(a) * 0.012, 0.096)))
    # chunky black sneakers with white soles, laces and side swoosh
    leg.add(ellipsoid((0.105, 0.075, 0.15), BLACK, segs=24, rings=14, center=(0, -0.36, 0.05)))
    leg.add(superellipsoid((0.118, 0.035, 0.172), SOLE, e=0.35, center=(0, -0.41, 0.045)))
    leg.add(superellipsoid((0.12, 0.008, 0.174), srgb('#d8d8de'), e=0.3, center=(0, -0.385, 0.045)))
    for k in range(3):
        leg.add(tube(np.array([[-0.035, -0.31 - 0.022 * k, 0.12 + 0.02 * k], [0.035, -0.31 - 0.022 * k, 0.12 + 0.02 * k]]), 0.006, OFFWHITE, segs=5))
    leg.add(tube(bezier([[side * 0.1, -0.38, -0.04], [side * 0.106, -0.35, 0.03], [side * 0.098, -0.33, 0.1]], 8), 0.007, OFFWHITE, segs=5))
    return leg


def build_kuro() -> Node:
    body = Node('body')
    body.add(kuro_leg(-1), kuro_leg(1))
    # trousers' seat and waist, then the white T-shirt hem peeking under the jacket
    body.add(lathe([(0.17, 0.56), (0.19, 0.48), (0.2, 0.42)], BLACK, segs=40).transform(s=(1, 1, 0.86)))
    body.add(lathe([(0.168, 0.47), (0.172, 0.44)], OFFWHITE, segs=40, material='double').transform(s=(1, 1, 0.86)))
    jacket_torso(body, 0.46, 0.3)
    # three white stripes running over each shoulder, like a classic track jacket
    prof = [(0.19, 0.66), (0.172, 0.73), (0.122, 0.78)]
    for k in range(3):
        y = 0.752 - 0.022 * k
        r = np.interp(y, [p[1] for p in prof], [p[0] for p in prof]) * 1.04
        for s in (-1, 1):
            pts = np.array([[s * math.sin(th) * r, y, math.cos(th) * r * 0.86] for th in np.linspace(0.5, 2.7, 14)])
            body.add(tube(pts, 0.008, OFFWHITE, segs=5))
    # black T-shirt front with a tiny white print, visible in the opening
    body.add(superellipsoid((0.055, 0.14, 0.02), BLACK_SHADE, e=0.5, center=(0, 0.62, 0.148)))
    body.add(disc(0.014, 0.01, OFFWHITE).transform(t=(0.0, 0.66, 0.169)))
    # drawstrings with metal tips and a small chest badge on the jacket
    for s in (-1, 1):
        body.add(tube(np.array([[s * 0.03, 0.78, 0.09], [s * 0.035, 0.7, 0.16], [s * 0.037, 0.63, 0.17]]), 0.0045, OFFWHITE, segs=4))
        body.add(ellipsoid((0.007, 0.012, 0.007), SILVER, segs=8, rings=5, center=(s * 0.037, 0.62, 0.17)))
    body.add(superellipsoid((0.016, 0.012, 0.004), OFFWHITE, e=0.3, center=(-0.12, 0.68, 0.152)))
    # zipped jacket pockets and a silver wallet chain looping from the right hip
    for s in (-1, 1):
        body.add(tube(np.array([[s * 0.1, 0.6, 0.172], [s * 0.155, 0.52, 0.152]]), 0.005, SILVER, segs=4))
    body.add(tube(bezier([[0.18, 0.47, 0.05], [0.2, 0.38, 0.09], [0.19, 0.36, 0.0], [0.17, 0.43, -0.07]], 16), 0.005, SILVER, segs=5))
    backpack(body, keychain=False)
    body.add(sleeve_arm(-1, False, 3), sleeve_arm(1, False, 3), head_base(kuro_hair(), True))
    return body


# ---------------------------------------------------------------- Kira (girl)

AH = srgb('#2b2227')
AH_LIGHT = srgb('#4e3f46')
AH_SHADE = srgb('#151116')


def kira_hair() -> list[Mesh]:
    parts = hair_cap(AH, AH_LIGHT, AH_SHADE)
    rng = np.random.default_rng(5)

    def tint():
        return lerp_color(AH, AH_LIGHT if rng.uniform() < 0.3 else AH_SHADE, float(rng.uniform(0, 0.45)))

    # wispy fringe to the glasses
    pair = [(rng.uniform(-0.03, 0.02), rng.uniform(-0.05, 0.05)) for _ in range(9)]
    for i in range(17):
        ax = -0.95 + i * 0.119
        jit, wob = pair[abs(i - 8)]
        tip = 0.13 - abs(ax) * 0.08 + jit * 0.5  # just above the glasses
        parts.append(strand([sph(ax * 0.3, 1.1, R * 1.055), sph(ax * 0.75, 0.7, R * 1.1), sph(ax * 0.95, 0.4, R * 1.1),
                             sph(ax + np.sign(ax) * (wob + 0.08 * abs(ax)), tip, R * 1.07)], 0.06, tint(), AH_LIGHT, flat=0.35))
    # long wavy side locks falling in front of the shoulders to the waist
    for s in (-1, 1):
        for k in range(4):
            ax = s * (0.62 + 0.14 * k)
            base_x = s * (0.36 + 0.04 * k)
            wave = [s * 0.05 * math.sin(k + j * 1.7) for j in range(4)]
            pts = [sph(ax * 0.6, 0.9, R * 1.06), sph(ax, 0.3, R * 1.12), sph(ax * 1.02, -0.25, R * 1.16),
                   np.array([base_x + wave[0], -0.25, 0.1 - 0.05 * k]), np.array([base_x + wave[1], -0.5, 0.06 - 0.05 * k]),
                   np.array([base_x * 0.95 + wave[2], -0.72 - 0.03 * k, 0.04 - 0.05 * k])]
            parts.append(strand(pts, 0.075, tint(), AH_LIGHT, flat=0.35, n=26))
    # long back hair, layered, waving down behind the body to the waist
    for j in range(24):
        ax = 1.7 + (2 * math.pi - 3.4) * (j + rng.uniform(-0.3, 0.3)) / 23
        sx = math.sin(ax)
        w = rng.uniform(0, math.pi)
        end = -0.78 - rng.uniform(0, 0.1)
        pts = [sph(ax, 0.95, R * 1.05), sph(ax, 0.2, R * 1.13), sph(ax, -0.4, R * 1.12),
               np.array([sx * 0.42 + 0.04 * math.sin(w), -0.3, -0.27]), np.array([sx * 0.44 + 0.05 * math.sin(w + 1.6), -0.55, -0.29]),
               np.array([sx * 0.42 + 0.04 * math.sin(w + 3.2), end, -0.27])]
        parts.append(strand(pts, 0.085, tint(), AH_LIGHT, flat=0.3, n=26))
    # flyaways and the looped ahoge
    for ax in (0.5, 2.2, 4.0, 5.4):
        parts.append(strand([sph(ax, 1.25, R * 1.05), sph(ax, 0.95, R * 1.14), sph(ax + 0.25, 0.75, R * 1.18)], 0.035, AH_LIGHT, AH, flat=0.35))
    top = C + np.array([0, R * 1.05, 0])
    parts.append(strand([top, top + [-0.03, 0.12, 0.0], top + [0.04, 0.2, 0.0], top + [0.08, 0.12, 0.0], top + [0.02, 0.06, 0.0]], 0.02, AH, AH_LIGHT, flat=0.7))
    # accessories: white bows tied on both sides, white cat clip and two white "×" pins
    for s in (-1, 1):
        for m in bow(0.6, OFFWHITE, srgb('#d9d6de')):
            parts.append(on_face(m, s * 1.05, 0.25, 0.08))
    for m in bm.cat_clip(1.05):
        parts.append(m.transform(look_basis(outward(0.78, 0.62)), t=sph(0.78, 0.62, R * 1.14)))
    for k, (ax, ay) in enumerate(((0.6, 0.42), (0.68, 0.28))):
        for m in x_pins(OFFWHITE):
            parts.append(m.transform(look_basis(outward(ax, ay)), t=sph(ax, ay, R * 1.12)))
    return parts


def kira_leg(side: int) -> Node:
    leg = Node('legL' if side < 0 else 'legR', translation=(side * 0.095, 0.442, 0))
    leg.add(tube(np.array([[0, 0.02, 0], [0, -0.12, 0.005], [0, -0.24, 0]]), lambda t: 0.072 - 0.012 * t, SKIN, segs=16))
    if side < 0:
        # garter band with a silver ring and a strap running up under the skirt
        leg.add(torus(0.074, 0.012, BLACK, segs=24, tube_segs=6).transform(t=(0, -0.04, 0.0)))
        leg.add(torus(0.016, 0.004, SILVER, segs=14, tube_segs=4).transform(rot_x(math.pi / 2), t=(-0.03, -0.045, 0.072)))
        leg.add(tube(np.array([[-0.03, -0.03, 0.074], [-0.025, 0.06, 0.07]]), 0.006, BLACK, segs=5))
    # slouchy black leg warmers, bunched in rolls
    for k in range(5):
        leg.add(torus(0.082 + 0.004 * (k % 2), 0.022, BLACK if k % 2 else BLACK_LIGHT, segs=24, tube_segs=8).transform(t=(0, -0.13 - 0.045 * k, 0.003 * k)))
    leg.add(tube(np.array([[0, -0.12, 0], [0, -0.33, 0.01]]), 0.084, BLACK, segs=18))
    # white lace peeking out at the top of the leg warmers
    leg.add(lathe([(0.088, -0.1), (0.1, -0.12), (0.106, -0.135)], OFFWHITE, segs=48, material='double',
                  rmod=lambda th, k: 1 + 0.06 * math.sin(th * 18) * (k / 2)))
    # platform boots with buckled straps
    leg.add(ellipsoid((0.11, 0.08, 0.145), BLACK, segs=24, rings=14, center=(0, -0.36, 0.05)))
    leg.add(superellipsoid((0.124, 0.05, 0.174), BLACK_SHADE, e=0.35, center=(0, -0.415, 0.04)))
    leg.add(superellipsoid((0.126, 0.008, 0.176), srgb('#57525c'), e=0.3, center=(0, -0.38, 0.04)))
    for y, z in ((-0.33, 0.125), (-0.36, 0.14)):
        leg.add(superellipsoid((0.105, 0.012, 0.02), BLACK_LIGHT, e=0.3, center=(0, y, z * 0.6)))
        leg.add(superellipsoid((0.016, 0.014, 0.006), SILVER, e=0.3, center=(side * 0.085, y, z * 0.55)))
    return leg


def build_kira() -> Node:
    body = Node('body')
    body.add(kira_leg(-1), kira_leg(1))
    # black pleated skirt with a grey line and a lace ruffle, belt with a silver buckle
    pleats = 18
    prof = [(0.166, 0.565), (0.19, 0.51), (0.235, 0.44), (0.28, 0.37), (0.285, 0.35)]

    def rmod(th, k):
        saw = abs(((th * pleats / (2 * math.pi)) % 1) - 0.5) * 2
        return 1 + 0.08 * saw * (k / (len(prof) - 1))

    def scol(th, k):
        phase = (th * pleats / (2 * math.pi)) % 1
        if k == len(prof) - 1:
            return srgb('#6a6570')
        return BLACK_SHADE if phase < 0.25 else BLACK

    body.add(lathe(prof, BLACK, segs=pleats * 8, rmod=rmod, color_fn=scol, material='double'))
    body.add(lathe([(0.275, 0.36), (0.3, 0.33), (0.315, 0.31)], BLACK_LIGHT, segs=pleats * 8, material='double',
                   rmod=lambda th, k: 1 + 0.05 * math.sin(th * 44) * (k / 2)))
    body.add(torus(0.17, 0.02, BLACK_SHADE, segs=40, tube_segs=8).transform(t=(0, 0.555, 0)))
    body.add(superellipsoid((0.03, 0.024, 0.008), SILVER, e=0.3, center=(0, 0.555, 0.19)))
    # little silver chain swinging on the left of the skirt
    body.add(tube(bezier([[-0.15, 0.55, 0.11], [-0.2, 0.46, 0.14], [-0.22, 0.5, 0.05], [-0.18, 0.55, -0.02]], 16), 0.004, SILVER, segs=4))
    jacket_torso(body, 0.5, 0.42)
    # white shirt with a pointed collar and a black bow tie
    body.add(superellipsoid((0.075, 0.14, 0.022), OFFWHITE, e=0.5, center=(0, 0.64, 0.145)))
    for s in (-1, 1):
        body.add(superellipsoid((0.04, 0.025, 0.012), WHITE, e=0.4, center=(s * 0.035, 0.775, 0.12)).transform())
        body.add(ellipsoid((0.006, 0.006, 0.004), BLACK_SHADE, segs=6, rings=4, center=(0, 0.66 - 0.05 * (s + 1), 0.168)))
    for m in bow(0.85, BLACK, BLACK_SHADE):
        body.add(m.transform(rot_x(-0.25), t=(0, 0.75, 0.16)))
    backpack(body, keychain=True)
    body.add(sleeve_arm(-1, True), sleeve_arm(1, True), head_base(kira_hair(), False))
    return body


def write(name: str, body: Node) -> None:
    root = Node(name)
    root.add(body)
    out = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', f'{name}.glb')
    stats = write_glb(root, out)
    print(f"wrote {name}.glb: {stats['vertices']} vertices, {stats['triangles']} triangles, {stats['nodes']} nodes")


if __name__ == '__main__':
    write('kuro', build_kuro())
    write('kira', build_kira())
