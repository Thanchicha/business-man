import { MENUS, type Segment } from '../data/menus';
import { LOCATION, marketPrice, type Location } from '../data/locations';
import type { GameState } from './GameState';
import { DINE_IN, WTP, IDEAS } from './demand';
import { rng } from './rng';
import { TEA_PRICE, type Talk } from './interviews';

export type MethodId = 'walk' | 'interview' | 'survey' | 'online' | 'mystery';

export interface Method {
  id: MethodId;
  name: string;
  icon: string;
  desc: string;
  hours: number;
  energy: number;
  cost: number;
  /** What kind of data it gives. */
  kind: 'เชิงปริมาณ' | 'เชิงคุณภาพ' | 'ข้อมูลคู่แข่ง';
  gives: string;
}

export const METHODS: Method[] = [
  { id: 'walk', name: 'เดินสำรวจ', icon: '🚶', desc: 'เดินดูรอบๆ นับคนเดินผ่าน สังเกตว่าเป็นใคร ร้านไหนคิวยาว', hours: 2, energy: 15, cost: 0, kind: 'เชิงปริมาณ', gives: 'คนเดินผ่านมากน้อย และกลุ่มลูกค้าแบบคร่าวๆ' },
  { id: 'interview', name: 'สัมภาษณ์ภาคสนาม', icon: '🎤', desc: 'เลือกคนแถวนั้นมาคุยทีละคน 4 คน บางคนรีบจนปฏิเสธได้ ยื่นชานมให้ก่อนจะคุยง่ายขึ้น', hours: 3, energy: 25, cost: 100, kind: 'เชิงคุณภาพ', gives: 'เหตุผลลึกๆ ของแต่ละคน (ได้ไม่กี่คน)' },
  { id: 'survey', name: 'ร่อนแบบสอบถาม', icon: '📋', desc: 'พิมพ์แบบสอบถามแจกพร้อมของรางวัลเล็กๆ ได้คำตอบ ~40 คน', hours: 4, energy: 20, cost: 300, kind: 'เชิงปริมาณ', gives: 'สัดส่วนลูกค้า เมนูยอดนิยม ราคาที่รับได้ เป็นตัวเลขแม่นๆ' },
  { id: 'online', name: 'หาข้อมูลในอินเทอร์เน็ต', icon: '💻', desc: 'อ่านรีวิวร้านแถวนี้ ดูเมนูในแอปเดลิเวอรี่ กลุ่มเฟซบุ๊กในย่าน', hours: 1, energy: 5, cost: 0, kind: 'ข้อมูลคู่แข่ง', gives: 'เมนู ราคา คะแนนรีวิว และคำบ่นของร้านคู่แข่ง' },
  { id: 'mystery', name: 'ลองซื้อร้านคู่แข่ง', icon: '🧋', desc: 'ไปต่อคิวซื้อจริงที่ร้านคู่แข่ง ชิมรสชาติ จับเวลารอ', hours: 2, energy: 10, cost: 0, kind: 'ข้อมูลคู่แข่ง', gives: 'รสชาติ ความเร็ว บรรยากาศจริงของคู่แข่ง (จ่ายค่าเครื่องดื่มเอง)' },
];

export const METHOD = Object.fromEntries(METHODS.map((m) => [m.id, m])) as Record<MethodId, Method>;

/** Prep time before opening: 3 days of 10 hours. */
export const PREP_HOURS = 30;
/** Moving to look at another location costs this much. */
export const MOVE_HOURS = 2;
export const MOVE_ENERGY = 10;
export const REST = { hours: 4, energy: 35 };
/** Opening day with less energy than this is slower behind the counter. */
export const TIRED_BELOW = 30;

export interface ResearchState {
  energy: number;
  hours: number;
  /** Methods used at each location. */
  done: Record<string, MethodId[]>;
  /** Conversations kept from field interviews, by location. */
  talks?: Record<string, Talk[]>;
  /** Approaches left in the interview round at each location. */
  talksLeft?: Record<string, number>;
  /** How many people said no, by location. */
  refusals?: Record<string, number>;
}

export const newResearch = (): ResearchState => ({ energy: 100, hours: PREP_HOURS, done: {} });

/** Money a method costs at a location: mystery shopping pays for one drink per rival. */
export function methodCost(m: Method, loc: Location): number {
  return m.id === 'mystery' ? loc.competitors.reduce((s, c) => s + c.avgPrice, 0) : m.cost;
}

