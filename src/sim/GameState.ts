import type { StrategyId } from '../data/strategies';
import { MENU } from '../data/menus';
import type { ShopSize } from '../data/shopSizes';
import type { Furniture } from '../data/furniture';
import { defaultPromos, type Promos } from './pricing';
import { newResearch, type ResearchState } from './research';
import { newCoopNotes, type CoopNotes, type Recipe } from './taste';

export interface Batch {
  ing: string;
  servings: number;
  /** Last day this batch can be used; null = keeps for the whole demo. */
  expires: number | null;
}

export type FeedbackKind = 'expensive' | 'slow' | 'custom' | 'request' | 'compliment' | 'outOfStock' | 'leftAngry' | 'closed' | 'noSeat' | 'wrongOrder';

export interface DayLog {
  day: number;
  revenue: number;
  cogs: number;
  wages: number;
  rent: number;
  waste: number;
  upkeep: number;
  setup: number;
  shopping: number;
  profit: number;
  cupsSold: number;
  served: number;
  lost: number;
  feedback: Record<FeedbackKind, number>;
  requests: Record<string, number>;
  sales: Record<string, number>;
  repBefore: number;
  repAfter: number;
  event?: string;
  /** Customers who walked in, and how they had their drink. */
  visitors: number;
  dineIn: number;
  takeaway: number;
  /** Delivery app: orders done, gross sales, the app's 30% cut, orders cancelled. */
  deliveryOrders: number;
  deliverySales: number;
  deliveryFee: number;
  deliveryCancelled: number;
  /** Reviews written today: how many and the stars added up. */
  reviewCount: number;
  reviewSum: number;
  /** Average stars of every review so far, after today. */
  ratingAll: number;
  /** Income tax set aside on today's profit, and loan interest paid. */
  tax: number;
  interest: number;
  utilities: number;
  /** What spoiled tonight: servings thrown away and their cost, by ingredient. */
  wasteItems: Record<string, { servings: number; value: number }>;
}

export interface DeliverySettings {
  on: boolean;
  /** Prices shown in the delivery app; the app keeps DELIVERY_FEE of each sale. */
  prices: Record<string, number>;
}

export interface GameState {
  version: 1;
  playerKey: 'player_m' | 'player_f';
  /** What the player typed when MIW asked; empty until then. */
  playerName?: string;
  day: number;
  cash: number;
  reputation: number;
  menus: string[];
  prices: Record<string, number>;
  staff: string[];
  location: string | null;
  strategy: StrategyId | null;
  shopSize: ShopSize;
  /** What was bought at the furniture store; undefined until the player has been there. */
  furniture?: Furniture;
  inventory: Batch[];
  history: DayLog[];
  /** One-off costs not yet shown in a day's accounts (shop setup, decoration). */
  pendingSetup: number;
  /** Money spent at the supermarket since the last summary. */
  pendingShopping: number;
  /** Menu ideas customers asked for and the player noted down. */
  ideas: Record<string, number>;
  /** Where to resume after loading a save. */
  checkpoint: 'setup' | 'morning';
  delivery: DeliverySettings;
  /** Every review ever written: count and total stars, for the running average. */
  reviews: { count: number; sum: number };
  /** Rent owed since the landlord last came, and how many times payment was put off. */
  rentDue: number;
  rentLate: number;
  /** Day the landlord last visited, so a visit happens once. */
  landlordDay: number;
  /** Rent deposit held by the landlord (refundable). */
  deposit: number;
  /** Bank loan still owed, and income tax set aside but not yet paid. */
  loan: number;
  taxDue: number;
  promos: Promos;
  /** Coupons from 5-star reviews still waiting to be used. */
  coupons: number;
  /** Market research before opening: time and energy left, and what was studied where. */
  research: ResearchState;
  /** House recipe per menu (sweetness, strength); missing = standard. */
  recipes: Record<string, Recipe>;
  /** What the team found out together in co-op play: interview notes and recipe ideas. */
  coop: CoopNotes;
}

/** Savings plus a little help from family: enough for a kiosk, or a small shop if careful. */
export const START_CASH = 180000;

/** Fields added after the first release; also used to upgrade older saves. */
const LATER_FIELDS = (): Pick<GameState, 'delivery' | 'reviews' | 'rentDue' | 'rentLate' | 'landlordDay' | 'loan' | 'taxDue' | 'deposit' | 'promos' | 'coupons' | 'research' | 'recipes' | 'coop'> => ({
  delivery: { on: false, prices: {} },
  reviews: { count: 0, sum: 0 },
  rentDue: 0,
  rentLate: 0,
  landlordDay: 0,
  loan: 0,
  taxDue: 0,
  deposit: 0,
  promos: defaultPromos(),
  coupons: 0,
  research: newResearch(),
  recipes: {},
  coop: newCoopNotes(),
});
export const DEMO_DAYS = 7;
const SAVE_KEY = 'bubble-tea-journey-save';

export function newGame(playerKey: GameState['playerKey'] = 'player_m'): GameState {
  return {
    version: 1,
    playerKey,
    day: 1,
    cash: START_CASH,
    reputation: 3,
    menus: [],
    prices: {},
    staff: [],
    location: null,
    strategy: null,
    shopSize: 'catcafe',
    inventory: [],
    history: [],
    pendingSetup: 0,
    pendingShopping: 0,
    ideas: {},
    checkpoint: 'setup',
    ...LATER_FIELDS(),
  };
}

/** The single live game state, shared by every scene. */
export let G: GameState = newGame();

export function resetGame(playerKey: GameState['playerKey']): void {
  G = newGame(playerKey);
}

/** Replaces the whole state, e.g. with the host's copy in a co-op room. */
export function replaceGame(state: GameState): void {
  G = { ...LATER_FIELDS(), ...state };
}

export function setMenus(ids: string[]): void {
  G.menus = ids;
  for (const id of ids) {
    if (G.prices[id] === undefined) G.prices[id] = MENU[id].basePrice;
    // apps usually list drinks a little dearer to cover their cut
    if (G.delivery.prices[id] === undefined) G.delivery.prices[id] = G.prices[id] + 10;
  }
}

export function saveGame(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(G));
  } catch {
    // storage unavailable: the game still works, it just can't resume
  }
}

export function hasSave(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return !!raw && JSON.parse(raw).checkpoint === 'morning';
  } catch {
    return false;
  }
}

export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as GameState;
    if (data.version !== 1) return false;
    G = { ...LATER_FIELDS(), ...data };
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
