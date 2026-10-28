import type { CharSpec } from '../game/specs';
import { extraSpec } from '../game/specs';
import { LOOKS } from '../three/chars/extra/character/looks';

export interface Staff {
  id: string;
  name: string;
  role: string;
  monthly: number;
  perk: string;
  /** Added to drink making speed (0.6 = 60% faster). */
  speed: number;
  /** Extra seconds of patience for every customer. */
  patience: number;
  /** Bonus to satisfaction (0-1 scale). */
  service: number;
  spec: CharSpec;
}

export const STAFF: Staff[] = [
  {
    id: 'barista',
    name: 'นิว',
    role: 'บาริสต้า',
    monthly: 15000,
    perk: 'ชงเร็วขึ้น 60% ลูกค้ารอน้อยลง',
    speed: 0.6,
    patience: 0,
    service: 0,
    spec: extraSpec(LOOKS.barista),
  },
  {
    id: 'server',
    name: 'มายด์',
    role: 'พนักงานบริการ',
    monthly: 12000,
    perk: 'ลูกค้าใจเย็นขึ้น และพอใจมากขึ้น',
    speed: 0.15,
    patience: 8,
    service: 0.08,
    spec: extraSpec(LOOKS.server),
  },
  {
    id: 'helper',
    name: 'ต้น',
    role: 'ผู้ช่วยพาร์ทไทม์ (ครึ่งวัน)',
    monthly: 6000,
    perk: 'ร้านสะอาด ช่วยหยิบของ ชื่อเสียงดีขึ้นเล็กน้อย',
    speed: 0.2,
    patience: 3,
    service: 0.04,
    spec: extraSpec(LOOKS.part_timer),
  },
];

export const STAFF_BY_ID = Object.fromEntries(STAFF.map((s) => [s.id, s])) as Record<string, Staff>;
export const dailyWage = (s: Staff): number => Math.round(s.monthly / 30);
