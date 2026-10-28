import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/GameState';
import { orderTotal, perceived, promoDemand, OPENING_DAYS } from '../src/sim/pricing';
import { expectedCustomers, planDay, planDelivery } from '../src/sim/demand';
import { isRentDay, nextRentMorning } from '../src/sim/economy';
import { starsFor } from '../src/sim/service';
import { rng } from '../src/sim/rng';

function shop() {
  const s = newGame();
  s.menus = ['pearl_milk_tea', 'thai_tea'];
  s.prices = { pearl_milk_tea: 45, thai_tea: 39 };
  s.location = 'village';
  return s;
}

describe('prices and promotions', () => {
  it('a price ending in 9 feels cheaper', () => {
    expect(perceived(39)).toBeLessThan(39);
    expect(perceived(40)).toBe(40);
  });

  it('applies the opening sale only in the first days', () => {
    const s = shop();
    s.promos.opening = { on: true, pct: 10 };
    expect(orderTotal(s, 'pearl_milk_tea', 1)).toBe(40); // 45 − 4.5 rounded
    s.day = OPENING_DAYS + 1;
    expect(orderTotal(s, 'pearl_milk_tea', 1)).toBe(45);
  });

  it('takes bundle discounts off 2- and 3-cup orders and coupons off the bill', () => {
    const s = shop();
    s.promos.bundle = { on: true, off2: 10, off3: 20 };
    s.promos.coupon = { on: true, amount: 10 };
    expect(orderTotal(s, 'pearl_milk_tea', 2)).toBe(80);
    expect(orderTotal(s, 'pearl_milk_tea', 3)).toBe(115);
    expect(orderTotal(s, 'pearl_milk_tea', 1, true)).toBe(35);
  });

  it('promotions bring more walk-ins', () => {
    const s = shop();
    const before = expectedCustomers(s);
    s.promos.opening.on = true;
    expect(promoDemand(s)).toBeGreaterThan(1);
    expect(expectedCustomers(s)).toBeGreaterThan(before);
  });

  it('coupon holders come back the next day', () => {
    const s = shop();
    s.promos.coupon.on = true;
    s.coupons = 5;
    expect(planDay(s, rng(3)).customers.filter((c) => c.coupon).length).toBe(3);
  });
});

describe('clearance sale', () => {
  it('discounts only menus that use stock spoiling tonight', () => {
    const s = shop();
    s.promos.clearance = { on: true, pct: 20 };
    s.inventory = [
      { ing: 'milk', servings: 10, expires: s.day },
      { ing: 'tea_thai', servings: 10, expires: null },
    ];
    // pearl milk tea uses milk that spoils tonight; thai tea does not
    expect(orderTotal(s, 'pearl_milk_tea', 1)).toBe(36);
    expect(orderTotal(s, 'thai_tea', 1)).toBe(39);
  });
});

describe('delivery app', () => {
  it('plans no orders while switched off, and fewer when app prices are high', () => {
    const s = shop();
    expect(planDelivery(s, rng(1))).toEqual([]);
    s.delivery = { on: true, prices: { pearl_milk_tea: 55, thai_tea: 49 } };
    const fair = planDelivery(s, rng(1)).length;
    s.delivery.prices = { pearl_milk_tea: 95, thai_tea: 95 };
    expect(planDelivery(s, rng(1)).length).toBeLessThan(fair);
  });
});

describe('rent and reviews', () => {
  it('the landlord comes every 3 days when rent is owed', () => {
    const s = shop();
    s.rentDue = 800;
    s.day = 4;
    expect(isRentDay(s)).toBe(true);
    s.landlordDay = 4;
    expect(isRentDay(s)).toBe(false);
    s.day = 5;
    expect(isRentDay(s)).toBe(false);
    expect(nextRentMorning(4)).toBe(7);
  });

  it('turns satisfaction into 1-5 stars', () => {
    expect(starsFor(0)).toBe(1);
    expect(starsFor(0.68)).toBe(4);
    expect(starsFor(1)).toBe(5);
  });
});
