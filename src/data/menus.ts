import { costPerServing } from './ingredients';

export type Segment = 'student' | 'worker' | 'family';

export interface Menu {
  id: string;
  name: string;
  short: string;
  basePrice: number;
  recipe: Record<string, number>;
  /** Relative popularity for each customer group. */
  appeal: Record<Segment, number>;
  color: string;
  layer?: string;
  topping?: string;
  /** Seconds to make one cup when working alone. */
  makeTime: number;
  signature?: boolean;
}

const BASE = { cups: 1, ice: 1 };
const PEARL = '#3b2626';

export const MENUS: Menu[] = [
  { id: 'pearl_milk_tea', name: 'ชานมไข่มุก', short: 'ชานมไข่มุก', basePrice: 45, recipe: { ...BASE, tea_black: 1, milk: 1, pearls: 1, syrup: 1 }, appeal: { student: 1.4, worker: 1, family: 1.1 }, color: '#d9a877', topping: PEARL, makeTime: 6 },
  { id: 'green_tea', name: 'ชาเขียวนม', short: 'ชาเขียว', basePrice: 50, recipe: { ...BASE, tea_green: 1, milk: 1, syrup: 1 }, appeal: { student: 1, worker: 1.2, family: 0.8 }, color: '#a8d58a', makeTime: 5 },
  { id: 'thai_tea', name: 'ชาไทย', short: 'ชาไทย', basePrice: 40, recipe: { ...BASE, tea_thai: 1, creamer: 1, syrup: 1 }, appeal: { student: 1.2, worker: 1.1, family: 1 }, color: '#f39a4f', makeTime: 5 },
  { id: 'brown_sugar', name: 'นมสดบราวน์ชูการ์', short: 'บราวน์ชูการ์', basePrice: 55, recipe: { ...BASE, milk: 1, brown_sugar: 1, pearls: 1 }, appeal: { student: 1.3, worker: 0.9, family: 0.9 }, color: '#f3e6d6', layer: '#9a5a2e', topping: PEARL, makeTime: 7 },
  { id: 'cocoa', name: 'โกโก้เย็น', short: 'โกโก้', basePrice: 45, recipe: { ...BASE, cocoa: 1, milk: 1, syrup: 1 }, appeal: { student: 0.9, worker: 0.7, family: 1.4 }, color: '#8a5a3e', makeTime: 5 },
  { id: 'peach_tea', name: 'ชาพีช', short: 'ชาพีช', basePrice: 45, recipe: { ...BASE, tea_black: 1, peach: 1 }, appeal: { student: 0.9, worker: 1.2, family: 1 }, color: '#ffb38a', makeTime: 4 },
  { id: 'taro', name: 'ชานมเผือก', short: 'ชานมเผือก', basePrice: 50, recipe: { ...BASE, taro: 1, milk: 1, pearls: 1 }, appeal: { student: 1.1, worker: 0.8, family: 1.2 }, color: '#c9a8e6', topping: PEARL, makeTime: 6 },
  { id: 'fresh_milk', name: 'นมสดเย็น', short: 'นมสด', basePrice: 35, recipe: { ...BASE, milk: 1, syrup: 1 }, appeal: { student: 0.8, worker: 0.6, family: 1.5 }, color: '#fbf6f0', makeTime: 3 },
  { id: 'signature', name: 'ชาไทยบราวน์ชูการ์ (ซิกเนเจอร์)', short: 'ซิกเนเจอร์', basePrice: 65, recipe: { ...BASE, tea_thai: 1, creamer: 1, brown_sugar: 1, pearls: 1 }, appeal: { student: 1.5, worker: 1.2, family: 1.1 }, color: '#f39a4f', layer: '#fff4d6', topping: PEARL, makeTime: 8, signature: true },
];

export const MENU = Object.fromEntries(MENUS.map((m) => [m.id, m])) as Record<string, Menu>;

export function cupCost(menuId: string): number {
  return Object.entries(MENU[menuId].recipe).reduce((sum, [ing, q]) => sum + costPerServing(ing) * q, 0);
}
