import { MENU, type Segment } from '../data/menus';
import { LOCATION, marketPrice } from '../data/locations';
import { SHOP_SIZES } from '../data/shopSizes';
import { seatDemandFactor } from '../data/furniture';
import type { GameState } from './GameState';
import { dayConfig, type DayConfig } from './difficulty';
import { clearanceMenus, staffBonus } from './economy';
import { COUPON_RETURN, groupOdds, orderTotal, perceived, promoDemand } from './pricing';

export type Personality = 'sleepy' | 'shy' | 'chatty' | 'picky' | 'rushed' | 'foodie';

export interface CustomerPlan {
  id: number;
  /** Arrival time as a fraction of opening hours (0 = open, 1 = close). */
  arriveAt: number;
  segment: Segment;
  personality: Personality;
  /** Texture key for named regulars, otherwise a seed for a random look. */
  regular?: 'cust_sleepy' | 'cust_shy';
  seed: number;
  menuId: string;
  cups: number;
  /** Price this customer finds fair for one cup. */
  wtp: number;
  patience: number;
  wantsCustom: boolean;
  request: string | null;
  /** Wants to sit and drink in the shop (if a seat is free) rather than take it away. */
  dineIn: boolean;
  /** Came back with a coupon from a 5-star review. */
  coupon: boolean;
}

/** An order that arrives through the delivery app. */
export interface DeliveryOrder {
  id: number;
  arriveAt: number;
  menuId: string;
  cups: number;
  seed: number;
}

/** Menu ideas customers may ask for that the shop does not sell. */
export const IDEAS = ['ชีสโฟม', 'ชาผลไม้รวม', 'แบบไม่ใส่น้ำตาล', 'ท็อปปิ้งพุดดิ้ง', 'เมนูปั่น'];

export const WTP: Record<Segment, number> = { student: 42, worker: 58, family: 50 };
/** How strongly each group reacts to price. */
const SENSITIVITY: Record<Segment, number> = { student: 1.3, worker: 0.6, family: 1 };

/** How likely each group is to sit down rather than take the drink away. */
export const DINE_IN: Record<Segment, number> = { student: 0.5, worker: 0.25, family: 0.6 };

function groupCups(odds: { two: number; three: number }, roll: number): number {
  return roll < odds.three ? 3 : roll < odds.three + odds.two ? 2 : 1;
}

function weighted<T>(items: [T, number][], roll: number): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of items) {
    acc += w / total;
    if (roll <= acc) return v;
  }
  return items[items.length - 1][0];
}

export function averagePrice(state: GameState): number {
  if (!state.menus.length) return 45;
  return state.menus.reduce((s, id) => s + (state.prices[id] ?? MENU[id].basePrice), 0) / state.menus.length;
}

/** Demand multiplier from pricing relative to what the area is used to. */
export function priceFactor(state: GameState): number {
  const loc = state.location ? LOCATION[state.location] : null;
  // what a single cup really costs after promotions, as customers feel it
  const felt = state.menus.length ? state.menus.reduce((s, id) => s + perceived(orderTotal(state, id, 1)), 0) / state.menus.length : 45;
  const ratio = felt / (loc ? marketPrice(loc) : 45);
  const mix = loc?.mix ?? { student: 0.4, worker: 0.3, family: 0.3 };
  const sens = mix.student * SENSITIVITY.student + mix.worker * SENSITIVITY.worker + mix.family * SENSITIVITY.family;
  return Math.max(0.5, Math.min(1.45, 1 - 0.9 * sens * (ratio - 1)));
}

/** Expected number of customers for a day, before randomness. */
export function expectedCustomers(state: GameState, cfg: DayConfig = dayConfig(state)): number {
  const loc = state.location ? LOCATION[state.location] : null;
  const traffic = loc?.traffic ?? 1;
  const rivals = loc?.competitors.length ?? 1;
  const rep = 0.7 + 0.1 * state.reputation;
  const competition = 1 / (1 + 0.15 * rivals);
  const variety = 0.82 + 0.06 * Math.min(state.menus.length, 6);
  const strat = state.strategy === 'creative' ? 1.12 : state.strategy === 'cozy' ? 1.06 : 1;
  const size = SHOP_SIZES[state.shopSize].demandMult * (state.furniture && state.shopSize === 'catcafe' ? seatDemandFactor(state.furniture) : 1);
  const n = 19 * traffic * cfg.customerMult * rep * competition * variety * strat * size * priceFactor(state) * promoDemand(state) * (cfg.event?.demandMult ?? 1);
  return Math.max(6, Math.min(32, n));
}

/** A rough range of cups to prepare, used by the advisor. Deliberately vague. */
export function estimateCups(state: GameState): { low: number; high: number } {
  const n = expectedCustomers(state);
  return { low: Math.round(n * 0.9), high: Math.round(n * 1.6) };
}

export function wtpFor(state: GameState, segment: Segment, menuId: string): number {
  let w = WTP[segment] * (1 + 0.05 * (state.reputation - 3));
  if (state.strategy === 'cozy' || state.shopSize === 'catcafe') w *= 1.05;
  if (MENU[menuId].signature) w *= 1.2;
  return w;
}

