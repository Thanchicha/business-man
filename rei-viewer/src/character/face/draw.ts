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

/** Eyes: placed like the cast's; `open` is Rei's narrow, sharp eye opening (about half the girls' height). */
const EYE = { x: 0.077, y: 0.668, w: 0.078, h: 0.074, open: 0.036 };
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

  const blushLevel = { normal: 0.55, smile: 0.75, wink: 0.7, surprised: 0.5, angry: 0.7, crying: 0.65, sleepy: 0.55, blush: 1 }[expr];
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

/**
 * Rei's sclera outline: a narrow, angular, upturned (tsurime) almond — a nearly straight upper
 * lid rising to a sharp outer corner, a flatter lower lid, and a pointed inner corner.
 * `side` mirrors it so the outer corner is always toward the temple.
 */
function scleraPath(g: Ctx, cx: number, cy: number, w: number, h: number, side: number): void {
  const px = (u: number) => cx + side * u * w; // u: −0.5 inner corner … 0.5 outer corner
  g.beginPath();
  g.moveTo(px(-0.5), cy + h * 0.12);
  // Upper lid: a straight rising line with a slight break, then a sharp outer corner.
  g.lineTo(px(-0.3), cy - h * 0.32);
  g.lineTo(px(0.28), cy - h * 0.55);
  g.lineTo(px(0.52), cy - h * 0.42);
  // Lower lid: angular, flatter, meeting the outer corner at a point.
  g.lineTo(px(0.4), cy + h * 0.2);
  g.quadraticCurveTo(px(0.05), cy + h * 0.6, px(-0.32), cy + h * 0.45);
  g.closePath();
}

