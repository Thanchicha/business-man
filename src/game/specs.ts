import { rng } from '../sim/rng';
import { LOOKS, rivalOwner, type ExtraLook } from '../three/chars/extra/character/looks';

export type Expr = 'normal' | 'happy' | 'surprised' | 'think' | 'sad' | 'annoyed' | 'wink';
export type Dir = 'down' | 'left' | 'right' | 'up';

/** Describes a chibi character. The 3D builder assembles it from simple rounded shapes. */
export interface CharSpec {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairStyle: 'short' | 'messy' | 'bob' | 'long';
  ears?: { style: 'cat' | 'bear'; color: string; inner: string };
  bow?: string;
  glasses?: string;
  eye: string;
  top: string;
  topShade: string;
  topStyle: 'track' | 'sweater' | 'stripe' | 'hoodie' | 'shirt';
  accent: string;
  bottom: string;
  bottomShade: string;
  bottomStyle: 'pants' | 'skirt' | 'shorts';
  legs?: string;
  shoes: string;
  choker?: string;
  /** Cat tail colour, with an optional bow. */
  tail?: { color: string; bow?: string };
  chunkyBoots?: boolean;
  /** Rigged background-cast model (instead of the simple chibi) with this look. */
  extra?: ExtraLook;
}

const SKIN = '#ffe3d6';
const SKIN_SHADE = '#f5c6b4';

/** Player (male): messy black hair, glasses, black track suit with white stripes. */
export const PLAYER_M: CharSpec = {
  skin: SKIN,
  skinShade: SKIN_SHADE,
  hair: '#2a2530',
  hairShade: '#16131a',
  hairStyle: 'messy',
  glasses: '#1a161d',
  eye: '#4a3b4f',
  top: '#2e2a33',
  topShade: '#1d1a21',
  topStyle: 'track',
  accent: '#f4f0f6',
  bottom: '#2e2a33',
  bottomShade: '#1d1a21',
  bottomStyle: 'pants',
  shoes: '#f4f1f5',
};

/** Player (female): same outfit with long hair. */
export const PLAYER_F: CharSpec = { ...PLAYER_M, hairStyle: 'long' };

/** MIYU the advisor: pink bob, cat ears, glasses, bell choker, pleated skirt, tail with a bow. */
export const ADVISOR: CharSpec = {
  skin: SKIN,
  skinShade: SKIN_SHADE,
  hair: '#ffc0d8',
  hairShade: '#f49cc0',
  hairStyle: 'bob',
  ears: { style: 'cat', color: '#ffc0d8', inner: '#ff8fb8' },
  bow: '#ff8fc0',
  eye: '#e0577f',
  top: '#fffafc',
  topShade: '#f2dbe6',
  topStyle: 'sweater',
  accent: '#ff9cc4',
  bottom: '#ffb3d0',
  bottomShade: '#f08db5',
  bottomStyle: 'skirt',
  legs: '#fff8fb',
  shoes: '#f6dce8',
  choker: '#2a2328',
  tail: { color: '#ffc0d8', bow: '#ff8fc0' },
  chunkyBoots: true,
};

/** Shion and Rei: cover-art characters with their own rigged models. */
export const SHION: CharSpec = { ...PLAYER_F, hairStyle: 'bob', hair: '#f4eef6' };
export const REI: CharSpec = { ...PLAYER_M, hair: '#26242c' };

/** Simple chibi stand-in for a background-cast look, used until its rigged model is built. */
export function extraSpec(look: ExtraLook): CharSpec {
  const c = look.colors;
  const hairStyle = look.hair === 'long' ? 'long' : 'short';
  return {
    skin: c.skin,
    skinShade: c.skin,
    hair: c.hair,
    hairShade: c.hair,
    hairStyle,
    glasses: look.glasses ? '#3a2a35' : undefined,
    eye: c.iris,
    top: c.top,
    topShade: c.top,
    topStyle: look.top === 'tee' ? 'stripe' : 'shirt',
    accent: c.accent,
    bottom: c.bottom,
    bottomShade: c.bottom,
    bottomStyle: look.bottom,
    shoes: c.shoe,
    extra: look,
  };
}


const EXTRA_CAST: Record<string, CharSpec> = Object.fromEntries(Object.entries(LOOKS).map(([k, l]) => ['extra_' + k, extraSpec(l)]));
const person = (id: string): CharSpec => EXTRA_CAST['extra_' + id];

/** Regulars: the sleepy white cat boy and the shy girl with black cat ears. */
export const CUSTOMER_SLEEPY: CharSpec = person('regular_sleepy');
export const CUSTOMER_SHY: CharSpec = person('regular_shy');

/** Who lives, studies and works in each area: look id and how common they are. */
export const CROWD: Record<string, [string, number][]> = {
  university: [['uni_boy', 3], ['uni_girl', 3], ['student_boy', 2], ['student_girl', 2], ['part_timer', 0.6], ['office_man', 0.3]],
  village: [['elder', 2], ['grandma', 2], ['parent_dad', 2], ['parent_mom', 2], ['kid', 2], ['kid_girl', 2], ['uni_girl', 0.4]],
  office: [['office_man', 3], ['office_woman', 3], ['part_timer', 0.6], ['uni_boy', 0.3]],
  bts: [['office_man', 2], ['office_woman', 2], ['uni_boy', 1.2], ['uni_girl', 1.2], ['student_boy', 1], ['elder', 0.4], ['influencer', 0.5]],
  mall: [['influencer', 2], ['kid', 1], ['kid_girl', 1], ['parent_dad', 1], ['parent_mom', 1], ['uni_boy', 1], ['uni_girl', 1], ['office_woman', 1], ['office_man', 1], ['elder', 0.8], ['grandma', 0.8], ['student_girl', 1]],
};

