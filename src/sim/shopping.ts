import type { Ingredient } from '../data/ingredients';
import { MENU } from '../data/menus';
import type { GameState } from './GameState';
import { estimateCups } from './demand';
import { stock } from './economy';

/**
 * How many units MIYU suggests buying, as a deliberately vague range.
 * Fresh goods are suggested for one day; dry goods can be bought for two.
 */
export function suggestion(state: GameState, ing: Ingredient): { low: number; high: number } | null {
  const uses = state.menus.filter((id) => MENU[id].recipe[ing.id]);
  if (!uses.length) return null;
  const { low, high } = estimateCups(state);
  const share = uses.reduce((s, id) => s + MENU[id].recipe[ing.id], 0) / state.menus.length;
  const have = stock(state.inventory, ing.id);
  const days = ing.shelfLife ? 1 : 2;
  const lo = Math.max(0, Math.ceil((low * share - have) / ing.servings));
  const hi = Math.max(lo, Math.ceil((high * share * days - have) / ing.servings));
  return { low: lo, high: hi };
}
