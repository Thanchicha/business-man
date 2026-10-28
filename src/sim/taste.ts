import { MENU, type Segment } from '../data/menus';
import { LOCATION, LOCATIONS, type Competitor } from '../data/locations';
import type { GameState } from './GameState';
import { rng } from './rng';
import type { CustomerPlan } from './demand';

/** 0 = less, 1 = standard, 2 = more. */
export type Level = 0 | 1 | 2;

/** The shop's house formula for one menu. */
export interface Recipe {
  sweet: Level;
  strength: Level;
}

export const SWEET_LABEL = ['หวานน้อย', 'หวานปกติ', 'หวานมาก'];
export const STRENGTH_LABEL = ['รสอ่อน', 'รสกลาง', 'รสเข้ม'];
export const ICE_LABEL = ['น้ำแข็งน้อย', 'น้ำแข็งปกติ', 'น้ำแข็งเยอะ'];
export const EXTRA_PEARL_PRICE = 10;

export const defaultRecipe = (): Recipe => ({ sweet: 1, strength: 1 });
export const recipeOf = (state: GameState, menuId: string): Recipe => state.recipes?.[menuId] ?? defaultRecipe();

const clamp = (n: number): Level => Math.max(0, Math.min(2, Math.round(n))) as Level;

/** What each group likes in general: students sweet, office workers less sugar and strong tea. */
const BASE_PREF: Record<Segment, Recipe> = {
  student: { sweet: 2, strength: 1 },
  worker: { sweet: 0, strength: 2 },
  family: { sweet: 1, strength: 0 },
};

function hash(s: string): number {
  let x = 7;
  for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return x;
}

/** The hidden taste a group wants from one menu. Players only learn it by asking customers. */
export function tastePref(menuId: string, segment: Segment): Recipe {
  const r = rng(hash(menuId + segment));
  const base = BASE_PREF[segment];
  // a few menus break the pattern so research is still worth it
  const nudge = () => (r() < 0.25 ? (r() < 0.5 ? -1 : 1) : 0);
  return { sweet: clamp(base.sweet + nudge()), strength: clamp(base.strength + nudge()) };
}

const axisFit = (diff: number): number => (diff === 0 ? 0.04 : diff === 1 ? 0 : -0.04);

/**
 * Satisfaction change from the house recipe, relative to the standard recipe,
 * so a shop that never touches its recipes plays exactly as before.
 */
export function tasteFit(state: GameState, menuId: string, segment: Segment): number {
  const want = tastePref(menuId, segment);
  const have = recipeOf(state, menuId);
  const fit = (h: Recipe) => axisFit(Math.abs(h.sweet - want.sweet)) + axisFit(Math.abs(h.strength - want.strength));
  return fit(have) - fit(defaultRecipe());
}

/** How a customer wants their cup made at the counter. */
export interface OrderSpec {
  ice: Level;
  sweet: Level;
  extraPearl: boolean;
}

export const NORMAL_SPEC: OrderSpec = { ice: 1, sweet: 1, extraPearl: false };

/** Customers who find the house recipe off ask for a change more often, a clue for the team. */
export function orderSpec(state: GameState, c: CustomerPlan, menuId = c.menuId): OrderSpec {
  const r = rng(c.seed * 7 + 3);
  const ice: Level = r() < 0.15 ? 0 : r() < 0.18 ? 2 : 1;
  const want = tastePref(menuId, c.segment).sweet;
  const have = recipeOf(state, menuId).sweet;
  let sweet: Level = 1;
  if (want !== have && r() < 0.55) sweet = want < have ? 0 : 2;
  else if (r() < 0.1) sweet = r() < 0.5 ? 0 : 2;
  const extraPearl = r() < (c.segment === 'student' ? 0.25 : 0.12);
  return { ice, sweet, extraPearl };
}

export function specText(s: OrderSpec): string {
  return [SWEET_LABEL[s.sweet], ICE_LABEL[s.ice], s.extraPearl ? '+ไข่มุก' : ''].filter(Boolean).join(' • ');
}

export const sameSpec = (a: OrderSpec, b: OrderSpec): boolean => a.ice === b.ice && a.sweet === b.sweet && a.extraPearl === b.extraPearl;

/** Satisfaction lost when the drink handed over is not what was ordered. */
export function makePenalty(ordered: { menuId: string; spec: OrderSpec }, made: { menuId: string; spec: OrderSpec }): number {
  if (ordered.menuId !== made.menuId) return 0.3;
  let p = 0;
  if (ordered.spec.ice !== made.spec.ice) p += 0.07;
  if (ordered.spec.sweet !== made.spec.sweet) p += 0.07;
  if (ordered.spec.extraPearl !== made.spec.extraPearl) p += 0.07;
  return p;
}

// ---------------------------------------------------------------- research the team shares

export type InsightKind = 'taste' | 'compare' | 'wish' | 'rival';

export interface Insight {
  id: number;
  day: number;
  kind: InsightKind;
  text: string;
  who: string;
  /** When the note points at a recipe change, what it suggests. */
  menuId?: string;
  field?: 'sweet' | 'strength';
  value?: Level;
}

export interface Proposal {
  id: number;
  day: number;
  menuId: string;
  field: 'sweet' | 'strength';
  value: Level;
  reason: string;
  from: string;
  status: 'new' | 'applied' | 'rejected';
}

export interface CoopNotes {
  insights: Insight[];
  proposals: Proposal[];
  /** Competitor visits used this morning. */
  visitDay: number;
  visits: number;
  /** Competitors already visited, by name. */
  seen: string[];
}

export const newCoopNotes = (): CoopNotes => ({ insights: [], proposals: [], visitDay: 0, visits: 0, seen: [] });
export const VISITS_PER_MORNING = 2;

