import { ING, costPerServing } from '../data/ingredients';
import { MENU, cupCost } from '../data/menus';
import { LOCATION, dailyRent } from '../data/locations';
import { STAFF_BY_ID, dailyWage } from '../data/staff';
import { SHOP_SIZES } from '../data/shopSizes';
import type { Batch, DayLog, FeedbackKind, GameState } from './GameState';

export function stock(inv: Batch[], ing: string): number {
  return inv.filter((b) => b.ing === ing).reduce((s, b) => s + b.servings, 0);
}

export function canMake(inv: Batch[], menuId: string, cups = 1): boolean {
  return Object.entries(MENU[menuId].recipe).every(([ing, q]) => stock(inv, ing) >= q * cups);
}

/** How many cups of a menu the current stock allows. */
export function cupsPossible(inv: Batch[], menuId: string): number {
  return Math.min(...Object.entries(MENU[menuId].recipe).map(([ing, q]) => Math.floor(stock(inv, ing) / q)));
}

/** The ingredient that runs out first for this menu, or null if there is stock. */
export function missingFor(inv: Batch[], menuId: string, cups = 1): string | null {
  for (const [ing, q] of Object.entries(MENU[menuId].recipe)) if (stock(inv, ing) < q * cups) return ing;
  return null;
}

/** Uses up ingredients, oldest batch first. Returns the cost of what was used. */
export function consume(inv: Batch[], menuId: string, cups: number): number {
  for (const [ing, q] of Object.entries(MENU[menuId].recipe)) consumeServings(inv, ing, q * cups);
  return cupCost(menuId) * cups;
}

/** Uses up servings of one ingredient, oldest batch first, as far as the stock goes. Returns what was used. */
export function consumeServings(inv: Batch[], ing: string, n: number): number {
  let need = n;
  const batches = inv.filter((b) => b.ing === ing).sort((a, b) => (a.expires ?? 1e9) - (b.expires ?? 1e9));
  for (const b of batches) {
    const take = Math.min(b.servings, need);
    b.servings -= take;
    need -= take;
    if (need <= 0) break;
  }
  for (let i = inv.length - 1; i >= 0; i--) if (inv[i].servings <= 0) inv.splice(i, 1);
  return n - Math.max(0, need);
}

export function addPurchase(inv: Batch[], ing: string, units: number, day: number): void {
  if (units <= 0) return;
  const life = ING[ing].shelfLife;
  inv.push({ ing, servings: units * ING[ing].servings, expires: life ? day + life - 1 : null });
}

/** Removes batches that expire at the end of `day`. Returns their value. */
export function spoil(inv: Batch[], day: number): { value: number; items: Record<string, number>; detail: Record<string, { servings: number; value: number }> } {
  let value = 0;
  const items: Record<string, number> = {};
  const detail: Record<string, { servings: number; value: number }> = {};
  for (let i = inv.length - 1; i >= 0; i--) {
    const b = inv[i];
    if (b.expires !== null && b.expires <= day) {
      const v = b.servings * costPerServing(b.ing);
      value += v;
      items[b.ing] = (items[b.ing] ?? 0) + b.servings;
      const d = (detail[b.ing] ??= { servings: 0, value: 0 });
      d.servings += b.servings;
      d.value = Math.round((d.value + v) * 100) / 100;
      inv.splice(i, 1);
    }
  }
  return { value, items, detail };
}

/** Stock that will be thrown away at the end of `day` unless it is used, by ingredient (servings). */
export function expiringOn(inv: Batch[], day: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of inv) if (b.expires !== null && b.expires <= day && b.servings > 0) out[b.ing] = (out[b.ing] ?? 0) + b.servings;
  return out;
}

/** Menus that use something about to spoil today, so a clearance sale can move it. */
export function clearanceMenus(state: GameState): string[] {
  const soon = expiringOn(state.inventory, state.day);
  // ice melts every night anyway, so it does not make a menu worth discounting
  return state.menus.filter((id) => Object.keys(MENU[id].recipe).some((ing) => ing !== 'ice' && soon[ing]));
}

export function wagesPerDay(state: GameState): number {
  return state.staff.reduce((s, id) => s + dailyWage(STAFF_BY_ID[id]), 0);
}

export function rentPerDay(state: GameState): number {
  return state.location ? Math.round(dailyRent(LOCATION[state.location]) * SHOP_SIZES[state.shopSize].rentMult) : 0;
}

export function upkeepPerDay(state: GameState): number {
  return SHOP_SIZES[state.shopSize].upkeep;
}

export function utilitiesPerDay(state: GameState): number {
  return SHOP_SIZES[state.shopSize].utilities;
}

/** Supermarket volume discount on one line of the cart. */
export function bulkDiscount(units: number): number {
  return units >= 10 ? 0.1 : units >= 5 ? 0.05 : 0;
}

export function cartTotal(cart: Record<string, number>): { gross: number; discount: number; net: number } {
  let gross = 0;
  let discount = 0;
  for (const [ing, units] of Object.entries(cart)) {
    const line = ING[ing].price * units;
    gross += line;
    discount += line * bulkDiscount(units);
  }
  return { gross, discount: Math.round(discount), net: Math.round(gross - discount) };
}

export type HaggleResult = 'tooSmall' | 'success' | 'fail';

/** Asking the shop for a better deal only works on bigger orders, and not always. */
export function haggle(net: number, roll: number): HaggleResult {
  if (net < 1500) return 'tooSmall';
  return roll < 0.6 ? 'success' : 'fail';
}
export const HAGGLE_RATE = 0.05;

