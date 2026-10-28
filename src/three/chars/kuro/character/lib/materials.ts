import { toonMaterial } from '../../render/toon';
import { PALETTE } from '../palette';

/** Shared toon materials (created once, reused by every part). */
let cache: ReturnType<typeof create> | null = null;

function create() {
  return {
    skin: toonMaterial({ color: PALETTE.skin, shade: PALETTE.skinShade, threshold: 0.6, softness: 0.06, rim: 0.08 }),
    hair: toonMaterial({ color: PALETTE.hair, shade: PALETTE.hairShade, deep: PALETTE.hairDeep, threshold: 0.62, softness: 0.05, rim: 0.3, rimColor: PALETTE.hairHighlight }),
    dark: toonMaterial({ color: PALETTE.dark, shade: PALETTE.darkShade, threshold: 0.55, softness: 0.05, rim: 0.26, rimColor: PALETTE.blackHighlight }),
    cloth: toonMaterial({ color: PALETTE.cloth, shade: PALETTE.clothShade, threshold: 0.7, softness: 0.05, rim: 0.1 }),
    black: toonMaterial({ color: PALETTE.black, shade: PALETTE.blackShade, threshold: 0.5, rim: 0.18, rimColor: PALETTE.blackHighlight }),
    leather: toonMaterial({ color: '#25242b', shade: PALETTE.blackShade, threshold: 0.5, rim: 0.28, rimColor: PALETTE.blackHighlight }),
    metal: toonMaterial({ color: PALETTE.metal, shade: PALETTE.metalDark, threshold: 0.55, softness: 0.02, rim: 0.3 }),
  };
}

export function materials() {
  if (!cache) cache = create();
  return cache;
}

/** Outline widths used across parts (world units, see toon.ts). */
export const OUTLINE = {
  body: 0.0019,
  cloth: 0.0018,
  hair: 0.0014,
  detail: 0.0012,
  tiny: 0.0008,
} as const;
