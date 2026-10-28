import { MENU } from '../data/menus';
import { SHOP_SIZES } from '../data/shopSizes';
import { comfortBonus } from '../data/furniture';
import { costPerServing } from '../data/ingredients';
import type { GameState, FeedbackKind } from './GameState';
import type { CustomerPlan } from './demand';
import { canMake, staffBonus } from './economy';
import { orderTotal, perceived } from './pricing';
import { tiredOnOpening } from './research';
import { tasteFit } from './taste';

/** What the customer opens the conversation with. */
export type Intent = 'order' | 'expensive' | 'custom' | 'request' | 'slow' | 'outOfStock';

export interface Choice {
  id: string;
  label: string;
}

export interface Outcome {
  buys: boolean;
  menuId: string;
  cups: number;
  priceEach: number;
  satDelta: number;
  extraMakeTime: number;
  extraCost: number;
  feedback?: FeedbackKind;
  idea?: string;
}

export const priceOf = (state: GameState, menuId: string): number => state.prices[menuId] ?? MENU[menuId].basePrice;

/** Price per cup this customer actually pays, after promotions and their coupon. */
export const unitPrice = (state: GameState, c: CustomerPlan, menuId = c.menuId, cups = c.cups): number => orderTotal(state, menuId, cups, c.coupon) / cups;

export function intentFor(state: GameState, c: CustomerPlan, waitedFrac: number): Intent {
  if (!canMake(state.inventory, c.menuId, c.cups)) return 'outOfStock';
  if (waitedFrac > 0.55) return 'slow';
  if (perceived(unitPrice(state, c)) > c.wtp * 1.12) return 'expensive';
  if (c.wantsCustom) return 'custom';
  if (c.request) return 'request';
  return 'order';
}

/** Player replies. `polite` is ครับ or ค่ะ depending on the player character. */
export function choicesFor(intent: Intent, polite: string): Choice[] {
  switch (intent) {
    case 'order':
      return [
        { id: 'accept', label: `รับออเดอร์${polite}` },
        { id: 'upsell', label: 'ชวนรับเพิ่มอีกแก้วไหม?' },
      ];
    case 'expensive':
      return [
        { id: 'explain', label: 'อธิบายว่าใช้วัตถุดิบดี' },
        { id: 'discount', label: 'ลดให้ 5 บาท' },
        { id: 'thanks', label: `ขอบคุณที่บอกนะ${polite}` },
      ];
    case 'custom':
      return [
        { id: 'yes', label: 'ได้เลย! ปรับให้' },
        { id: 'no', label: `ขอโทษ${polite} ทำตามสูตรเท่านั้น` },
      ];
    case 'request':
      return [
        { id: 'note', label: 'จดไว้ เดี๋ยวลองทำ!' },
        { id: 'suggest', label: 'แนะนำเมนูที่มีแทน' },
      ];
    case 'slow':
      return [
        { id: 'sorry', label: `ขอโทษ${polite} จะรีบทำให้` },
        { id: 'freebie', label: 'ขอโทษ แถมไข่มุกฟรี' },
      ];
    case 'outOfStock':
      return [
        { id: 'alt', label: 'แนะนำเมนูอื่นแทน' },
        { id: 'sorry', label: `ขอโทษ${polite} ของหมด` },
      ];
  }
}

/** Another menu the shop can still make, preferring ones this customer likes. */
export function alternativeMenu(state: GameState, c: CustomerPlan): string | null {
  const options = state.menus.filter((id) => id !== c.menuId && canMake(state.inventory, id, c.cups));
  options.sort((a, b) => MENU[b].appeal[c.segment] - MENU[a].appeal[c.segment]);
  return options[0] ?? null;
}