function openEye(g: Ctx, ex: number, side: number, o: EyeOptions): void {
  const k = o.wide ? 1.08 : 1;
  // w/h size the iris (same as the rest of the cast); `oh` is Rei's narrower eye opening.
  const w = S(EYE.w) * k, h = S(EYE.h) * k;
  const oh = S(EYE.open) * (o.wide ? 1.45 : 1);
  const cx = X(ex), cy = Y(EYE.y);
  g.save();
  scleraPath(g, cx, cy, w, oh, side);
  const sg = g.createLinearGradient(0, cy - oh / 2, 0, cy + oh / 2);
  sg.addColorStop(0, '#cfcedb');
  sg.addColorStop(0.5, '#ffffff');
  g.fillStyle = sg;
  g.fill();
  g.clip();

  // Iris: as big as the cast's, but the narrow lids crop its top and bottom.
  const irisW = w * (o.wide ? 0.6 : 0.7), irisH = h * (o.wide ? 0.62 : 0.78);
  const ix = cx + ((o.look ?? 0) + side * 0.02) * w, iy = cy + oh * (o.wide ? 0.05 : 0.14);
  const ig = g.createLinearGradient(0, iy - irisH / 2, 0, iy + irisH / 2);
  if (o.teary) {
    ig.addColorStop(0, '#4a5470');
    ig.addColorStop(0.5, '#6d7fa6');
    ig.addColorStop(1, '#bcd0ec');
  } else {
    ig.addColorStop(0.2, '#3e3d45');
    ig.addColorStop(0.55, '#6c6b74');
    ig.addColorStop(0.8, '#b4b3bc');
  }
  g.fillStyle = ig;
  g.beginPath();
  g.ellipse(ix, iy, irisW / 2, irisH / 2, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(40,39,46,0.7)';
  g.lineWidth = S(0.0016);
  g.stroke();
  const pw = irisW * (o.wide ? 0.24 : 0.32), ph = irisH * (o.wide ? 0.24 : 0.34);
  const pg = g.createRadialGradient(ix, iy - ph * 0.1, 0, ix, iy - ph * 0.1, ph / 2);
  pg.addColorStop(0, o.teary ? 'rgba(50,58,82,0.85)' : 'rgba(40,39,46,0.85)');
  pg.addColorStop(1, 'rgba(40,39,46,0)');
  g.fillStyle = pg;
  g.beginPath();
  g.ellipse(ix, iy - ph * 0.1, pw / 2, ph / 2, 0, 0, Math.PI * 2);
  g.fill();
  // Shadow from the upper lid across the top of the iris.
  const shade = g.createLinearGradient(0, cy - oh * 0.6, 0, cy);
  shade.addColorStop(0, 'rgba(36,35,42,0.5)');
  shade.addColorStop(1, 'rgba(36,35,42,0)');
  g.fillStyle = shade;
  g.fillRect(cx - w, cy - oh, w * 2, oh);

  // Highlights: a small sharp catch light just under the lid, a faint glint low on the iris.
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(ix + side * irisW * 0.12, cy - oh * 0.12, irisW * 0.085, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.45;
  g.beginPath();
  g.ellipse(ix - side * irisW * 0.14, cy + oh * 0.32, irisW * 0.06, oh * 0.06, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  if (o.teary) {
    // Wet lower rim and extra glints.
    g.fillStyle = 'rgba(210,230,255,0.75)';
    g.beginPath();
    g.ellipse(cx, cy + oh * 0.42, w * 0.46, oh * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    for (const [dx, dy, r] of [[0.22, -0.05, 0.05], [-0.25, 0.1, 0.04]]) {
      g.beginPath();
      g.arc(ix + irisW * dx, cy + oh * dy, irisW * r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  // Lowered upper lid (sulky / sad looks): skin over the top of the opening, flat lid line.
  const lid = o.lid ?? 0;
  const tilt = (o.lidTilt ?? 0) * oh * side;
  const lidY = cy - oh * 0.55 + oh * 1.1 * lid;
  if (lid > 0) {
    g.save();
    scleraPath(g, cx, cy, w * 1.04, oh * 1.08, side);
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
    g.lineWidth = S(0.003);
    g.beginPath();
    g.moveTo(cx - w * 0.5, lidY - tilt);
    g.lineTo(cx + w * 0.5, lidY + tilt);
    g.stroke();
  } else {
    upperLid(g, cx, cy, w, oh, side);
  }

  // Lower lid: a faint thin line along the outer half only.
  g.strokeStyle = 'rgba(60,58,70,0.45)';
  g.lineWidth = S(0.0011);
  g.beginPath();
  g.moveTo(cx + side * w * 0.05, cy + oh * 0.52);
  g.quadraticCurveTo(cx + side * w * 0.3, cy + oh * 0.42, cx + side * w * 0.4, cy + oh * 0.2);
  g.stroke();
}

/**
 * Rei's upper lid: no lashes — one thin dark line along the angular top edge, a touch heavier
 * toward the sharp outer corner and running just past it; a faint crease floats above.
 */
function upperLid(g: Ctx, cx: number, cy: number, w: number, h: number, side: number): void {
  const px = (u: number) => cx + side * u * w;
  g.strokeStyle = LINE;
  g.lineCap = 'round';
  g.lineJoin = 'miter';
  g.lineWidth = S(0.0026);
  g.beginPath();
  g.moveTo(px(-0.5), cy + h * 0.12);
  g.lineTo(px(-0.3), cy - h * 0.32);
  g.lineTo(px(0.28), cy - h * 0.55);
  g.stroke();
  g.lineWidth = S(0.0034);
  g.beginPath();
  g.moveTo(px(0.2), cy - h * 0.53);
  g.lineTo(px(0.28), cy - h * 0.55);
  g.lineTo(px(0.56), cy - h * 0.44);
  g.stroke();
  g.lineJoin = 'round';
  // Crease.
  g.strokeStyle = 'rgba(150,140,152,0.45)';
  g.lineWidth = S(0.001);
  g.beginPath();
  g.moveTo(px(-0.2), cy - h * 0.75);
  g.lineTo(px(0.38), cy - h * 0.95);
  g.stroke();
}

/** Closed eyes, no lashes: 'happy' = a flat angular ^ (smile/wink), 'down' = a slanted line (sleepy/blink). */
function closedEye(g: Ctx, ex: number, side: number, kind: 'happy' | 'down'): void {
  const w = S(EYE.w), oh = S(EYE.open);
  const cx = X(ex), cy = Y(EYE.y) + oh * 0.2;
  const px = (u: number) => cx + side * u * w;
  g.strokeStyle = LINE;
  g.lineWidth = S(0.0028);
  g.lineJoin = 'miter';
  g.beginPath();
  if (kind === 'happy') {
    g.moveTo(px(-0.42), cy + oh * 0.25);
    g.lineTo(px(0.05), cy - oh * 0.45);
    g.lineTo(px(0.46), cy - oh * 0.05);
  } else {
    g.moveTo(px(-0.44), cy + oh * 0.05);
    g.quadraticCurveTo(px(0.0), cy + oh * 0.45, px(0.48), cy - oh * 0.3);
  }
  g.stroke();
  g.lineJoin = 'round';
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
    default:
      // Tiny neutral, slightly downturned.
      g.moveTo(cx - S(0.0045), cy + S(0.001));
      g.quadraticCurveTo(cx, cy - S(0.0012), cx + S(0.0045), cy + S(0.001));
  }
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
