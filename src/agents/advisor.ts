import type { DayLog, GameState } from '../sim/GameState';
import { MENU, cupCost } from '../data/menus';
import { baht } from '../game/format';

/** Fixed costs per day and the average margin per cup, to talk about break-even. */
export function breakEven(state: GameState, log: DayLog): { fixed: number; margin: number; cups: number } {
  const fixed = log.rent + log.wages + log.upkeep + (log.utilities ?? 0);
  const margin = state.menus.length ? state.menus.reduce((s, id) => s + (state.prices[id] - cupCost(id)), 0) / state.menus.length : 0;
  return { fixed, margin, cups: margin > 0 ? Math.ceil(fixed / margin) : Infinity };
}

/**
 * MIYU's evening debrief. She points at what the numbers say and asks a question,
 * but never tells the player exactly what to do.
 */
export function eveningAdvice(state: GameState, log: DayLog): string[] {
  const out: string[] = [];
  const be = breakEven(state, log);
  const daily = log.profit + log.setup; // result of selling only, without one-off setup costs
  if (log.setup > 0) {
    out.push(
      daily >= 0
        ? `ตัวเลขติดลบเพราะรวมค่าลงทุนครั้งแรก ${baht(log.setup)} ไว้ด้วย ถ้าดูเฉพาะการขาย วันนี้ "กำไร" ${baht(daily)} นะ ค่อยๆ คืนทุนไป`
        : `ตัวเลขรวมค่าลงทุนครั้งแรก ${baht(log.setup)} ไว้ด้วย ถ้าไม่นับส่วนนั้น วันนี้ขาดทุน ${baht(-daily)} มาดูกันว่าจะปรับตรงไหนได้บ้าง`,
    );
  } else if (daily >= 0) out.push(`วันนี้กำไร ${baht(daily)} เก่งมาก ลองดูว่ากำไรมาจากอะไรบ้าง`);
  else out.push(`วันนี้ขาดทุน ${baht(-daily)} ไม่เป็นไร ร้านเปิดใหม่ส่วนใหญ่ขาดทุนช่วงแรก มาดูกันว่าเพราะอะไร`);

  if (be.cups !== Infinity) out.push(`ค่าใช้จ่ายคงที่วันละ ${baht(be.fixed)} กำไรเฉลี่ยแก้วละ ~${baht(be.margin)} ต้องขาย ~${be.cups} แก้วถึงจะคุ้มทุน วันนี้ขายได้ ${log.cupsSold} แก้ว`);

  const f = log.feedback;
  const issues: [number, string][] = [
    [f.leftAngry + f.closed + f.slow, 'มีลูกค้ารอนานหรือเดินออกไปหลายคน ปัญหาอยู่ที่ความเร็วหรือเปล่า? จะจ้างคนช่วย หรือลดเมนูที่ชงนาน?'],
    [f.expensive * 1.5, 'หลายคนบอกว่าแพง ราคาเราสูงกว่าที่ลูกค้าแถวนี้รับได้ไหม? หรือจะสู้ด้วยอย่างอื่นแทนราคา?'],
    [f.outOfStock * 2, 'ของหมดระหว่างวัน เสียโอกาสขายไป พรุ่งนี้จะซื้ออะไรเพิ่มดี?'],
    [Object.values(log.requests).reduce((a, b) => a + b, 0), `ลูกค้าขอเมนูใหม่: ${Object.keys(log.requests).join(', ')} อาจเป็นโอกาสใหม่นะ~`],
    [log.waste > 80 ? 3 : 0, `ทิ้งของเสียไป ${baht(log.waste)} ซื้อของสดเยอะไปหรือเปล่า?`],
  ];
  issues.sort((a, b) => b[0] - a[0]);
  for (const [score, text] of issues.slice(0, 2)) if (score > 0) out.push(text);

  const best = Object.entries(log.sales).sort((a, b) => b[1] - a[1])[0];
  if (best) out.push(`เมนูขายดีวันนี้คือ ${MENU[best[0]].short} (${best[1]} แก้ว) ซื้อวัตถุดิบเผื่อเมนูนี้ไว้ดีไหม?`);
  return out;
}
