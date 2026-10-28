import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/GameState';
import { canUse, findings, METHOD, move, PREP_HOURS, rest, tiredOnOpening, useMethod } from '../src/sim/research';

describe('market research', () => {
  it('each method costs time, energy and sometimes money, once per location', () => {
    const s = newGame();
    const cash = s.cash;
    useMethod(s, METHOD.survey, 'mall');
    expect(s.research.hours).toBe(PREP_HOURS - METHOD.survey.hours);
    expect(s.research.energy).toBe(100 - METHOD.survey.energy);
    expect(s.cash).toBe(cash - METHOD.survey.cost);
    expect(canUse(s, METHOD.survey, 'mall').ok).toBe(false);
    expect(canUse(s, METHOD.survey, 'bts').ok).toBe(true);
  });

  it('runs out of energy and recovers by resting', () => {
    const s = newGame();
    s.research.energy = 10;
    expect(canUse(s, METHOD.interview, 'mall').ok).toBe(false);
    expect(tiredOnOpening(s)).toBe(true);
    rest(s);
    expect(canUse(s, METHOD.interview, 'mall').ok).toBe(true);
  });

  it('looking at another location costs extra time', () => {
    const s = newGame();
    move(s);
    expect(s.research.hours).toBeLessThan(PREP_HOURS);
  });

  it('competitor methods need competitors', () => {
    const s = newGame();
    expect(canUse(s, METHOD.online, 'village').ok).toBe(false);
  });

  it('a survey is closer to the truth than walking around', () => {
    const truth = 0.75; // students near the university
    const walk = findings('university', 'walk').bars!.find(([l]) => l.includes('นักศึกษา'))![1];
    const survey = findings('university', 'survey').bars!.find(([l]) => l.includes('นักศึกษา'))![1];
    expect(Math.abs(survey - truth)).toBeLessThanOrEqual(0.03 + 1e-9);
    expect(Math.abs(walk - truth)).toBeLessThan(0.3);
  });
});
