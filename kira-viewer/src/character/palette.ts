/** Shared color palette (sRGB hex). See SPEC.md §1. */
export const PALETTE = {
  // Kira: very dark brown hair with soft mauve shading.
  hair: '#3d3238',
  hairShade: '#261e23',
  hairDeep: '#161114',
  hairHighlight: '#76656d',
  /** Black fabric (jacket, leg warmers, boots): a touch lighter than the leather blacks so folds read. */
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
  iris: '#5d5c66',
  irisLight: '#a9a8b3',
  pupil: '#2b2a31',
  lash: '#24232a',
  line: '#3a3842',
} as const;
