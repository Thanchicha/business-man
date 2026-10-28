export type FurnId = 'table_wood' | 'table_long' | 'chair_wood' | 'stool' | 'sofa';
export type Furniture = Record<FurnId, number>;

export interface FurnItem {
  id: FurnId;
  name: string;
  short: string;
  desc: string;
  price: number;
  /** Floor space it takes, walkway included, in square metres. */
  area: number;
  /** Seats it adds on its own (sofas). */
  ownSeats: number;
  /** Seats it offers to chairs and stools (tables). */
  tableSeats: number;
  /** Chairs and stools must be paired with a table; sofas stand alone. */
  needsTable: boolean;
  icon: string;
  pros: string;
  cons: string;
}

export const FURNITURE: FurnItem[] = [
  {
    id: 'table_wood',
    name: 'โต๊ะไม้ธรรมดา',
    short: 'โต๊ะไม้',
    desc: 'โต๊ะไม้สี่เหลี่ยมเรียบๆ นั่งได้ 2 คน',
    price: 1200,
    area: 0.9,
    ownSeats: 0,
    tableSeats: 2,
    needsTable: false,
    icon: '🪵',
    pros: 'ราคาประหยัด ทนทาน ดูแลง่าย',
    cons: 'ไม่มีอะไรโดดเด่น',
  },
  {
    id: 'table_long',
    name: 'โต๊ะยาวสำหรับกลุ่ม',
    short: 'โต๊ะยาว',
    desc: 'โต๊ะไม้ตัวใหญ่ นั่งได้ 4 คน เหมาะกับกลุ่มเพื่อน',
    price: 2400,
    area: 1.8,
    ownSeats: 0,
    tableSeats: 4,
    needsTable: false,
    icon: '🍽️',
    pros: 'จุคนเยอะต่อโต๊ะ',
    cons: 'แพงกว่า กินที่เป็นสองเท่า',
  },
  {
    id: 'chair_wood',
    name: 'เก้าอี้ไม้มีพนัก',
    short: 'เก้าอี้',
    desc: 'เก้าอี้ไม้มีเบาะ นั่งสบายพอใช้',
    price: 380,
    area: 0.4,
    ownSeats: 1,
    tableSeats: 0,
    needsTable: true,
    icon: '🪑',
    pros: 'ราคาไม่แพง นั่งได้นาน',
    cons: 'ต้องมีโต๊ะให้ก่อน',
  },
  {
    id: 'stool',
    name: 'สตูลกลม',
    short: 'สตูล',
    desc: 'สตูลเตี้ยๆ ไม่มีพนัก ประหยัดที่สุด',
    price: 190,
    area: 0.25,
    ownSeats: 1,
    tableSeats: 0,
    needsTable: true,
    icon: '🟣',
    pros: 'ถูกมาก ใช้พื้นที่น้อยสุด',
    cons: 'นั่งไม่สบาย ลูกค้านั่งไม่นาน',
  },
  {
    id: 'sofa',
    name: 'โซฟานั่งสบาย',
    short: 'โซฟา',
    desc: 'โซฟานุ่ม 2 ที่นั่ง วางริมหน้าต่าง ลูกค้าติดใจ',
    price: 3200,
    area: 1.6,
    ownSeats: 2,
    tableSeats: 0,
    needsTable: false,
    icon: '🛋️',
    pros: 'ลูกค้าพอใจขึ้น อยากนั่งนาน',
    cons: 'แพงและกินที่ ไม่ต้องมีโต๊ะ',
  },
];

export const FURN: Record<FurnId, FurnItem> = Object.fromEntries(FURNITURE.map((f) => [f.id, f])) as Record<FurnId, FurnItem>;

/** Floor space in the seating zone of the café, square metres. */
export const SEATING_AREA = 11;
/** Tables and sofas sit on fixed spots in the zone, so there is also a count limit. */
export const TABLE_SPOTS = 6;
export const SOFA_SPOTS = 4;

export const emptyFurniture = (): Furniture => ({ table_wood: 0, table_long: 0, chair_wood: 0, stool: 0, sofa: 0 });

export const totalPieces = (f: Furniture): number => FURNITURE.reduce((s, i) => s + f[i.id], 0);
export const totalCost = (f: Furniture): number => FURNITURE.reduce((s, i) => s + i.price * f[i.id], 0);
export const areaUsed = (f: Furniture): number => Math.round(FURNITURE.reduce((s, i) => s + i.area * f[i.id], 0) * 100) / 100;
export const tableCount = (f: Furniture): number => f.table_wood + f.table_long;
/** Seats at tables that chairs and stools can fill. */
export const tableSeats = (f: Furniture): number => f.table_wood * FURN.table_wood.tableSeats + f.table_long * FURN.table_long.tableSeats;
/** Seats customers can really use: seated at a table, or on a sofa. */
export function seatCount(f: Furniture): number {
  return Math.min(f.chair_wood + f.stool, tableSeats(f)) + f.sofa * FURN.sofa.ownSeats;
}

