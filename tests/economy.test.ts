import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/GameState';
import { addPurchase, bulkDiscount, canMake, cartTotal, closeDay, consume, cupsPossible, DELIVERY_FEE, emptyTally, haggle, TAX_RATE, spoil, stock } from '../src/sim/economy';
import { cupCost } from '../src/data/menus';
import { expectedCustomers, planDay, priceFactor } from '../src/sim/demand';
import { rng } from '../src/sim/rng';
import { finalSatisfaction, intentFor, resolve } from '../src/sim/service';

function stocked() {
  const s = newGame();
  s.menus = ['pearl_milk_tea', 'thai_tea'];
  s.prices = { pearl_milk_tea: 45, thai_tea: 40 };
  for (const ing of ['tea_black', 'milk', 'pearls', 'syrup', 'cups', 'ice', 'tea_thai', 'creamer']) addPurchase(s.inventory, ing, 2, 1);
  return s;
}

describe('stock', () => {
  it('consumes oldest batches first and returns the cup cost', () => {
    const s = stocked();
    addPurchase(s.inventory, 'milk', 1, 2);
    const cost = consume(s.inventory, 'pearl_milk_tea', 3);
    expect(cost).toBeCloseTo(cupCost('pearl_milk_tea') * 3);
    expect(stock(s.inventory, 'milk')).toBe(72);
    // the day-1 batch (expires day 2) was used before the day-2 batch
    expect(s.inventory.find((b) => b.ing === 'milk' && b.expires === 3)!.servings).toBe(25);
  });

  it('knows when a menu cannot be made', () => {
    const s = stocked();
    expect(cupsPossible(s.inventory, 'pearl_milk_tea')).toBe(40); // pearls: 2 bags x 20
    consume(s.inventory, 'pearl_milk_tea', 40);
    expect(canMake(s.inventory, 'pearl_milk_tea')).toBe(false);
  });

  it('keeps raw cost per cup near real Thai shop figures (about 10-15 baht)', () => {
    expect(cupCost('pearl_milk_tea')).toBeGreaterThan(10);
    expect(cupCost('pearl_milk_tea')).toBeLessThan(16);
    expect(cupCost('thai_tea')).toBeLessThan(12);
  });

  it('throws away milk after its shelf life and ice at the end of the day', () => {
    const s = stocked();
    const day1 = spoil(s.inventory, 1);
    expect(day1.items.ice).toBe(200);
    expect(stock(s.inventory, 'milk')).toBe(50);
    spoil(s.inventory, 2);
    expect(stock(s.inventory, 'milk')).toBe(0);
    expect(stock(s.inventory, 'tea_black')).toBe(100);
  });
});

describe('shopping', () => {
  it('gives volume discounts per line', () => {
    expect(bulkDiscount(4)).toBe(0);
    expect(bulkDiscount(5)).toBe(0.05);
    expect(bulkDiscount(10)).toBe(0.1);
    const t = cartTotal({ milk: 10, ice: 1 });
    expect(t.gross).toBe(950 + 45);
    expect(t.net).toBe(995 - 95);
  });

  it('only lets you haggle on big orders', () => {
    expect(haggle(800, 0)).toBe('tooSmall');
    expect(haggle(2000, 0.1)).toBe('success');
    expect(haggle(2000, 0.9)).toBe('fail');
  });
});

