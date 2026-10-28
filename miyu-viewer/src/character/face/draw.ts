import { PALETTE } from '../palette';
import { RIG } from '../rig';
import type { Expression } from '../types';

/**
 * Face texture painter. The canvas maps linearly onto the face plate:
 * world x ∈ [X0, X1], y ∈ [Y0, Y1] (front projection), so features are drawn in world units.
 */
export const PLATE = { x0: -0.128, x1: 0.128, y0: 0.582, y1: 0.742 } as const;
const PX = 4000; // canvas pixels per world unit
export const CANVAS_W = Math.round((PLATE.x1 - PLATE.x0) * PX);
export const CANVAS_H = Math.round((PLATE.y1 - PLATE.y0) * PX);

/** Eyes per reference/twintail.png: big, round, set a little higher and wider than RIG.eyeY. */
const EYE = { x: 0.077, y: 0.67, w: 0.075, h: 0.074 };
const MOUTH_Y = RIG.mouthY;
const LINE = PALETTE.lash;

type Ctx = CanvasRenderingContext2D;
const X = (x: number) => (x - PLATE.x0) * PX;
const Y = (y: number) => (PLATE.y1 - y) * PX;
const S = (d: number) => d * PX;

export interface FaceOptions {
  /** Draw both eyes closed (idle blink). */
  blink?: boolean;
  /** Talking mouth frame: 0 = the expression's own mouth, 1 = half open, 2 = open. */
  mouth?: 0 | 1 | 2;
}

/** Paints one expression onto a fresh canvas. */
export function paintFace(expr: Expression, opts: FaceOptions = {}): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const blushLevel = { normal: 0.95, smile: 0.98, wink: 0.95, surprised: 0.85, angry: 0.95, crying: 0.9, sleepy: 0.9, blush: 1 }[expr];
  blush(g, blushLevel, expr === 'blush' || expr === 'angry');
  nose(g);

  for (const side of [-1, 1] as const) {
    const ex = side * EYE.x;
    if (opts.blink) {
      closedEye(g, ex, side, 'down');
      continue;
    }
    switch (expr) {
      case 'smile':
        closedEye(g, ex, side, 'happy');
        break;
      case 'wink':
        if (side > 0) closedEye(g, ex, side, 'happy');
        else openEye(g, ex, side, {});
        break;
      case 'surprised':
        openEye(g, ex, side, { wide: true });
        break;
      case 'angry':
        openEye(g, ex, side, { lid: 0.42, lidTilt: 0.12 });
        break;
      case 'crying':
        openEye(g, ex, side, { teary: true, lid: 0.12, lidTilt: -0.12 });
        break;
      case 'sleepy':
        closedEye(g, ex, side, 'down');
        break;
      case 'blush':
        closedEye(g, ex, side, 'down');
        break;
      default:
        openEye(g, ex, side, {});
    }
  }
  if (expr === 'crying' && !opts.blink) tears(g);
  if (opts.mouth) talkMouth(g, opts.mouth);
  else mouth(g, expr);
  return c;
}

// ---------------------------------------------------------------------------------------------
// Eyes
// ---------------------------------------------------------------------------------------------

interface EyeOptions {
  wide?: boolean;
  /** Fraction of the eye covered by the upper lid (half-lidded looks). */
  lid?: number;
  /** Lid slant: positive lowers the inner corner (cross), negative the outer (sad). */
  lidTilt?: number;
  teary?: boolean;
  /** Horizontal gaze offset as a fraction of the eye width (+ toward her left). */
  look?: number;
}

/** Sclera outline path: flatter top, round bottom (anime style). */
function scleraPath(g: Ctx, cx: number, cy: number, w: number, h: number): void {
  const l = cx - w / 2, r = cx + w / 2, t = cy - h / 2, b = cy + h / 2;
  g.beginPath();
  g.moveTo(l, cy - h * 0.05);
  g.bezierCurveTo(l + w * 0.05, t + h * 0.02, r - w * 0.05, t - h * 0.02, r, cy - h * 0.08);
  g.bezierCurveTo(r + w * 0.02, cy + h * 0.35, cx + w * 0.3, b, cx, b);
  g.bezierCurveTo(cx - w * 0.3, b, l - w * 0.02, cy + h * 0.35, l, cy - h * 0.05);
  g.closePath();
}

