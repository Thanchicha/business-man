import { h } from '../ui/dom';
import { snapshot } from '../three/portrait';
import { bubbleTea } from '../three/models/props';
import { MENU } from '../data/menus';

/** Image of the 3D cup for a menu. */
export function cupIcon(menuId: string, size = 64): HTMLImageElement {
  const m = MENU[menuId];
  const src = snapshot(`cup|${menuId}`, () => bubbleTea(m.color, !!m.topping, m.layer), undefined, 1.0);
  return h('img', { src, width: size, height: size, style: { display: 'block', margin: '0 auto' } });
}

export const ING_ICON: Record<string, string> = {
  tea_black: '🍂',
  tea_green: '🍵',
  tea_thai: '🧡',
  cocoa: '🍫',
  taro: '🟣',
  milk: '🥛',
  creamer: '🥫',
  ice: '🧊',
  syrup: '🍯',
  brown_sugar: '🟤',
  peach: '🍑',
  pearls: '⚫',
  cups: '🥤',
};