const SEG_NAME: Record<Segment, string> = { student: 'นักศึกษา', worker: 'คนทำงาน', family: 'ครอบครัว' };
export const segName = (s: Segment): string => SEG_NAME[s];

export type Question = 'taste' | 'compare' | 'wish';
export const QUESTIONS: { id: Question; label: string }[] = [
  { id: 'taste', label: '😋 รสชาติ/ความหวานเป็นไง?' },
  { id: 'compare', label: '🏪 เคยไปร้านอื่นแถวนี้ไหม?' },
  { id: 'wish', label: '💡 อยากให้ร้านมีอะไรเพิ่ม?' },
];

/** What a customer answers when the scout interviews them. */
export function interview(state: GameState, c: CustomerPlan, menuId: string, q: Question, who: string, id: number): Insight {
  const base = { id, day: state.day, who };
  const seg = SEG_NAME[c.segment];
  const name = MENU[menuId].short;
  if (q === 'taste') {
    const want = tastePref(menuId, c.segment);
    const have = recipeOf(state, menuId);
    if (want.sweet !== have.sweet)
      return { ...base, kind: 'taste', menuId, field: 'sweet', value: want.sweet, text: `(${seg}) ${name}${want.sweet < have.sweet ? 'หวานไปนิด ถ้าหวานน้อยกว่านี้จะดีมาก' : 'ยังไม่ค่อยหวาน ชอบหวานกว่านี้อีก'}` };
    if (want.strength !== have.strength)
      return { ...base, kind: 'taste', menuId, field: 'strength', value: want.strength, text: `(${seg}) ${name}${want.strength > have.strength ? 'รสอ่อนไป อยากให้เข้มข้นกว่านี้' : 'เข้มไปหน่อย อยากได้รสนุ่มๆ กว่านี้'}` };
    return { ...base, kind: 'taste', text: `(${seg}) ${name}รสชาติกำลังดีเลย ไม่ต้องเปลี่ยน!` };
  }
  if (q === 'compare') {
    const rivals = state.location ? LOCATION[state.location].competitors : [];
    if (!rivals.length) return { ...base, kind: 'compare', text: `(${seg}) แถวนี้ไม่ค่อยมีร้านชานม เลยมาร้านนี้แหละ` };
    const r = rivals[c.seed % rivals.length];
    const ours = state.prices[menuId] ?? MENU[menuId].basePrice;
    const cheaper = r.avgPrice < ours;
    return { ...base, kind: 'compare', text: `(${seg}) เคยกิน "${r.name}" ${cheaper ? `ถูกกว่า (~${r.avgPrice}฿)` : `แพงกว่า (~${r.avgPrice}฿)`} เด่นเรื่อง${r.strength} แต่${r.weakness}` };
  }
  if (c.request) return { ...base, kind: 'wish', text: `(${seg}) อยากให้มี "${c.request}" จะมาบ่อยเลย` };
  const wishes = state.shopSize === 'catcafe' ? ['ที่นั่งเพิ่มอีกหน่อย', 'โปรซื้อ 2 แก้วลดราคา', 'ปลั๊กไฟไว้นั่งทำงาน'] : ['ทำให้ไวขึ้นอีกนิด', 'บัตรสะสมแต้ม', 'โปรซื้อ 2 แก้วลดราคา'];
  return { ...base, kind: 'wish', text: `(${seg}) อยากให้มี${wishes[c.seed % wishes.length]}` };
}

/** Rivals the scout can visit: the ones next door, or elsewhere in town if there are none. */
export function rivalsFor(state: GameState): (Competitor & { area: string })[] {
  const here = state.location ? LOCATION[state.location] : null;
  if (here?.competitors.length) return here.competitors.map((c) => ({ ...c, area: here.area }));
  return LOCATIONS.flatMap((l) => l.competitors.map((c) => ({ ...c, area: l.area }))).slice(0, 3);
}

/** What the scout learns from going to a rival shop and tasting their best seller. */
export function visitRival(state: GameState, rival: Competitor & { area: string }, who: string, id: number): Insight[] {
  const loc = state.location ? LOCATION[state.location] : LOCATIONS[0];
  const top = (Object.entries(loc.mix) as [Segment, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const famous = Object.values(MENU).find((m) => rival.famous.includes(m.short) || m.name.includes(rival.famous)) ?? MENU.pearl_milk_tea;
  const want = tastePref(famous.id, top);
  const ours = state.menus.length ? Math.round(state.menus.reduce((s, m) => s + (state.prices[m] ?? MENU[m].basePrice), 0) / state.menus.length) : 45;
  const busy = rival.rating >= 4 ? 'คิวยาวมาก' : rival.rating >= 3.5 ? 'คนพอสมควร' : 'ค่อนข้างเงียบ';
  return [
    {
      id,
      day: state.day,
      who,
      kind: 'rival',
      text: `🏪 ${rival.name} (${rival.area}) ราคาเฉลี่ย ${rival.avgPrice}฿ (ร้านเรา ~${ours}฿) • ${busy} • ขายดี: ${rival.famous} • จุดเด่น: ${rival.strength} • จุดอ่อน: ${rival.weakness}`,
    },
    {
      id: id + 1,
      day: state.day,
      who,
      kind: 'rival',
      menuId: famous.id,
      field: 'sweet',
      value: want.sweet,
      text: `😋 แอบชิม${famous.short}ของเขา: ${SWEET_LABEL[want.sweet]} ${STRENGTH_LABEL[want.strength]} ลูกค้าหลักแถวนี้ (${SEG_NAME[top]}) ดูชอบแบบนี้`,
    },
  ];
}
