import type { Segment } from './menus';

export interface Competitor {
  name: string;
  avgPrice: number;
  rating: number;
  famous: string;
  strength: string;
  weakness: string;
  color: string;
}

export interface Location {
  id: string;
  name: string;
  area: string;
  monthlyRent: number;
  /** Foot traffic multiplier. */
  traffic: number;
  mix: Record<Segment, number>;
  competitors: Competitor[];
  /** Pin position on the 320x180 town map. */
  map: { x: number; y: number };
  hint: string;
}

export const LOCATIONS: Location[] = [
  {
    id: 'university',
    name: 'ทำเล 1',
    area: 'หน้ามหาวิทยาลัย',
    monthlyRent: 12000,
    traffic: 1.15,
    mix: { student: 0.75, worker: 0.1, family: 0.15 },
    competitors: [{ name: 'ชาบ้านป้าแดง', avgPrice: 35, rating: 3.6, famous: 'ชาไทยแก้วใหญ่', strength: 'ราคาถูกมาก', weakness: 'รอนาน เมนูน้อย', color: '#e85a71' }],
    map: { x: 60, y: 46 },
    hint: 'นักศึกษาเยอะ แต่กระเป๋าเบา...',
  },
  {
    id: 'village',
    name: 'ทำเล 2',
    area: 'หน้าหมู่บ้าน',
    monthlyRent: 8000,
    traffic: 0.8,
    mix: { student: 0.25, worker: 0.25, family: 0.5 },
    competitors: [],
    map: { x: 46, y: 77 },
    hint: 'ไม่มีคู่แข่ง แต่คนเดินผ่านน้อย',
  },
  {
    id: 'bts',
    name: 'ทำเล 3',
    area: 'ใกล้สถานี BTS',
    monthlyRent: 18000,
    traffic: 1.4,
    mix: { student: 0.3, worker: 0.6, family: 0.1 },
    competitors: [
      { name: 'ChaTime Express', avgPrice: 55, rating: 4.1, famous: 'ชานมไข่มุก', strength: 'แบรนด์ดัง ชงเร็ว', weakness: 'ราคาแพง ไม่ค่อยมีเมนูใหม่', color: '#7fb2f0' },
      { name: 'ร้านน้ำลุงชัย', avgPrice: 30, rating: 3.2, famous: 'ชาดำเย็น', strength: 'ถูกที่สุด', weakness: 'แก้วเล็ก รสชาติไม่คงที่', color: '#ffc94d' },
    ],
    map: { x: 250, y: 76 },
    hint: 'คนพลุกพล่าน คนทำงานรีบ ไม่ชอบรอ',
  },
  {
    id: 'office',
    name: 'ทำเล 4',
    area: 'ย่านออฟฟิศ',
    monthlyRent: 16000,
    traffic: 1.2,
    mix: { student: 0.1, worker: 0.75, family: 0.15 },
    competitors: [{ name: 'Matcha Lab', avgPrice: 65, rating: 4.4, famous: 'มัทฉะลาเต้', strength: 'คุณภาพสูง ร้านสวย', weakness: 'แพง เมนูนมสดน้อย', color: '#5cc9a7' }],
    map: { x: 196, y: 26 },
    hint: 'คนทำงานจ่ายได้ แต่คู่แข่งเก่ง',
  },
  {
    id: 'mall',
    name: 'ทำเล 5',
    area: 'ข้างห้างสรรพสินค้า',
    monthlyRent: 25000,
    traffic: 1.7,
    mix: { student: 0.4, worker: 0.3, family: 0.3 },
    competitors: [
      { name: 'BubbleMe', avgPrice: 50, rating: 4.0, famous: 'บราวน์ชูการ์', strength: 'โปรโมชันบ่อย', weakness: 'คิวยาวช่วงเย็น', color: '#a993f5' },
      { name: 'TeaTime', avgPrice: 45, rating: 3.8, famous: 'ชาพีช', strength: 'ที่นั่งเยอะ', weakness: 'บริการเฉยๆ', color: '#ff9f7a' },
      { name: 'Mr. Boba', avgPrice: 40, rating: 3.5, famous: 'ชานมไข่มุก', strength: 'ราคากลางๆ', weakness: 'ไข่มุกแข็ง', color: '#3faa6b' },
    ],
    map: { x: 274, y: 128 },
    hint: 'คนเยอะที่สุด ค่าเช่าก็สูงที่สุด',
  },
];

export const LOCATION = Object.fromEntries(LOCATIONS.map((l) => [l.id, l])) as Record<string, Location>;

export const dailyRent = (l: Location): number => Math.round(l.monthlyRent / 30);

/** Landlords in Thailand usually ask for two months' rent as a refundable deposit. */
export const DEPOSIT_MONTHS = 2;

/** Average price customers in the area are used to paying. */
export const marketPrice = (l: Location): number =>
  l.competitors.length ? l.competitors.reduce((s, c) => s + c.avgPrice, 0) / l.competitors.length : 45;