describe('accounts', () => {
  it('profit = revenue - ingredients used - wages - rent - upkeep - utilities - waste - tax - setup', () => {
    const s = stocked();
    s.location = 'village';
    s.staff = ['barista'];
    s.shopSize = 'catcafe';
    s.pendingSetup = 1000;
    const cogs = consume(s.inventory, 'thai_tea', 10);
    const cashBefore = s.cash;
    const log = closeDay(s, { ...emptyTally(), revenue: 400, cogs, cupsSold: 10, served: 10, repDelta: 0.1 });
    expect(log.rent).toBe(267);
    expect(log.wages).toBe(500); // 15,000 a month, above the 400/day Bangkok minimum
    expect(log.upkeep).toBe(150);
    expect(log.utilities).toBe(300);
    expect(log.tax).toBe(0); // a loss pays no tax
    expect(Math.abs(log.profit - (400 - cogs - 500 - 267 - 150 - 300 - log.waste - 1000))).toBeLessThanOrEqual(1);
    // rent is not taken from cash: it waits for the landlord
    expect(s.cash).toBe(cashBefore + 400 - 500 - 150 - 300);
    // and the waste report says what was thrown away
    expect(log.wasteItems.ice.servings).toBe(200 - 10); // 2 sacks, minus the 10 cups sold
    expect(s.rentDue).toBe(267);
    expect(s.reputation).toBeCloseTo(3.1);
  });

  it('kiosk rent is cheaper', () => {
    const s = stocked();
    s.location = 'village';
    s.shopSize = 'kiosk';
    const log = closeDay(s, emptyTally());
    expect(log.rent).toBe(Math.round(267 * 0.55));
  });
});

describe('delivery, tax and reviews', () => {
  it('the app keeps its cut and tax is set aside on profit', () => {
    const s = stocked();
    const cashBefore = s.cash;
    const log = closeDay(s, { ...emptyTally(), revenue: 1000, deliverySales: 500 });
    // GP 30% + VAT 7% = 32.1%
    expect(log.deliveryFee).toBe(Math.round(500 * DELIVERY_FEE));
    const fee = log.deliveryFee;
    // operating profit: sales − app fee − cat upkeep − electricity/water − ice melted at closing
    expect(Math.abs(log.tax - (1000 - fee - log.upkeep - log.utilities - log.waste) * TAX_RATE)).toBeLessThanOrEqual(1);
    expect(s.taxDue).toBe(log.tax);
    expect(s.cash).toBe(cashBefore + 1000 - fee - log.upkeep - log.utilities);
  });

  it('keeps a running star average weighted by the number of reviews', () => {
    const s = stocked();
    closeDay(s, { ...emptyTally(), reviews: [4, 4] });
    s.day++;
    const log = closeDay(s, { ...emptyTally(), reviews: [5, 5, 5, 1] });
    expect(log.reviewCount).toBe(4);
    expect(log.ratingAll).toBeCloseTo((8 + 16) / 6);
  });
});

describe('demand', () => {
  it('higher prices mean fewer customers', () => {
    const s = stocked();
    s.location = 'university';
    const normal = expectedCustomers(s);
    s.prices = { pearl_milk_tea: 70, thai_tea: 70 };
    expect(priceFactor(s)).toBeLessThan(1);
    expect(expectedCustomers(s)).toBeLessThan(normal);
  });

  it('busier locations bring more customers', () => {
    const s = stocked();
    s.location = 'village';
    const village = expectedCustomers(s);
    s.location = 'mall';
    expect(expectedCustomers(s)).toBeGreaterThan(village);
  });

  it('plans a day of customers who only order active menus', () => {
    const s = stocked();
    s.location = 'bts';
    const { customers } = planDay(s, rng(5));
    expect(customers.length).toBeGreaterThanOrEqual(6);
    for (const c of customers) expect(s.menus).toContain(c.menuId);
    for (let i = 1; i < customers.length; i++) expect(customers[i].arriveAt).toBeGreaterThanOrEqual(customers[i - 1].arriveAt);
  });
});

describe('service', () => {
  it('detects out of stock before anything else', () => {
    const s = stocked();
    s.location = 'village';
    const c = planDay(s, rng(1)).customers[0];
    s.inventory = [];
    expect(intentFor(s, c, 0.9)).toBe('outOfStock');
    expect(resolve(s, c, 'outOfStock', 'sorry', 0).buys).toBe(false);
  });

  it('long waits lower satisfaction', () => {
    const s = stocked();
    s.location = 'village';
    const c = planDay(s, rng(1)).customers[0];
    const o = resolve(s, c, 'order', 'accept', 0);
    expect(finalSatisfaction(s, c, o, 0.9)).toBeLessThan(finalSatisfaction(s, c, o, 0.1));
  });
});

describe('edge cases', () => {
  it('plans an empty day when no menus are selected', () => {
    const s = newGame();
    expect(planDay(s, rng(1)).customers).toEqual([]);
  });
});