export function staffBonus(state: GameState): { speed: number; patience: number; service: number } {
  return state.staff.reduce(
    (acc, id) => {
      const s = STAFF_BY_ID[id];
      return { speed: acc.speed + s.speed, patience: acc.patience + s.patience, service: acc.service + s.service };
    },
    { speed: 0, patience: 0, service: 0 },
  );
}

export function emptyFeedback(): Record<FeedbackKind, number> {
  return { expensive: 0, slow: 0, custom: 0, request: 0, compliment: 0, outOfStock: 0, leftAngry: 0, closed: 0, noSeat: 0, wrongOrder: 0 };
}

export interface DayTally {
  revenue: number;
  cogs: number;
  cupsSold: number;
  served: number;
  lost: number;
  feedback: Record<FeedbackKind, number>;
  requests: Record<string, number>;
  sales: Record<string, number>;
  repDelta: number;
  event?: string;
  visitors: number;
  dineIn: number;
  takeaway: number;
  deliveryOrders: number;
  /** Gross delivery sales; they are also counted in revenue. */
  deliverySales: number;
  deliveryCancelled: number;
  /** Stars of each review written today. */
  reviews: number[];
  /** Coupons handed to 5-star reviewers today. */
  couponsGiven: number;
}

export function emptyTally(event?: string): DayTally {
  return { revenue: 0, cogs: 0, cupsSold: 0, served: 0, lost: 0, feedback: emptyFeedback(), requests: {}, sales: {}, repDelta: 0, event, visitors: 0, dineIn: 0, takeaway: 0, deliveryOrders: 0, deliverySales: 0, deliveryCancelled: 0, reviews: [], couponsGiven: 0 };
}

/** Share of every delivery sale the app keeps: GP 30% plus 7% VAT on it (LINE MAN / Grab). */
export const DELIVERY_FEE = 0.321;
/** Income tax set aside on a day's operating profit (simplified flat rate). */
export const TAX_RATE = 0.05;
/** Small-business loan without collateral: about 18% a year, charged daily on what is owed. */
export const LOAN_RATE_YEAR = 0.18;
export const LOAN_RATE_DAY = LOAN_RATE_YEAR / 365;
export const LOAN_LIMIT = 100000;
/** The landlord collects rent every this many days. */
export const RENT_PERIOD = 3;
/** Extra charged when the player asks the landlord to wait. */
export const LATE_FEE = 0.1;

/** True on the morning the landlord comes round (days 4, 7, ...). */
export const isRentDay = (state: GameState): boolean => state.day > 1 && (state.day - 1) % RENT_PERIOD === 0 && state.landlordDay !== state.day && state.rentDue > 0;

export const ratingAll = (state: GameState): number => (state.reviews.count ? state.reviews.sum / state.reviews.count : 0);

/**
 * Closes the books for the day: pays rent and wages, throws away spoiled stock,
 * and records a log. The supermarket bill was already paid in cash, so it is shown
 * for information but not subtracted twice.
 */
export function closeDay(state: GameState, t: DayTally): DayLog {
  const wages = wagesPerDay(state);
  const rent = rentPerDay(state);
  const upkeep = upkeepPerDay(state);
  const utilities = utilitiesPerDay(state);
  const spoiled = spoil(state.inventory, state.day);
  const waste = spoiled.value;
  const fee = Math.round(t.deliverySales * DELIVERY_FEE);
  const interest = Math.round(state.loan * LOAN_RATE_DAY);
  const operating = t.revenue - fee - t.cogs - wages - rent - upkeep - utilities - waste - interest;
  const tax = Math.max(0, Math.round(operating * TAX_RATE));
  const reviewSum = t.reviews.reduce((a, b) => a + b, 0);
  state.reviews.count += t.reviews.length;
  state.reviews.sum += reviewSum;
  const repBefore = state.reputation;
  state.reputation = Math.max(1, Math.min(5, state.reputation + t.repDelta));
  const log: DayLog = {
    day: state.day,
    revenue: Math.round(t.revenue),
    cogs: Math.round(t.cogs),
    wages,
    rent,
    waste: Math.round(waste),
    upkeep,
    setup: state.pendingSetup,
    shopping: Math.round(state.pendingShopping),
    // accrual view: what the day really cost, ingredients counted when used or wasted
    profit: Math.round(operating - tax - state.pendingSetup),
    cupsSold: t.cupsSold,
    served: t.served,
    lost: t.lost,
    feedback: t.feedback,
    requests: t.requests,
    sales: t.sales,
    repBefore,
    repAfter: state.reputation,
    event: t.event,
    visitors: t.visitors,
    dineIn: t.dineIn,
    takeaway: t.takeaway,
    deliveryOrders: t.deliveryOrders,
    deliverySales: Math.round(t.deliverySales),
    deliveryFee: fee,
    deliveryCancelled: t.deliveryCancelled,
    reviewCount: t.reviews.length,
    reviewSum,
    ratingAll: ratingAll(state),
    tax,
    interest,
    utilities,
    wasteItems: spoiled.detail,
  };
  // rent is owed to the landlord until they come to collect; tax waits at the bank
  state.cash += t.revenue - fee - wages - upkeep - utilities - interest;
  state.rentDue += rent;
  state.taxDue += tax;
  // unused coupons expire; today's 5-star reviewers bring theirs tomorrow
  state.coupons = t.couponsGiven;
  state.pendingSetup = 0;
  state.pendingShopping = 0;
  state.history.push(log);
  return log;
}

/** The morning the landlord next comes, seen from the end of `day`. */
export function nextRentMorning(day: number): number {
  let m = day + 1;
  while ((m - 1) % RENT_PERIOD !== 0) m++;
  return m;
}

/** What the shop is really worth: cash minus everything still owed. */
export const netWorth = (state: GameState): number => state.cash + state.deposit - state.rentDue - state.taxDue - state.loan;
