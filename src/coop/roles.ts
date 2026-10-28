export type RoleId = 'cashier' | 'barista' | 'scout';

export interface Role {
  id: RoleId;
  name: string;
  icon: string;
  /** What the job covers, morning and during opening hours. */
  morning: string;
  day: string;
  /** Who covers the job when no player takes it. */
  fallback: string;
}

/**
 * Three jobs of about the same weight: one handles money and the counter, one
 * makes the drinks, one listens to customers and studies rivals. Each has a
 * morning task and something to do while the shop is open.
 */
export const ROLES: Role[] = [
  {
    id: 'cashier',
    name: 'แคชเชียร์ & การเงิน',
    icon: '💰',
    morning: 'ดูสต็อก ซื้อวัตถุดิบ จ่ายค่าเช่า กู้/คืนเงินธนาคาร ตั้งราคา',
    day: 'คุยกับลูกค้าที่เคาน์เตอร์ รับเงิน รับออเดอร์เดลิเวอรี่ สั่งของด่วนถ้าใกล้หมด',
    fallback: 'ไม่มีคนทำ: ระบบตอบลูกค้าแบบพื้นฐานให้ (จ้าง มายด์ ช่วยให้ลูกค้าพอใจขึ้น)',
  },
  {
    id: 'barista',
    name: 'คนชงน้ำ',
    icon: '🧋',
    morning: 'ปรับสูตรเมนู (ความหวาน ความเข้ม) จากข้อมูลที่นักสำรวจส่งมา',
    day: 'รับบิล เลือกเมนู น้ำแข็ง ความหวาน ท็อปปิ้ง แล้วส่งให้ลูกค้าให้ถูกคน',
    fallback: 'ไม่มีคนทำ: ชงอัตโนมัติตามความเร็วร้าน (จ้าง นิว ชงเร็วขึ้น)',
  },
  {
    id: 'scout',
    name: 'นักสำรวจ',
    icon: '🔎',
    morning: 'ไปสำรวจร้านคู่แข่ง แอบชิม ดูราคา แล้วส่งข้อเสนอปรับสูตรให้คนชง',
    day: 'สัมภาษณ์ลูกค้าในร้าน เก็บรีวิว รสชาติ ความหวาน ไอเดียเมนูใหม่',
    fallback: 'ไม่มีคนทำ: ไม่มีข้อมูลสัมภาษณ์ ดูได้แค่เสียงลูกค้าตอนสรุปวัน',
  },
];

export const ROLE = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<RoleId, Role>;

/** The job a new player gets: the first one nobody has, otherwise a second barista. */
export function autoRole(taken: RoleId[]): RoleId {
  return ROLES.find((r) => !taken.includes(r.id))?.id ?? 'barista';
}

/** Everyone moves on to the next job, so each day can be tried from another side. */
export function rotateRoles<T extends { role: RoleId }>(players: T[]): void {
  // a shift along the same cycle keeps different jobs different, and with two
  // players the free job comes round too
  const order = ROLES.map((r) => r.id);
  for (const p of players) p.role = order[(order.indexOf(p.role) + 1) % order.length];
}
