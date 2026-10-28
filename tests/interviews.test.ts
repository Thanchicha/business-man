import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/GameState';
import { CROWD, crowdFor, customerSpec } from '../src/game/specs';
import { personaFor, talkWith, willTalk } from '../src/sim/interviews';
import { findings, METHOD, recordRefusal, recordTalk, spendApproach, talksLeft, useMethod } from '../src/sim/research';
import { chunkText } from '../src/ui/chunk';

describe('field interviews', () => {
  it('one interview round gives a few approaches; asking with a tea costs money', () => {
    const s = newGame();
    useMethod(s, METHOD.interview, 'university');
    expect(talksLeft(s, 'university')).toBe(4);
    const cash = s.cash;
    expect(spendApproach(s, 'university', true).ok).toBe(true);
    expect(s.cash).toBeLessThan(cash);
    expect(talksLeft(s, 'university')).toBe(3);
  });

  it('busy people usually refuse, but a bubble tea helps', () => {
    let asked = 0;
    let withTea = 0;
    for (let i = 0; i < 300; i++) {
      const p = { ...personaFor('office_man', i), mood: 'busy' as const };
      if (willTalk(p, 'ask')) asked++;
      if (willTalk(p, 'tea')) withTea++;
    }
    expect(asked).toBeLessThan(75);
    expect(withTea).toBeGreaterThan(asked + 60);
  });

  it('different people in the same area say different things', () => {
    const a = talkWith('university', personaFor('uni_girl', 1), false);
    const b = talkWith('university', personaFor('elder', 2), false);
    expect(a.quote).not.toBe(b.quote);
    expect(a.chips).not.toEqual(b.chips);
  });

  it('the notebook page shows who talked and who said no', () => {
    const s = newGame();
    useMethod(s, METHOD.interview, 'mall');
    recordTalk(s, 'mall', talkWith('mall', personaFor('influencer', 5), true));
    recordRefusal(s, 'mall');
    const f = findings('mall', 'interview', s);
    expect(f.people).toHaveLength(1);
    expect(f.refused).toBe(1);
  });

  it('every area has its own crowd', () => {
    const ids = (loc: string) => new Set(Array.from({ length: 40 }, (_, i) => crowdFor(loc, i).extra!.id));
    expect(ids('university').has('uni_girl')).toBe(true);
    expect(ids('office').has('office_man')).toBe(true);
    expect(ids('village').has('grandma')).toBe(true);
    expect(ids('mall').has('influencer')).toBe(true);
    expect(ids('office').has('grandma')).toBe(false);
    expect(Object.keys(CROWD)).toHaveLength(5);
    expect(customerSpec(3, 'worker', 'office').extra!.id).toMatch(/office|part_timer/);
  });
});

describe('short messages', () => {
  it('long lines are cut at phrase breaks', () => {
    const long = 'เงินต้องเหลือไว้ซื้อวัตถุดิบ จ่ายค่าเช่า ค่าแรง และเผื่อวันที่ขายไม่ดีด้วยนะ ไม่งั้นจะลำบากมากๆ';
    const parts = chunkText(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ')).toBe(long);
    expect(chunkText('สั้นๆ ก็พอ')).toEqual(['สั้นๆ ก็พอ']);
  });
});
