import type { Segment } from '../data/menus';
import type { GameState } from './GameState';
import { LOCATION } from '../data/locations';

export interface DayEvent {
  id: string;
  title: string;
  desc: string;
  demandMult: number;
  segmentBoost?: Partial<Record<Segment, number>>;
  patienceMult?: number;
}

export interface DayConfig {
  day: number;
  customerMult: number;
  /** Base seconds a customer is willing to wait in total. */
  patience: number;
  event: DayEvent | null;
}

const EVENTS: Record<number, DayEvent> = {
  3: { id: 'rain', title: 'ฝนตกทั้งวัน', desc: 'คนออกจากบ้านน้อยลง...', demandMult: 0.75 },
  5: { id: 'exam', title: 'สัปดาห์สอบ', desc: 'นักเรียนนักศึกษาต้องการคาเฟอีน แต่รีบมาก!', demandMult: 1.1, segmentBoost: { student: 1.6 }, patienceMult: 0.85 },
  6: { id: 'influencer', title: 'มีรีวิวในโซเชียล', desc: 'มีคนรีวิวร้านแถวนี้ คนอยากลองเยอะขึ้น', demandMult: 1.25 },
  7: { id: 'weekend', title: 'วันหยุดยาว', desc: 'คนเยอะที่สุดของสัปดาห์!', demandMult: 1.35, segmentBoost: { family: 1.5 } },
};

/** The game gets busier and customers less patient every day. */
export function dayConfig(state: GameState, day = state.day): DayConfig {
  let event = EVENTS[day] ?? null;
  if (day === 4) {
    const rivals = state.location ? LOCATION[state.location].competitors.length : 0;
    event = rivals
      ? { id: 'promo', title: 'คู่แข่งจัดโปร 1 แถม 1', desc: 'ลูกค้าบางส่วนหันไปร้านคู่แข่ง', demandMult: state.strategy === 'price' ? 0.92 : 0.8 }
      : { id: 'word', title: 'ลูกค้าบอกต่อ', desc: 'คนในหมู่บ้านเริ่มรู้จักร้านเรา', demandMult: 1.15 };
  }
  return {
    day,
    customerMult: 1 + 0.1 * (day - 1),
    patience: Math.max(24, 42 - 3 * (day - 1)) * (event?.patienceMult ?? 1),
    event,
  };
}