export type Check = { ok: true } | { ok: false; reason: string };

export function canUse(state: GameState, m: Method, locId: string): Check {
  const r = state.research;
  const loc = LOCATION[locId];
  if (r.done[locId]?.includes(m.id)) return { ok: false, reason: 'ทำวิธีนี้ที่ทำเลนี้ไปแล้ว' };
  if (m.id !== 'walk' && m.id !== 'interview' && m.id !== 'survey' && !loc.competitors.length) return { ok: false, reason: 'ทำเลนี้ไม่มีร้านคู่แข่งให้ดู' };
  if (r.hours < m.hours) return { ok: false, reason: 'เวลาเตรียมร้านไม่พอแล้ว' };
  if (r.energy < m.energy) return { ok: false, reason: 'เหนื่อยเกินไป ต้องพักก่อน' };
  if (state.cash < methodCost(m, loc)) return { ok: false, reason: 'เงินไม่พอ' };
  return { ok: true };
}

export function useMethod(state: GameState, m: Method, locId: string): void {
  const r = state.research;
  r.hours -= m.hours;
  r.energy -= m.energy;
  const cost = methodCost(m, LOCATION[locId]);
  state.cash -= cost;
  state.pendingSetup += cost;
  (r.done[locId] ??= []).push(m.id);
  if (m.id === 'interview') (r.talksLeft ??= {})[locId] = INTERVIEW_APPROACHES;
}

/** People you can stop and ask in one interview round. */
export const INTERVIEW_APPROACHES = 4;

export const talksLeft = (state: GameState, locId: string): number => state.research.talksLeft?.[locId] ?? 0;

/** One approach used up; offering a bubble tea first costs a little money. */
export function spendApproach(state: GameState, locId: string, withTea: boolean): Check {
  const r = state.research;
  if (talksLeft(state, locId) <= 0) return { ok: false, reason: 'ครบโควต้าการเข้าหาแล้ว' };
  if (withTea && state.cash < TEA_PRICE) return { ok: false, reason: 'เงินไม่พอซื้อชานมไปฝาก' };
  (r.talksLeft ??= {})[locId] = talksLeft(state, locId) - 1;
  if (withTea) {
    state.cash -= TEA_PRICE;
    state.pendingSetup += TEA_PRICE;
  }
  return { ok: true };
}

export function recordTalk(state: GameState, locId: string, talk: Talk): void {
  ((state.research.talks ??= {})[locId] ??= []).push(talk);
}

export function recordRefusal(state: GameState, locId: string): void {
  const m = (state.research.refusals ??= {});
  m[locId] = (m[locId] ?? 0) + 1;
}

export function rest(state: GameState): Check {
  const r = state.research;
  if (r.hours < REST.hours) return { ok: false, reason: 'ไม่มีเวลาพักแล้ว' };
  r.hours -= REST.hours;
  r.energy = Math.min(100, r.energy + REST.energy);
  return { ok: true };
}

export function move(state: GameState): Check {
  const r = state.research;
  if (r.hours < MOVE_HOURS) return { ok: false, reason: 'เวลาเตรียมร้านหมดแล้ว' };
  r.hours -= MOVE_HOURS;
  r.energy = Math.max(0, r.energy - MOVE_ENERGY);
  return { ok: true };
}

/** Opening the shop exhausted slows the first day. */
export const tiredOnOpening = (state: GameState): boolean => state.day === 1 && state.research.energy < TIRED_BELOW;

// ---------------------------------------------------------------- what each method finds

const SEG_NAME: Record<Segment, string> = { student: 'นักเรียน/นักศึกษา', worker: 'คนทำงาน', family: 'ครอบครัว' };
const SEG_COLOR: Record<Segment, string> = { student: '#7fb2f0', worker: '#f6a04d', family: '#6fcf97' };

/** How much each menu appeals to the people in an area, best first. */
export function menuRanking(loc: Location): { id: string; score: number }[] {
  return MENUS.filter((m) => !m.signature)
    .map((m) => ({ id: m.id, score: (Object.keys(loc.mix) as Segment[]).reduce((s, k) => s + loc.mix[k] * m.appeal[k], 0) }))
    .sort((a, b) => b.score - a.score);
}

const mixed = (loc: Location, table: Record<Segment, number>): number => (Object.keys(loc.mix) as Segment[]).reduce((s, k) => s + loc.mix[k] * table[k], 0);

