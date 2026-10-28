import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/GameState';
import { stock } from '../src/sim/economy';
import { makePenalty, NORMAL_SPEC, tasteFit, tastePref } from '../src/sim/taste';
import { MENUS } from '../src/data/menus';
import { applyAction, rentStatus } from '../src/coop/actions';
import { autoRole, rotateRoles } from '../src/coop/roles';

describe('house recipes', () => {
  it('the standard recipe changes nothing, so solo play is as before', () => {
    const s = newGame();
    for (const m of MENUS) for (const seg of ['student', 'worker', 'family'] as const) expect(tasteFit(s, m.id, seg)).toBe(0);
  });

  it('matching what a group likes helps, going the wrong way hurts', () => {
    const s = newGame();
    const want = tastePref('thai_tea', 'student');
    s.recipes.thai_tea = { sweet: want.sweet, strength: 1 };
    const right = tasteFit(s, 'thai_tea', 'student');
    s.recipes.thai_tea = { sweet: (2 - want.sweet) as 0 | 1 | 2, strength: 1 };
    expect(right).toBeGreaterThanOrEqual(tasteFit(s, 'thai_tea', 'student'));
  });

  it('a wrong menu costs more than a wrong detail', () => {
    const order = { menuId: 'thai_tea', spec: NORMAL_SPEC };
    expect(makePenalty(order, order)).toBe(0);
    expect(makePenalty(order, { menuId: 'thai_tea', spec: { ...NORMAL_SPEC, ice: 2 } })).toBeLessThan(makePenalty(order, { menuId: 'cocoa', spec: NORMAL_SPEC }));
  });
});

describe('team actions', () => {
  it('buying adds stock and takes the money', () => {
    const s = newGame();
    const cash = s.cash;
    expect(applyAction(s, { k: 'buy', cart: { milk: 2 } }, 'A')).toBeNull();
    expect(stock(s.inventory, 'milk')).toBe(50);
    expect(s.cash).toBe(cash - 190);
    s.cash = 10;
    expect(applyAction(s, { k: 'buy', cart: { milk: 2 } }, 'A')).not.toBeNull();
  });

  it('a recipe idea from the scout changes the recipe once applied', () => {
    const s = newGame();
    applyAction(s, { k: 'propose', menuId: 'cocoa', field: 'sweet', value: 0, reason: 'หวานไป' }, 'Scout');
    const p = s.coop.proposals[0];
    applyAction(s, { k: 'proposal', id: p.id, status: 'applied' }, 'Barista');
    expect(s.recipes.cocoa.sweet).toBe(0);
    expect(p.status).toBe('applied');
  });

  it('rent can be put off once, then the shop is lost if money cannot be found', () => {
    const s = newGame();
    s.day = 4;
    s.rentDue = 3000;
    expect(rentStatus(s)).toBe('due');
    applyAction(s, { k: 'rent', how: 'delay' }, 'A');
    expect(s.rentDue).toBe(3300);
    s.day = 7;
    s.cash = 0;
    s.loan = 100000;
    expect(rentStatus(s)).toBe('evict');
  });
});

describe('roles', () => {
  it('new players fill free jobs, then a second barista', () => {
    expect(autoRole(['cashier'])).toBe('barista');
    expect(autoRole(['cashier', 'barista', 'scout'])).toBe('barista');
  });

  it('rotating keeps jobs different and gives everyone a new one', () => {
    const ps = [{ role: 'cashier' as const }, { role: 'barista' as const }, { role: 'scout' as const }].map((p) => ({ ...p })) as { role: 'cashier' | 'barista' | 'scout' }[];
    rotateRoles(ps);
    expect(ps.map((p) => p.role)).toEqual(['barista', 'scout', 'cashier']);
  });
});
