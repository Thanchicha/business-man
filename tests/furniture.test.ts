import { describe, expect, it } from 'vitest';
import { SEATING_AREA, areaUsed, canAdd, canRemove, emptyFurniture, layout, seatCount, type FurnId, type Furniture } from '../src/data/furniture';
import { expectedCustomers } from '../src/sim/demand';
import { newGame } from '../src/sim/GameState';

const add = (f: Furniture, id: FurnId, n = 1): Furniture => {
  for (let i = 0; i < n; i++) {
    const c = canAdd(f, id);
    if (!c.ok) throw new Error(c.reason);
    f = { ...f, [id]: f[id] + 1 };
  }
  return f;
};

describe('furniture capacity', () => {
  it('needs a table before chairs and stools', () => {
    const f = emptyFurniture();
    expect(canAdd(f, 'chair_wood').ok).toBe(false);
    const t = add(f, 'table_wood');
    expect(add(t, 'chair_wood', 2).chair_wood).toBe(2);
    expect(canAdd(add(t, 'chair_wood', 2), 'stool').ok).toBe(false);
  });

  it('never lets the floor area go over the limit', () => {
    let f = emptyFurniture();
    f = add(f, 'sofa', 4);
    f = add(f, 'table_long', 2);
    expect(areaUsed(f)).toBeLessThanOrEqual(SEATING_AREA);
    for (const id of ['table_wood', 'table_long', 'sofa', 'stool', 'chair_wood'] as FurnId[]) {
      let g = f;
      while (canAdd(g, id).ok) g = { ...g, [id]: g[id] + 1 };
      expect(areaUsed(g)).toBeLessThanOrEqual(SEATING_AREA);
    }
  });

  it('limits sofas to the window spots and tables to the table spots', () => {
    expect(canAdd(add(emptyFurniture(), 'sofa', 4), 'sofa').ok).toBe(false);
    expect(canAdd(add(emptyFurniture(), 'table_wood', 6), 'table_wood').ok).toBe(false);
  });

  it('refuses to remove a table that chairs depend on', () => {
    const f = add(add(emptyFurniture(), 'table_wood'), 'chair_wood', 2);
    expect(canRemove(f, 'table_wood').ok).toBe(false);
    expect(canRemove(f, 'chair_wood').ok).toBe(true);
  });

  it('places every piece it was given and counts only usable seats', () => {
    const f = add(add(add(emptyFurniture(), 'table_long'), 'chair_wood', 3), 'sofa', 2);
    expect(layout(f)).toHaveLength(1 + 3 + 2);
    expect(seatCount(f)).toBe(3 + 4);
  });

  it('more seats bring more customers to a cat café', () => {
    const base = newGame();
    base.shopSize = 'catcafe';
    const none = { ...base, furniture: emptyFurniture() };
    const seated = { ...base, furniture: add(add(emptyFurniture(), 'table_long'), 'chair_wood', 4) };
    expect(expectedCustomers(seated)).toBeGreaterThan(expectedCustomers(none));
  });
});
