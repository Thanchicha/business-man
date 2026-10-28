import { toonMaterial } from '../../render/toon';
import { PALETTE } from '../palette';

/** Shared toon materials for the model being built (rebuilt per look, see `resetMaterials`). */
let cache: ReturnType<typeof create> | null = null;

function create() {
  const cloth = (color: string, shade: string, threshold = 0.6) => toonMaterial({ color, shade, threshold, softness: 0.05, rim: 0.14 });
  return {
    hair: toonMaterial({ color: PALETTE.hair, shade: PALETTE.hairShade, deep: PALETTE.hairDeep, threshold: 0.62, softness: 0.05, rim: 0.3, rimColor: PALETTE.hairHighlight }),
    top: cloth(PALETTE.top, PALETTE.topShade),
    inner: cloth(PALETTE.inner, PALETTE.innerShade, 0.7),
    bottom: cloth(PALETTE.bottom, PALETTE.bottomShade, 0.55),
    shoe: cloth(PALETTE.shoe, PALETTE.shoeShade, 0.55),
    accent: cloth(PALETTE.accent, PALETTE.accentShade),
    ear: toonMaterial({ color: PALETTE.ear, shade: PALETTE.earShade, threshold: 0.62, softness: 0.05, rim: 0.2 }),
    cloth: toonMaterial({ color: PALETTE.cloth, shade: PALETTE.clothShade, threshold: 0.7, softness: 0.05, rim: 0.1 }),
    dark: toonMaterial({ color: PALETTE.dark, shade: PALETTE.darkShade, threshold: 0.55, softness: 0.05, rim: 0.26, rimColor: PALETTE.blackHighlight }),
  };
}

export function materials() {
  if (!cache) cache = create();
  return cache;
}

export function resetMaterials(): void {
  cache = null;
}

/** Outline widths used across parts (world units, see toon.ts). */
export const OUTLINE = {
  body: 0.0019,
  cloth: 0.0018,
  hair: 0.0014,
  detail: 0.0012,
  tiny: 0.0008,
} as const;
