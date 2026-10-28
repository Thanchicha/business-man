import * as THREE from 'three';
import type { LookColors } from './looks';

const BASE = {
  hair: '#8a5f45',
  hairShade: '#5e3f2e',
  hairDeep: '#3b271c',
  hairHighlight: '#c99a78',
  dark: '#2c2a32',
  darkShade: '#18171c',
  cloth: '#f7f6f8',
  clothShade: '#d3d1dc',
  black: '#1d1c22',
  blackShade: '#0f0e13',
  blackHighlight: '#4a4854',
  metal: '#d9dae0',
  metalDark: '#7d7e88',
  skin: '#fdf1ec',
  skinShade: '#f2d3d0',
  blush: '#f4aeb6',
  iris: '#7b5236',
  irisLight: '#c99c74',
  pupil: '#2e1f18',
  lash: '#3a2a24',
  line: '#3a3842',
  top: '#ff9a52',
  topShade: '#e0733a',
  inner: '#ffffff',
  innerShade: '#d3d1dc',
  bottom: '#46557d',
  bottomShade: '#2d3856',
  shoe: '#ff7a6b',
  shoeShade: '#d55447',
  accent: '#ffffff',
  accentShade: '#d3d1dc',
  ear: '#8a5f45',
  earShade: '#5e3f2e',
};

/**
 * Colours the shared face, body and materials read. They change per look: `applyLook` rewrites
 * them right before a model is built (models are built one at a time, then cloned).
 */
export const PALETTE: Record<keyof typeof BASE, string> = { ...BASE };

const hex = (c: THREE.Color) => `#${c.getHexString()}`;
const darker = (c: string, by: number) => hex(new THREE.Color(c).offsetHSL(0, 0.02, -by));
const lighter = (c: string, k: number) => hex(new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k));

export function applyLook(c: LookColors): void {
  Object.assign(PALETTE, BASE);
  PALETTE.skin = c.skin;
  PALETTE.skinShade = hex(new THREE.Color(c.skin).lerp(new THREE.Color('#e3a8a4'), 0.3));
  PALETTE.hair = c.hair;
  PALETTE.hairShade = darker(c.hair, 0.14);
  PALETTE.hairDeep = darker(c.hair, 0.26);
  PALETTE.hairHighlight = lighter(c.hair, 0.4);
  PALETTE.ear = c.ear ?? c.hair;
  PALETTE.earShade = darker(c.ear ?? c.hair, 0.14);
  PALETTE.iris = c.iris;
  PALETTE.irisLight = lighter(c.iris, 0.45);
  PALETTE.pupil = darker(c.iris, 0.3);
  for (const k of ['top', 'inner', 'bottom', 'shoe', 'accent'] as const) {
    PALETTE[k] = c[k];
    PALETTE[`${k}Shade` as keyof typeof BASE] = darker(c[k], 0.12);
  }
}
