import type { GameState, DeliverySettings } from '../sim/GameState';
import type { Promos } from '../sim/pricing';
import { addPurchase, cartTotal, isRentDay, LATE_FEE, LOAN_LIMIT } from '../sim/economy';
import { ING } from '../data/ingredients';
import { MENU } from '../data/menus';
import { baht } from '../game/format';
import { rivalsFor, visitRival, VISITS_PER_MORNING, type Level } from '../sim/taste';

/** Changes to the shared game a player asks for; the host applies them so everyone stays in step. */
export type Action =
  | { k: 'buy'; cart: Record<string, number> }
  | { k: 'borrow'; n: number }
  | { k: 'repay'; n: number }
  | { k: 'payTax' }
  | { k: 'rent'; how: 'pay' | 'delay' }
  | { k: 'recipe'; menuId: string; field: 'sweet' | 'strength'; value: Level }
  | { k: 'propose'; menuId: string; field: 'sweet' | 'strength'; value: Level; reason: string }
  | { k: 'proposal'; id: number; status: 'applied' | 'rejected' }
  | { k: 'visit'; name: string }
  | { k: 'pricing'; prices: Record<string, number>; delivery: DeliverySettings; promos: Promos }
  | { k: 'role'; id: string; role: import('./roles').RoleId }
  | { k: 'ready'; on: boolean }
  | { k: 'rotate' };

/** Rent this morning: nothing to do, owed, or so far behind that the shop is lost. */
export function rentStatus(state: GameState): 'none' | 'due' | 'evict' {
  if (!isRentDay(state)) return 'none';
  return state.rentLate > 0 && state.cash + (LOAN_LIMIT - state.loan) < state.rentDue ? 'evict' : 'due';
}

const nextId = (state: GameState): number => Math.max(0, ...state.coop.insights.map((i) => i.id), ...state.coop.proposals.map((p) => p.id)) + 1;

/** Applies one action to the game. Returns an error to show the player, or null. */
export function applyAction(state: GameState, a: Action, who: string): string | null {
  switch (a.k) {
    case 'buy': {
      const cart = Object.fromEntries(Object.entries(a.cart).filter(([ing, n]) => ING[ing] && n > 0));
      const { net } = cartTotal(cart);
      if (!net) return 'ยังไม่ได้เลือกของ';
      if (net > state.cash) return `เงินสดไม่พอ ขาดอีก ${baht(net - state.cash)}`;
      for (const [ing, n] of Object.entries(cart)) addPurchase(state.inventory, ing, n, state.day);
      state.cash -= net;
      state.pendingShopping += net;
      return null;
    }
    case 'borrow':
      if (a.n <= 0 || state.loan + a.n > LOAN_LIMIT) return `กู้ได้สูงสุด ${baht(LOAN_LIMIT)}`;
      state.loan += a.n;
      state.cash += a.n;
      return null;
    case 'repay': {
      const n = Math.min(a.n, state.loan);
      if (n <= 0 || n > state.cash) return 'เงินสดไม่พอคืน';
      state.loan -= n;
      state.cash -= n;
      return null;
    }
    case 'payTax':
      if (!state.taxDue) return null;
      if (state.taxDue > state.cash) return 'เงินสดไม่พอจ่ายภาษี';
      state.cash -= state.taxDue;
      state.taxDue = 0;
      return null;
    case 'rent':
      if (!isRentDay(state)) return null;
      if (a.how === 'pay') {
        if (state.cash < state.rentDue) return `เงินสดไม่พอ ขาดอีก ${baht(state.rentDue - state.cash)} ลองกู้ธนาคารก่อน`;
        state.cash -= state.rentDue;
        state.rentDue = 0;
        state.rentLate = 0;
      } else {
        if (state.rentLate > 0) return 'ผัดไปแล้วรอบหนึ่ง ผัดอีกไม่ได้';
        state.rentDue = Math.round(state.rentDue * (1 + LATE_FEE));
        state.rentLate = 1;
      }
      state.landlordDay = state.day;
      return null;
    case 'recipe':
      if (!MENU[a.menuId]) return null;
      state.recipes[a.menuId] = { ...(state.recipes[a.menuId] ?? { sweet: 1, strength: 1 }), [a.field]: a.value };
      return null;
    case 'propose':
      state.coop.proposals.push({ id: nextId(state), day: state.day, menuId: a.menuId, field: a.field, value: a.value, reason: a.reason.slice(0, 160), from: who, status: 'new' });
      return null;
    case 'proposal': {
      const p = state.coop.proposals.find((x) => x.id === a.id);
      if (!p || p.status !== 'new') return null;
      p.status = a.status;
      if (a.status === 'applied') return applyAction(state, { k: 'recipe', menuId: p.menuId, field: p.field, value: p.value }, who);
      return null;
    }
    case 'visit': {
      const notes = state.coop;
      if (notes.visitDay !== state.day) {
        notes.visitDay = state.day;
        notes.visits = 0;
      }
      if (notes.visits >= VISITS_PER_MORNING) return `เช้านี้ไปสำรวจครบ ${VISITS_PER_MORNING} ร้านแล้ว`;
      const rival = rivalsFor(state).find((r) => r.name === a.name);
      if (!rival) return null;
      notes.visits++;
      if (!notes.seen.includes(rival.name)) notes.seen.push(rival.name);
      notes.insights.push(...visitRival(state, rival, who, nextId(state)));
      return null;
    }
    case 'pricing':
      state.prices = { ...a.prices };
      state.delivery = a.delivery;
      state.promos = a.promos;
      return null;
    default:
      // roles and ready flags belong to the room, not the game
      return null;
  }
}