/** Customer groups: who a student, a worker or a family looks like. */
const SEGMENT_LOOKS: Record<string, [string, number][]> = {
  student: [['uni_boy', 3], ['uni_girl', 3], ['student_boy', 2], ['student_girl', 2]],
  worker: [['office_man', 3], ['office_woman', 3], ['part_timer', 1]],
  family: [['parent_dad', 2], ['parent_mom', 2], ['kid', 2], ['kid_girl', 2], ['elder', 1], ['grandma', 1]],
};

function pickWeighted(table: [string, number][], roll: number): string {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [id, w] of table) {
    acc += w / total;
    if (roll < acc) return id;
  }
  return table[table.length - 1][0];
}

/** Someone walking around an area, drawn from that area's crowd. */
export function crowdFor(locId: string, seed: number): CharSpec {
  const table = CROWD[locId] ?? CROWD.mall;
  return person(pickWeighted(table, rng(seed * 6271 + 5)()));
}

/** A customer of a group, at a shop in an area (influencers like the mall and the BTS). */
export function customerSpec(seed: number, segment?: string, locId?: string): CharSpec {
  const r = rng(seed * 4231 + 11);
  if (!segment) return locId ? crowdFor(locId, seed) : person(pickWeighted(CROWD.mall, r()));
  if ((locId === 'mall' || locId === 'bts') && segment !== 'worker' && r() < (locId === 'mall' ? 0.22 : 0.1)) return person('influencer');
  return person(pickWeighted(SEGMENT_LOOKS[segment] ?? SEGMENT_LOOKS.student, r()));
}

/** Owner of a rival shop, wearing the shop's colour. */
const rivalCache = new Map<string, CharSpec>();
export function rivalOwnerSpec(shopColor: string): CharSpec {
  if (!rivalCache.has(shopColor)) rivalCache.set(shopColor, extraSpec(rivalOwner(shopColor)));
  return rivalCache.get(shopColor)!;
}

export const CAST: Record<string, CharSpec> = {
  shion: SHION,
  rei: REI,
  player_m: PLAYER_M,
  player_f: PLAYER_F,
  advisor: ADVISOR,
  ...EXTRA_CAST,
  cust_sleepy: CUSTOMER_SLEEPY,
  cust_shy: CUSTOMER_SHY,
};
const HAIRS: [string, string][] = [
  ['#5a3e34', '#3d2a22'],
  ['#9a6a48', '#77503a'],
  ['#f0cc8a', '#d4ac62'],
  ['#8a96e0', '#6a74c0'],
  ['#a6d9be', '#7cbb9b'],
  ['#f5ae70', '#d88a4a'],
  ['#34323f', '#1f1e28'],
  ['#cfaaf0', '#ae84d2'],
];
const TOPS: [string, string, string][] = [
  ['#8fd0f8', '#6cb0dc', '#ffffff'],
  ['#ffd97e', '#e8bc55', '#ffffff'],
  ['#ade6cb', '#86c9a9', '#ffffff'],
  ['#f8b2c0', '#e38da2', '#ffffff'],
  ['#cbbaf3', '#a993d9', '#ffeaf3'],
  ['#ffaa88', '#e48a66', '#fff1e8'],
  ['#ece7df', '#d3cbbf', '#857a6e'],
];
const BOTTOMS: [string, string][] = [
  ['#5a6a8c', '#435070'],
  ['#3a363e', '#26232a'],
  ['#d3bd96', '#b39d76'],
  ['#7a9c6c', '#5f8253'],
];
const EYES = ['#5a3f35', '#3d5ea8', '#5c8a4a', '#8a4fa8', '#3a3a3a'];
const SKINS: [string, string][] = [
  [SKIN, SKIN_SHADE],
  ['#f6d1b5', '#e2b394'],
  ['#e6b893', '#cf9b74'],
];

/** A random-looking but deterministic customer. */
export function randomCustomer(seed: number): CharSpec {
  const r = rng(seed * 7919 + 13);
  const pick = <T>(a: T[]): T => a[Math.floor(r() * a.length)];
  const [hair, hairShade] = pick(HAIRS);
  const [top, topShade, accent] = pick(TOPS);
  const [bottom, bottomShade] = pick(BOTTOMS);
  const [skin, skinShade] = pick(SKINS);
  const skirt = r() < 0.3;
  const earRoll = r();
  return {
    skin,
    skinShade,
    hair,
    hairShade,
    hairStyle: pick(['short', 'messy', 'bob', 'long'] as const),
    ears: earRoll < 0.18 ? { style: 'cat', color: hair, inner: '#ffb3c8' } : earRoll < 0.3 ? { style: 'bear', color: hair, inner: hairShade } : undefined,
    bow: r() < 0.2 ? pick(['#ff7eb6', '#7fc8f8', '#ffd36e']) : undefined,
    glasses: r() < 0.2 ? '#3a2a35' : undefined,
    eye: pick(EYES),
    top,
    topShade,
    topStyle: pick(['sweater', 'stripe', 'hoodie', 'shirt', 'track'] as const),
    accent,
    bottom: skirt ? topShade : bottom,
    bottomShade: skirt ? top : bottomShade,
    bottomStyle: skirt ? 'skirt' : r() < 0.25 ? 'shorts' : 'pants',
    shoes: pick(['#ffffff', '#3a3340', '#d06868', '#6888d0']),
  };
}

/** Looks up a character spec by key; customers are generated from `cust_d{day}_{id}` style keys. */
export function specFor(key: string, seed?: number): CharSpec {
  return CAST[key] ?? randomCustomer(seed ?? 0);
}