/** Heart outline centered at (cx, cy) with full width `w`. */
function heartPath(g: Ctx, cx: number, cy: number, w: number): void {
  const h = w * 0.9;
  g.beginPath();
  g.moveTo(cx, cy + h * 0.5);
  g.bezierCurveTo(cx - w * 0.62, cy + h * 0.02, cx - w * 0.5, cy - h * 0.62, cx, cy - h * 0.2);
  g.bezierCurveTo(cx + w * 0.5, cy - h * 0.62, cx + w * 0.62, cy + h * 0.02, cx, cy + h * 0.5);
  g.closePath();
}

function openEye(g: Ctx, ex: number, side: number, o: EyeOptions): void {
  const k = o.wide ? 1.08 : 1;
  const w = S(EYE.w) * k, h = S(EYE.h) * k;
  const cx = X(ex), cy = Y(EYE.y);
  g.save();
  scleraPath(g, cx, cy, w, h);
  const sg = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  sg.addColorStop(0, '#d6d5e0');
  sg.addColorStop(0.4, '#ffffff');
  g.fillStyle = sg;
  g.fill();
  g.clip();

  // Iris: tall, nearly filling the eye; dark at the top fading to a light gray bottom.
  const irisW = w * (o.wide ? 0.62 : 0.82), irisH = h * (o.wide ? 0.66 : 0.94);
  const ix = cx + (o.look ?? 0) * w, iy = cy + h * (o.wide ? 0.04 : 0.07);
  const ig = g.createLinearGradient(0, iy - irisH / 2, 0, iy + irisH / 2);
  if (o.teary) {
    ig.addColorStop(0, '#4a5470');
    ig.addColorStop(0.5, '#6d7fa6');
    ig.addColorStop(1, '#bcd0ec');
  } else {
    ig.addColorStop(0, '#9c2f62');
    ig.addColorStop(0.5, '#d9558e');
    ig.addColorStop(1, '#fbb6d1');
  }
  g.fillStyle = ig;
  g.beginPath();
  g.ellipse(ix, iy, irisW / 2, irisH / 2, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(110,30,66,0.75)';
  g.lineWidth = S(0.0018);
  g.stroke();
  // Soft pupil, only a little darker than the iris top.
  const pw = irisW * (o.wide ? 0.26 : 0.36), ph = irisH * (o.wide ? 0.26 : 0.4);
  const pg = g.createRadialGradient(ix, iy - ph * 0.1, 0, ix, iy - ph * 0.1, ph / 2);
  pg.addColorStop(0, o.teary ? 'rgba(50,58,82,0.85)' : 'rgba(96,22,56,0.75)');
  pg.addColorStop(1, 'rgba(96,22,56,0)');
  g.fillStyle = pg;
  g.beginPath();
  g.ellipse(ix, iy - ph * 0.1, pw / 2, ph / 2, 0, 0, Math.PI * 2);
  g.fill();
  // Shadow from the lid across the top of the iris.
  const shade = g.createLinearGradient(0, cy - h / 2, 0, cy - h * 0.1);
  shade.addColorStop(0, 'rgba(80,20,48,0.4)');
  shade.addColorStop(1, 'rgba(80,20,48,0)');
  g.fillStyle = shade;
  g.fillRect(cx - w, cy - h / 2, w * 2, h * 0.4);

  // Highlights: a heart catch light in the pupil, a round one up top, a faint glint low on the iris.
  g.fillStyle = '#ffffff';
  heartPath(g, ix, iy + irisH * 0.02, irisW * 0.3);
  g.fill();
  g.beginPath();
  g.arc(ix + side * irisW * 0.2, iy - irisH * 0.26, irisW * 0.09, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.55;
  g.beginPath();
  g.ellipse(ix - side * irisW * 0.16, iy + irisH * 0.27, irisW * 0.07, irisH * 0.04, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  if (o.teary) {
    // Wet lower rim and extra glints.
    g.fillStyle = 'rgba(210,230,255,0.75)';
    g.beginPath();
    g.ellipse(cx, cy + h * 0.42, w * 0.46, h * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    for (const [dx, dy, r] of [[0.22, -0.05, 0.05], [-0.25, 0.18, 0.04], [0.05, 0.36, 0.035]]) {
      g.beginPath();
      g.arc(ix + irisW * dx, iy + irisH * dy, irisW * r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  // Upper lid (half-lidded looks): skin over the top of the eye with a straight lash line.
  const lid = o.lid ?? 0;
  const tilt = (o.lidTilt ?? 0) * h * side;
  const lidY = cy - h / 2 + h * lid;
  if (lid > 0) {
    g.save();
    scleraPath(g, cx, cy, w * 1.04, h * 1.04);
    g.clip();
    g.fillStyle = PALETTE.skin;
    g.beginPath();
    g.moveTo(cx - w, cy - h);
    g.lineTo(cx + w, cy - h);
    g.lineTo(cx + w, lidY + tilt);
    g.lineTo(cx - w, lidY - tilt);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = LINE;
    g.lineWidth = h * 0.09;
    g.beginPath();
    g.moveTo(cx - w * 0.52, lidY - tilt);
    g.lineTo(cx + w * 0.52, lidY + tilt);
    g.stroke();
  } else {
    upperLash(g, cx, cy, w, h, side);
  }

  // Lower lash: a short soft stroke at the outer corner.
  g.strokeStyle = 'rgba(60,58,70,0.8)';
  g.lineWidth = S(0.0014);
  g.beginPath();
  g.moveTo(cx + side * w * 0.12, cy + h * 0.5);
  g.quadraticCurveTo(cx + side * w * 0.38, cy + h * 0.44, cx + side * w * 0.5, cy + h * 0.24);
  g.stroke();
}

/**
 * Upper lash line wrapping the top of the eye: thin at the inner corner, heavy over the top and
 * down the outer side, ending in a small flick; a pale crease line floats above it.
 */
function upperLash(g: Ctx, cx: number, cy: number, w: number, h: number, side: number): void {
  const rx = w * 0.52, ry = h * 0.5, oy = cy + h * 0.08;
  // φ runs from the inner corner (π - 0.35) over the top and down the outer side (-0.5).
  const at = (phi: number, r: number) => [cx + side * rx * r * Math.cos(phi), oy - ry * r * Math.sin(phi)] as const;
  const a0 = Math.PI - 0.35, a1 = -0.5, n = 40;
  const thick = (p: number) => (0.09 + 0.21 * Math.pow(Math.min(1, p / 0.6), 0.7)) * (p > 0.85 ? 1 - 0.6 * ((p - 0.85) / 0.15) : 1);
  g.fillStyle = LINE;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const [x, y] = at(a0 + (a1 - a0) * p, 1 + thick(p));
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  // Flick out past the outer corner.
  const [fx, fy] = at(a1 + 0.12, 1.12);
  g.lineTo(fx + side * w * 0.12, fy - h * 0.02);
  for (let i = n; i >= 0; i--) {
    const [x, y] = at(a0 + (a1 - a0) * (i / n), 0.97);
    g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  // Crease line.
  g.strokeStyle = 'rgba(150,140,152,0.55)';
  g.lineWidth = S(0.0011);
  g.beginPath();
  for (let i = 0; i <= 20; i++) {
    const [x, y] = at(2.25 + (0.6 - 2.25) * (i / 20), 1.5);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

/** Closed eyes: 'happy' = ^ arcs (smile/wink), 'down' = relaxed ∪ arcs with lashes (sleepy/blink). */
function closedEye(g: Ctx, ex: number, side: number, kind: 'happy' | 'down'): void {
  const w = S(EYE.w), h = S(EYE.h);
  const cx = X(ex), cy = Y(EYE.y) + h * 0.12;
  g.strokeStyle = LINE;
  g.fillStyle = LINE;
  g.lineWidth = h * 0.085;
  g.beginPath();
  if (kind === 'happy') {
    g.moveTo(cx - w * 0.42, cy + h * 0.06);
    g.quadraticCurveTo(cx, cy - h * 0.36, cx + w * 0.42, cy + h * 0.06);
  } else {
    g.moveTo(cx - w * 0.44, cy - h * 0.06);
    g.quadraticCurveTo(cx, cy + h * 0.26, cx + w * 0.44, cy - h * 0.06);
  }
  g.stroke();
  // Lashes on the outer side.
  const outer = cx + side * w * 0.42;
  g.lineWidth = h * 0.04;
  for (let i = 0; i < 3; i++) {
    const x = outer - side * w * i * 0.14;
    const y = kind === 'happy' ? cy + h * 0.02 - i * h * 0.08 : cy - h * 0.02 + i * h * 0.07;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + side * w * 0.1, y + (kind === 'happy' ? h * 0.06 : h * 0.1));
    g.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Blush, nose, mouth, tears
// ---------------------------------------------------------------------------------------------

function blush(g: Ctx, level: number, hatchStrong: boolean): void {
  for (const side of [-1, 1]) {
    const cx = X(side * 0.09), cy = Y(0.636);
    const rx = S(0.036) * (0.9 + level * 0.2), ry = S(0.016) * (0.9 + level * 0.3);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    const strong = level >= 1;
    grad.addColorStop(0, strong ? `rgba(236,110,130,${0.85})` : `rgba(244,174,182,${0.75 * level})`);
    grad.addColorStop(0.6, strong ? 'rgba(240,140,155,0.55)' : `rgba(244,174,182,${0.35 * level})`);
    grad.addColorStop(1, 'rgba(244,174,182,0)');
    g.save();
    g.setTransform(1, 0, 0, ry / rx, 0, cy - (cy * ry) / rx);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Diagonal hatch lines only when flustered; the calm face is a plain soft blush.
    if (!hatchStrong) continue;
    g.strokeStyle = 'rgba(200,70,95,0.8)';
    g.lineWidth = S(0.0011);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * S(0.008);
      g.beginPath();
      g.moveTo(x + S(0.003), cy - S(0.006));
      g.lineTo(x - S(0.003), cy + S(0.006));
      g.stroke();
    }
  }
}

function nose(g: Ctx): void {
  g.strokeStyle = 'rgba(214,160,160,0.7)';
  g.lineWidth = S(0.0011);
  g.beginPath();
  g.moveTo(X(0.001), Y(0.637));
  g.lineTo(X(-0.0015), Y(0.6335));
  g.stroke();
}

function mouth(g: Ctx, expr: Expression): void {
  const cx = X(0), cy = Y(MOUTH_Y);
  const line = '#6e4a52';
  g.strokeStyle = line;
  g.lineWidth = S(0.0014);
  g.beginPath();
  switch (expr) {
    case 'smile': {
      // Small open smile: D shape with a pink tongue.
      g.moveTo(cx - S(0.009), cy - S(0.002));
      g.quadraticCurveTo(cx, cy + S(0.002), cx + S(0.009), cy - S(0.002));
      g.quadraticCurveTo(cx + S(0.006), cy + S(0.012), cx, cy + S(0.012));
      g.quadraticCurveTo(cx - S(0.006), cy + S(0.012), cx - S(0.009), cy - S(0.002));
      g.fillStyle = '#a7505f';
      g.fill();
      g.stroke();
      g.fillStyle = '#ef9aa8';
      g.beginPath();
      g.ellipse(cx, cy + S(0.009), S(0.004), S(0.0025), 0, 0, Math.PI * 2);
      g.fill();
      fang(g, cx + S(0.0052), cy - S(0.0006));
      return;
    }
    case 'surprised':
      g.ellipse(cx, cy + S(0.002), S(0.0045), S(0.006), 0, 0, Math.PI * 2);
      g.fillStyle = '#8e4655';
      g.fill();
      g.stroke();
      return;
    case 'wink':
      g.moveTo(cx - S(0.007), cy - S(0.001));
      g.quadraticCurveTo(cx, cy + S(0.006), cx + S(0.007), cy - S(0.001));
      break;
    case 'angry':
      // Puffed pout: small wavy frown.
      g.moveTo(cx - S(0.007), cy + S(0.003));
      g.bezierCurveTo(cx - S(0.003), cy - S(0.003), cx + S(0.001), cy + S(0.002), cx + S(0.007), cy + S(0.001));
      break;
    case 'crying':
      g.moveTo(cx - S(0.009), cy + S(0.004));
      g.bezierCurveTo(cx - S(0.005), cy - S(0.004), cx - S(0.001), cy + S(0.003), cx + S(0.002), cy - S(0.001));
      g.quadraticCurveTo(cx + S(0.006), cy - S(0.004), cx + S(0.009), cy + S(0.004));
      break;
    case 'sleepy':
      g.ellipse(cx, cy + S(0.001), S(0.003), S(0.0022), 0, 0, Math.PI * 2);
      g.fillStyle = '#b06a78';
      g.fill();
      break;
    case 'blush':
      g.moveTo(cx - S(0.009), cy + S(0.001));
      g.bezierCurveTo(cx - S(0.006), cy - S(0.004), cx - S(0.002), cy + S(0.004), cx, cy);
      g.bezierCurveTo(cx + S(0.002), cy - S(0.004), cx + S(0.006), cy + S(0.004), cx + S(0.009), cy - S(0.001));
      break;
    default: {
      // Miyu's cheerful resting face: a small open cat smile with one little fang.
      g.moveTo(cx - S(0.0075), cy - S(0.0015));
      g.quadraticCurveTo(cx, cy + S(0.0015), cx + S(0.0075), cy - S(0.0015));
      g.quadraticCurveTo(cx + S(0.005), cy + S(0.0095), cx, cy + S(0.0095));
      g.quadraticCurveTo(cx - S(0.005), cy + S(0.0095), cx - S(0.0075), cy - S(0.0015));
      g.fillStyle = '#a7505f';
      g.fill();
      g.stroke();
      g.fillStyle = '#ef9aa8';
      g.beginPath();
      g.ellipse(cx, cy + S(0.0072), S(0.0033), S(0.002), 0, 0, Math.PI * 2);
      g.fill();
      fang(g, cx + S(0.0045), cy - S(0.0004));
      return;
    }
  }
  g.stroke();
}

/** One small white fang hanging from the upper lip at (x, y). */
function fang(g: Ctx, x: number, y: number): void {
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#6e4a52';
  g.lineWidth = S(0.0008);
  g.beginPath();
  g.moveTo(x - S(0.0018), y);
  g.lineTo(x + S(0.0016), y + S(0.0002));
  g.lineTo(x, y + S(0.0034));
  g.closePath();
  g.fill();
  g.stroke();
}

/** Open mouth for speech: a small rounded opening with a hint of tongue. */
function talkMouth(g: Ctx, frame: 1 | 2): void {
  const cx = X(0), cy = Y(MOUTH_Y) + S(0.002);
  const rx = S(frame === 2 ? 0.0068 : 0.0058), ry = S(frame === 2 ? 0.0068 : 0.0035);
  g.fillStyle = '#8e4655';
  g.strokeStyle = '#6e4a52';
  g.lineWidth = S(0.0013);
  g.beginPath();
  g.moveTo(cx - rx, cy - ry * 0.35);
  g.quadraticCurveTo(cx, cy - ry * 0.9, cx + rx, cy - ry * 0.35);
  g.quadraticCurveTo(cx + rx * 0.9, cy + ry, cx, cy + ry);
  g.quadraticCurveTo(cx - rx * 0.9, cy + ry, cx - rx, cy - ry * 0.35);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = '#ef9aa8';
  g.beginPath();
  g.ellipse(cx, cy + ry * 0.85, rx * 0.6, ry * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.stroke();
}

function tears(g: Ctx): void {
  for (const side of [-1, 1]) {
    const x0 = X(side * (EYE.x + EYE.w * 0.22)), y0 = Y(EYE.y - EYE.h * 0.42);
    const grad = g.createLinearGradient(0, y0, 0, y0 + S(0.06));
    grad.addColorStop(0, 'rgba(190,220,255,0.95)');
    grad.addColorStop(1, 'rgba(190,220,255,0.15)');
    g.fillStyle = grad;
    g.strokeStyle = 'rgba(120,150,200,0.8)';
    g.lineWidth = S(0.0009);
    g.beginPath();
    g.moveTo(x0 - S(0.006), y0);
    g.bezierCurveTo(x0 - S(0.004), y0 + S(0.03), x0 + side * S(0.004), y0 + S(0.045), x0 + side * S(0.002), y0 + S(0.062));
    g.bezierCurveTo(x0 + side * S(0.009), y0 + S(0.045), x0 + S(0.006), y0 + S(0.02), x0 + S(0.006), y0);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Effect symbols (drawn as dark-gray line art like the reference sheet)
// ---------------------------------------------------------------------------------------------

export type EffectKind = 'exclaim' | 'note' | 'sweat' | 'anger' | 'question' | 'zzz' | 'heart';

export function paintEffect(kind: EffectKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#3a3842';
  g.fillStyle = '#3a3842';
  g.lineWidth = 12;
  g.font = 'bold 150px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // White halo so symbols read on white hair.
  const withHalo = (draw: () => void) => {
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 30;
    draw();
    g.restore();
    draw();
  };
  switch (kind) {
    case 'exclaim':
      withHalo(() => {
        g.strokeText('!?', 128, 132);
        g.fillText('!?', 128, 132);
      });
      break;
    case 'question':
      withHalo(() => {
        g.strokeText('?', 150, 128);
        g.fillText('?', 150, 128);
        g.beginPath();
        g.arc(70, 120, 26, Math.PI * 1.1, Math.PI * 2.1);
        g.stroke();
      });
      break;
    case 'note':
      withHalo(() => {
        g.beginPath();
        g.ellipse(92, 180, 30, 22, -0.4, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(118, 176);
        g.lineTo(118, 50);
        g.quadraticCurveTo(170, 70, 190, 120);
        g.stroke();
      });
      break;
    case 'sweat':
      withHalo(() => {
        for (const [x, y, s] of [[90, 110, 1], [165, 150, 0.75]]) {
          g.beginPath();
          g.moveTo(x, y - 50 * s);
          g.bezierCurveTo(x + 32 * s, y, x + 26 * s, y + 34 * s, x, y + 34 * s);
          g.bezierCurveTo(x - 26 * s, y + 34 * s, x - 32 * s, y, x, y - 50 * s);
          g.stroke();
        }
      });
      break;
    case 'anger':
      withHalo(() => {
        for (const [rx, ry] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          g.beginPath();
          g.moveTo(128 + rx * 22, 128 + ry * 70);
          g.quadraticCurveTo(128 + rx * 22, 128 + ry * 22, 128 + rx * 70, 128 + ry * 22);
          g.stroke();
        }
      });
      break;
    case 'zzz':
      withHalo(() => {
        const z = (x: number, y: number, s: number) => {
          g.beginPath();
          g.moveTo(x - 24 * s, y - 24 * s);
          g.lineTo(x + 24 * s, y - 24 * s);
          g.lineTo(x - 24 * s, y + 24 * s);
          g.lineTo(x + 24 * s, y + 24 * s);
          g.stroke();
        };
        z(80, 180, 1.2);
        z(150, 115, 0.95);
        z(205, 60, 0.7);
      });
      break;
    case 'heart':
      withHalo(() => {
        g.beginPath();
        g.moveTo(128, 200);
        g.bezierCurveTo(30, 140, 50, 50, 128, 95);
        g.bezierCurveTo(206, 50, 226, 140, 128, 200);
        g.stroke();
      });
      break;
  }
  return c;
}