export function planDay(state: GameState, rnd: () => number): { customers: CustomerPlan[]; config: DayConfig } {
  const config = dayConfig(state);
  const loc = state.location ? LOCATION[state.location] : null;
  const mix = { ...(loc?.mix ?? { student: 0.4, worker: 0.3, family: 0.3 }) };
  for (const [seg, boost] of Object.entries(config.event?.segmentBoost ?? {})) mix[seg as Segment] *= boost as number;
  // no menus means nothing to sell (the UI normally prevents this)
  const returning = state.menus.length ? Math.round(state.coupons * COUPON_RETURN) : 0;
  const n = state.menus.length ? Math.round(expectedCustomers(state, config) * (0.9 + rnd() * 0.2)) + returning : 0;
  const couponStep = Math.max(1, Math.floor(n / Math.max(1, returning)));
  const onSale = state.promos.clearance?.on ? clearanceMenus(state) : [];
  const bonus = staffBonus(state);
  const customers: CustomerPlan[] = [];
  const missing = Object.keys(MENU).filter((id) => !state.menus.includes(id) && !MENU[id].signature);

  for (let i = 0; i < n; i++) {
    const segment = weighted(Object.entries(mix) as [Segment, number][], rnd());
    let personality: Personality = weighted(
      [
        ['chatty', 3],
        ['picky', 2],
        ['foodie', 2],
        ['shy', 2],
        ['sleepy', 1],
        ['rushed', segment === 'worker' ? 4 : 1],
      ],
      rnd(),
    );
    let regular: CustomerPlan['regular'];
    // the two regulars show up once a day after day 1
    if (i === Math.floor(n * 0.3) && state.day > 1) {
      regular = 'cust_sleepy';
      personality = 'sleepy';
    } else if (i === Math.floor(n * 0.6) && state.day > 1) {
      regular = 'cust_shy';
      personality = 'shy';
    } else if (i === 2 && state.day === 1) {
      regular = 'cust_shy';
      personality = 'shy';
    }
    const menuId = weighted(
      // a clearance sale steers customers towards the discounted drinks
      state.menus.map((id) => [id, MENU[id].appeal[segment] * (MENU[id].signature ? 1.4 : 1) * (onSale.includes(id) ? 1.7 : 1)] as [string, number]),
      rnd(),
    );
    let patience = config.patience + bonus.patience;
    if (personality === 'sleepy') patience += 10;
    if (personality === 'shy') patience += 5;
    if (personality === 'rushed') patience -= 10;
    const requestRoll = rnd();
    customers.push({
      id: i,
      arriveAt: Math.min(0.92, (i + rnd() * 0.8) / n * 0.92),
      segment,
      personality,
      regular,
      seed: state.day * 1000 + i,
      menuId,
      cups: groupCups(groupOdds(state, segment === 'family'), rnd()),
      wtp: wtpFor(state, segment, menuId),
      patience: Math.max(15, patience),
      wantsCustom: personality === 'picky' || rnd() < 0.1,
      dineIn: personality !== 'rushed' && rnd() < DINE_IN[segment],
      // coupon holders are spread through the day
      coupon: returning > 0 && i % couponStep === 0 && i / couponStep < returning,
      request:
        personality === 'foodie' || requestRoll < 0.12
          ? missing.length && rnd() < 0.5
            ? MENU[missing[Math.floor(rnd() * missing.length)]].short
            : IDEAS[Math.floor(rnd() * IDEAS.length)]
          : null,
    });
  }
  customers.sort((a, b) => a.arriveAt - b.arriveAt);
  return { customers, config };
}

/** Orders a day brings through the delivery app; none when delivery is switched off. */
export function planDelivery(state: GameState, rnd: () => number, cfg: DayConfig = dayConfig(state)): DeliveryOrder[] {
  if (!state.delivery.on || !state.menus.length) return [];
  const loc = state.location ? LOCATION[state.location] : null;
  // app users compare with what other shops charge in the app, a little above shop prices
  const appMarket = (loc ? marketPrice(loc) : 45) + 12;
  const felt = state.menus.reduce((s, id) => s + perceived(state.delivery.prices[id] ?? MENU[id].basePrice + 10), 0) / state.menus.length;
  const priceF = Math.max(0.3, Math.min(1.4, 1 - 1.1 * (felt / appMarket - 1)));
  const rain = cfg.event?.id === 'rain' ? 1.6 : 1;
  const rep = 0.7 + 0.1 * state.reputation;
  const n = Math.round(6 * rep * cfg.customerMult * priceF * rain * (0.85 + rnd() * 0.3));
  const out: DeliveryOrder[] = [];
  for (let i = 0; i < n; i++) {
    const menuId = weighted(state.menus.map((id) => [id, MENU[id].appeal.family + MENU[id].appeal.worker] as [string, number]), rnd());
    out.push({ id: i, arriveAt: Math.min(0.9, 0.05 + ((i + rnd()) / n) * 0.85), menuId, cups: rnd() < 0.3 ? 2 : 1, seed: state.day * 5000 + i });
  }
  return out.sort((a, b) => a.arriveAt - b.arriveAt);
}