export type AddCheck = { ok: true } | { ok: false; reason: string };

/** Whether one more piece fits the shop. This is what keeps the player inside the floor plan. */
export function canAdd(f: Furniture, id: FurnId): AddCheck {
  const item = FURN[id];
  const next = { ...f, [id]: f[id] + 1 };
  if (areaUsed(next) > SEATING_AREA + 1e-6) return { ok: false, reason: `พื้นที่ร้านไม่พอ (ใช้ได้สูงสุด ${SEATING_AREA} ตร.ม.)` };
  if ((id === 'table_wood' || id === 'table_long') && tableCount(next) > TABLE_SPOTS) return { ok: false, reason: `วางโต๊ะได้ไม่เกิน ${TABLE_SPOTS} ตัว` };
  if (id === 'sofa' && next.sofa > SOFA_SPOTS) return { ok: false, reason: `ริมหน้าต่างวางโซฟาได้ไม่เกิน ${SOFA_SPOTS} ตัว` };
  if (item.needsTable && next.chair_wood + next.stool > tableSeats(next)) return { ok: false, reason: 'ที่นั่งเต็มทุกโต๊ะแล้ว ต้องซื้อโต๊ะเพิ่มก่อน' };
  return { ok: true };
}

/** Whether a piece can be taken out without leaving chairs without a table. */
export function canRemove(f: Furniture, id: FurnId): AddCheck {
  if (f[id] <= 0) return { ok: false, reason: '' };
  const next = { ...f, [id]: f[id] - 1 };
  if (next.chair_wood + next.stool > tableSeats(next)) return { ok: false, reason: 'เอาโต๊ะออกไม่ได้ ยังมีเก้าอี้ที่ต้องใช้โต๊ะตัวนี้' };
  return { ok: true };
}

// ---- effect on the simulation

/** Demand multiplier from how many people can sit down; sofas make no extra difference. */
export function seatDemandFactor(f: Furniture): number {
  return 0.88 + 0.03 * Math.min(8, seatCount(f));
}

/** Satisfaction bonus from comfort: each sofa helps a little, up to three. */
export function comfortBonus(f: Furniture): number {
  return 0.02 * Math.min(3, f.sofa) - 0.01 * Math.min(2, Math.floor(f.stool / 3));
}

// ---- layout in the 3D café

export interface Placement {
  id: FurnId;
  x: number;
  z: number;
  rot: number;
}

/** Table spots in the middle of the café, filled in this order. */
const TABLE_SLOTS: [number, number][] = [[-5.2, -3.0], [-5.2, -0.9], [-2.8, -3.0], [-2.8, -0.9], [-0.4, -3.0], [-0.4, -0.9]];
/** Sofa spots along the window wall, facing the room. */
const SOFA_SLOTS: [number, number][] = [[-3.7, -5.3], [-1.9, -5.3], [-5.5, -5.3], [-0.1, -5.3]];

const SEAT_SPOTS: Record<'table_wood' | 'table_long', [number, number, number][]> = {
  table_wood: [[-0.85, 0, Math.PI / 2], [0.85, 0, -Math.PI / 2]],
  table_long: [[-0.45, -0.75, 0], [0.45, -0.75, 0], [-0.45, 0.75, Math.PI], [0.45, 0.75, Math.PI]],
};

/** Where every piece goes. Tables fill the spots in order and chairs and stools fill the seats around them. */
export function layout(f: Furniture): Placement[] {
  const out: Placement[] = [];
  const tables: FurnId[] = [...Array(f.table_long).fill('table_long'), ...Array(f.table_wood).fill('table_wood')];
  let chairs = f.chair_wood;
  let stools = f.stool;
  tables.slice(0, TABLE_SLOTS.length).forEach((id, i) => {
    const [tx, tz] = TABLE_SLOTS[i];
    out.push({ id, x: tx, z: tz, rot: 0 });
    for (const [dx, dz, rot] of SEAT_SPOTS[id as 'table_wood' | 'table_long']) {
      const seat: FurnId | null = chairs > 0 ? 'chair_wood' : stools > 0 ? 'stool' : null;
      if (!seat) break;
      if (seat === 'chair_wood') chairs--;
      else stools--;
      out.push({ id: seat, x: tx + dx, z: tz + dz, rot });
    }
  });
  for (let i = 0; i < Math.min(f.sofa, SOFA_SLOTS.length); i++) out.push({ id: 'sofa', x: SOFA_SLOTS[i][0], z: SOFA_SLOTS[i][1], rot: 0 });
  return out;
}

/** The seating zone's corners, for drawing the floor plan: [minX, minZ, maxX, maxZ]. */
export const ZONE: [number, number, number, number] = [-6.6, -5.9, 1.2, 0.2];