/** Game rules for each reply. `roll` is a 0-1 random number. */
export function resolve(state: GameState, c: CustomerPlan, intent: Intent, choiceId: string, roll: number): Outcome {
  const base: Outcome = { buys: true, menuId: c.menuId, cups: c.cups, priceEach: unitPrice(state, c), satDelta: 0, extraMakeTime: 0, extraCost: 0 };
  const ratio = perceived(base.priceEach) / c.wtp;
  switch (intent) {
    case 'order':
      if (choiceId === 'upsell') {
        if (roll < 0.35) return { ...base, cups: base.cups + 1, priceEach: unitPrice(state, c, c.menuId, base.cups + 1), satDelta: 0.02 };
        return { ...base, satDelta: -0.02 };
      }
      return base;
    case 'expensive':
      if (choiceId === 'discount') return { ...base, priceEach: base.priceEach - 5, satDelta: 0.05, feedback: 'expensive' };
      if (choiceId === 'explain') return { ...base, buys: ratio < 1.35 && roll < 0.75, satDelta: -0.02, feedback: 'expensive' };
      return { ...base, buys: roll < 0.5, satDelta: -0.04, feedback: 'expensive' };
    case 'custom':
      if (choiceId === 'yes') return { ...base, satDelta: 0.12, extraMakeTime: 2, feedback: 'custom' };
      return { ...base, buys: roll < 0.85, satDelta: -0.08, feedback: 'custom' };
    case 'request':
      if (choiceId === 'note') return { ...base, satDelta: 0.06, feedback: 'request', idea: c.request ?? undefined };
      return { ...base, satDelta: 0.01, feedback: 'request', idea: c.request ?? undefined };
    case 'slow':
      if (choiceId === 'freebie') return { ...base, satDelta: 0.12, extraCost: costPerServing('pearls'), feedback: 'slow' };
      return { ...base, satDelta: 0.03, feedback: 'slow' };
    case 'outOfStock': {
      const alt = alternativeMenu(state, c);
      if (choiceId === 'alt' && alt && roll < 0.7) return { ...base, menuId: alt, priceEach: unitPrice(state, c, alt), satDelta: -0.03, feedback: 'outOfStock' };
      return { ...base, buys: false, satDelta: -0.1, feedback: 'outOfStock' };
    }
  }
}

/** Seconds to make an order with current staff and strategy. */
export function makeSeconds(state: GameState, menuId: string, cups: number, extra = 0): number {
  // opening exhausted after too much research slows the first day
  const speed = (1 + staffBonus(state).speed + (state.strategy === 'speed' ? 0.25 : 0)) * (tiredOnOpening(state) ? 0.85 : 1);
  return (MENU[menuId].makeTime * cups + extra) / speed;
}

/** Satisfaction (0-1) once the drink is handed over. */
export function finalSatisfaction(state: GameState, c: CustomerPlan, o: Outcome, waitedFrac: number): number {
  let s = 0.68 + o.satDelta + staffBonus(state).service + SHOP_SIZES[state.shopSize].satisfaction + (state.furniture && state.shopSize === 'catcafe' ? comfortBonus(state.furniture) : 0);
  if (state.strategy === 'cozy') s += 0.08;
  if (MENU[o.menuId].signature) s += 0.05;
  s += tasteFit(state, o.menuId, c.segment);
  const ratio = perceived(o.priceEach) / c.wtp;
  if (ratio > 1.1) s -= (ratio - 1.1) * 0.6;
  if (ratio < 0.9) s += 0.05;
  if (waitedFrac > 0.85) s -= 0.2;
  else if (waitedFrac > 0.6) s -= 0.1;
  return Math.max(0, Math.min(1, s));
}

export const repFromSatisfaction = (s: number): number => (s - 0.65) * 0.06;
export const REP_LOST_CUSTOMER = -0.04;

/** Stars a customer gives, from how satisfied they were (0-1). */
export const starsFor = (sat: number): number => Math.max(1, Math.min(5, Math.round(0.6 + sat * 4.6)));

/** Chance a customer bothers to write a review: the delighted and the upset write most. */
export function reviewChance(state: GameState, sat: number): number {
  const base = sat >= 0.85 ? 0.55 : sat <= 0.4 ? 0.6 : 0.3;
  return Math.min(0.9, base + (state.promos.coupon.on ? 0.15 : 0));
}

/** Satisfaction of a delivery customer: price in the app and how long the rider waited. */
export function deliverySatisfaction(state: GameState, menuId: string, waitSec: number): number {
  const price = state.delivery.prices[menuId] ?? MENU[menuId].basePrice + 10;
  let s = 0.78 - Math.max(0, perceived(price) / (MENU[menuId].basePrice + 12) - 1) * 0.6;
  if (waitSec > 25) s -= Math.min(0.35, (waitSec - 25) * 0.01);
  return Math.max(0, Math.min(1, s));
}