/** Something to draw: a share-of-the-whole ring, or a bar per item. */
export type ChartSpec =
  | { kind: 'donut'; title: string; items: { label: string; value: number; color?: string }[] }
  | { kind: 'bars'; title: string; items: { label: string; value: number; text?: string }[] };

export interface TableSpec {
  head: string[];
  rows: string[][];
}

export interface Finding {
  method: MethodId;
  title: string;
  /** The one thing to remember, in a few words. */
  headline: string;
  /** Short lines for the notebook (keep them short). */
  lines: string[];
  /** Numbers to draw as bars: label, share 0-1. */
  bars?: [string, number][];
  charts?: ChartSpec[];
  table?: TableSpec;
  /** Field interviews: the people who stopped to talk. */
  people?: Talk[];
  /** How many said no (interviews). */
  refused?: number;
}

/** How busy the street is across the day, by kind of area. */
const DAYPART: Record<string, [number, number, number]> = {
  university: [0.5, 1, 0.8],
  village: [0.45, 0.4, 1],
  bts: [1, 0.55, 0.95],
  office: [0.85, 1, 0.6],
  mall: [0.35, 0.8, 1],
};

/** What a method reveals about a location. Deterministic, with less noise for better methods. */
export function findings(locId: string, method: MethodId, state?: GameState): Finding {
  const loc = LOCATION[locId];
  const r = rng(locId.length * 131 + method.length * 17 + 7);
  const segs = Object.keys(loc.mix) as Segment[];
  const noisy = (v: number, amt: number) => Math.max(0, v + (r() - 0.5) * 2 * amt);
  const biggest = (shares: number[]) => SEG_NAME[segs[shares.indexOf(Math.max(...shares))]];
  switch (method) {
    case 'walk': {
      const raw = segs.map((k) => noisy(loc.mix[k], 0.15));
      const sum = raw.reduce((a, b) => a + b, 0);
      const share = raw.map((v) => v / sum);
      const perHour = Math.round(loc.traffic * 120 * (0.85 + r() * 0.3));
      const [am, noon, pm] = DAYPART[locId] ?? [0.6, 0.8, 0.8];
      return {
        method,
        title: '🚶 เดินสำรวจ',
        headline: `คนเดินผ่าน ~${perHour} คน/ชม. ส่วนใหญ่เป็น${biggest(share)}`,
        lines: [loc.competitors.length ? `เห็นร้านชานม ${loc.competitors.length} ร้าน` : 'ไม่เห็นร้านชานมแถวนี้เลย', 'กะด้วยตา อาจคลาดเคลื่อน'],
        bars: segs.map((k, i) => [SEG_NAME[k], share[i]]),
        charts: [
          { kind: 'donut', title: 'คนที่เห็น', items: segs.map((k, i) => ({ label: SEG_NAME[k], value: share[i], color: SEG_COLOR[k] })) },
          { kind: 'bars', title: 'ช่วงที่คนเยอะ', items: [{ label: 'เช้า', value: am }, { label: 'เที่ยง', value: noon }, { label: 'เย็น', value: pm }] },
        ],
      };
    }
    case 'survey': {
      const top = menuRanking(loc).slice(0, 4);
      const max = top[0].score;
      const wtp = Math.round(mixed(loc, WTP) * (0.97 + r() * 0.06));
      const dine = Math.round(mixed(loc, DINE_IN) * 100);
      const app = Math.round((loc.mix.worker * 0.7 + loc.mix.student * 0.5 + loc.mix.family * 0.35) * 100);
      const share = segs.map((k) => noisy(loc.mix[k], 0.03));
      return {
        method,
        title: '📋 แบบสอบถาม 40 คน',
        headline: `รับราคาได้ ~${wtp} บาท • ${biggest(share)}มากสุด`,
        lines: [`นั่งที่ร้าน ${dine}% / ซื้อกลับ ${100 - dine}%`, `เคยสั่งผ่านแอป ${app}%`, `ยอดนิยม: ${MENUS.find((m) => m.id === top[0].id)!.short}`],
        bars: [...segs.map((k, i): [string, number] => [SEG_NAME[k], share[i]]), ...top.map(({ id, score }): [string, number] => [`♥ ${MENUS.find((m) => m.id === id)!.short}`, score / max])],
        charts: [
          { kind: 'donut', title: 'ใครตอบบ้าง', items: segs.map((k, i) => ({ label: SEG_NAME[k], value: share[i], color: SEG_COLOR[k] })) },
          { kind: 'bars', title: 'เมนูที่อยากซื้อ', items: top.map(({ id, score }) => ({ label: MENUS.find((m) => m.id === id)!.short, value: score / max })) },
          { kind: 'bars', title: 'ยอมจ่ายถึงราคานี้ (% ของคน)', items: [35, 45, 55, 65].map((p) => ({ label: `${p} บาท`, value: 1 / (1 + Math.exp((p - wtp) / 6)) })) },
          { kind: 'donut', title: 'นั่งร้าน หรือ ซื้อกลับ', items: [{ label: 'นั่งที่ร้าน', value: dine / 100, color: '#f56fa6' }, { label: 'ซื้อกลับ', value: 1 - dine / 100, color: '#a993f5' }] },
        ],
      };
    }
    case 'interview': {
      const talks = state?.research.talks?.[locId] ?? [];
      const refused = state?.research.refusals?.[locId] ?? 0;
      const chipCount = new Map<string, number>();
      for (const t of talks) for (const c of t.chips) chipCount.set(c, (chipCount.get(c) ?? 0) + 1);
      const common = [...chipCount.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 1);
      return {
        method,
        title: '🎤 สัมภาษณ์ภาคสนาม',
        headline: talks.length ? `คุยสำเร็จ ${talks.length} คน • ปฏิเสธ ${refused} คน` : 'ยังไม่ได้คุยกับใครเลย',
        lines: talks.length ? (common.length ? common.slice(0, 2).map(([c, n]) => `${n} คนพูดตรงกัน: "${c}"`) : ['แต่ละคนต้องการไม่เหมือนกัน']) : ['เลือกคนแถวนั้นแล้วเข้าไปคุย'],
        people: talks,
        refused,
        charts: talks.length > 1 ? [{ kind: 'bars', title: 'ราคาที่แต่ละคนยอมจ่าย (บาท)', items: talks.map((t) => ({ label: t.name, value: t.price / 70, text: `${t.price}` })) }] : undefined,
        table: talks.length ? { head: ['ใคร', 'ชอบ', 'จ่ายได้'], rows: talks.map((t) => [`${t.icon} ${t.tag}`, t.likes, `${t.price}`]) } : undefined,
      };
    }
    case 'online': {
      const price = Math.round(marketPrice(loc));
      return {
        method,
        title: '💻 ข้อมูลออนไลน์ (คู่แข่ง)',
        headline: `ราคาตลาดย่านนี้ ~${price} บาท/แก้ว`,
        lines: loc.competitors.map((c) => `${c.name}: "${c.weakness}"`),
        table: { head: ['ร้าน', '★', 'ราคา', 'ขายดี'], rows: loc.competitors.map((c) => [c.name, `${c.rating}`, `${c.avgPrice}`, c.famous]) },
        charts: [{ kind: 'bars', title: 'ราคาเฉลี่ยต่อแก้ว (บาท)', items: [...loc.competitors.map((c) => ({ label: c.name, value: c.avgPrice / 75, text: `${c.avgPrice}` })), { label: 'ตลาด', value: price / 75, text: `${price}` }] }],
      };
    }
    case 'mystery': {
      const wait = loc.competitors.map((c) => Math.round(3 + (5 - c.rating) * 3 + r() * 3));
      return {
        method,
        title: '🧋 ลองซื้อร้านคู่แข่ง',
        headline: wait.length ? `รอนานสุด ${Math.max(...wait)} นาที ที่ ${loc.competitors[wait.indexOf(Math.max(...wait))].name}` : 'ไม่มีคู่แข่ง',
        lines: loc.competitors.map((c) => `${c.name}: จุดอ่อน ${c.weakness}`),
        table: { head: ['ร้าน', 'รอ (นาที)', 'จุดแข็ง'], rows: loc.competitors.map((c, i) => [c.name, `${wait[i]}`, c.strength]) },
        charts: [{ kind: 'bars', title: 'เวลารอ (นาที)', items: loc.competitors.map((c, i) => ({ label: c.name, value: wait[i] / 14, text: `${wait[i]}` })) }],
      };
    }
  }
}

/** Everything learnt at a location so far. */
export const notebook = (state: GameState, locId: string): Finding[] => (state.research.done[locId] ?? []).map((m) => findings(locId, m, state));
