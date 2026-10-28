import { MENU } from '../data/menus';
import type { GameState } from './GameState';
import { clearanceMenus } from './economy';

export interface Promos {
  /** Opening sale: a percentage off every walk-in cup during the first days. */
  opening: { on: boolean; pct: number };
  /** A coupon for every 5-star review, good for money off on the next visit. */
  coupon: { on: boolean; amount: number };
  /** Bring a friend: baht off an order of 2 cups, and of 3 or more. */
  bundle: { on: boolean; off2: number; off3: number };
  /** Clear-out sale: a percentage off menus that use stock spoiling tonight. */
  clearance: { on: boolean; pct: number };
}

export const OPENING_DAYS = 3;
/** Share of coupon holders who come back the next day. */
export const COUPON_RETURN = 0.6;

export const defaultPromos = (): Promos => ({
  opening: { on: false, pct: 10 },
  coupon: { on: false, amount: 10 },
  bundle: { on: false, off2: 10, off3: 20 },
  clearance: { on: false, pct: 20 },
});

export const openingActive = (state: GameState): boolean => state.promos.opening.on && state.day <= OPENING_DAYS;

/**
 * How expensive a price feels. A price just under a round number (39, 49, 59)
 * reads as the lower ten, so customers judge it a little cheaper than it is.
 */
export const perceived = (price: number): number => (price % 10 === 9 ? price - 2 : price);

/** What a walk-in customer pays for an order, after every promotion that applies. */
export function orderTotal(state: GameState, menuId: string, cups: number, coupon = false): number {
  const unit = state.prices[menuId] ?? MENU[menuId].basePrice;
  let total = unit * cups;
  if (openingActive(state)) total -= Math.round((unit * cups * state.promos.opening.pct) / 100);
  else if (state.promos.clearance?.on && clearanceMenus(state).includes(menuId)) total -= Math.round((unit * cups * state.promos.clearance.pct) / 100);
  if (state.promos.bundle.on && cups >= 3) total -= state.promos.bundle.off3;
  else if (state.promos.bundle.on && cups === 2) total -= state.promos.bundle.off2;
  if (coupon && state.promos.coupon.on) total -= state.promos.coupon.amount;
  return Math.max(0, Math.round(total));
}

/** Extra walk-ins drawn by promotions: news of a sale spreads, groups come for bundles. */
export function promoDemand(state: GameState): number {
  let m = 1;
  if (openingActive(state)) m *= 1 + state.promos.opening.pct * 0.012;
  if (state.promos.bundle.on) m *= 1.04;
  return m;
}

/** Chance an order is for 2 cups and for 3, given the group and the bundle deal. */
export function groupOdds(state: GameState, family: boolean): { two: number; three: number } {
  const bundle = state.promos.bundle.on;
  return { two: (family ? 0.45 : 0.2) + (bundle ? 0.12 : 0), three: bundle ? (family ? 0.15 : 0.07) : 0 };
}
