export type StrategyId = 'price' | 'creative' | 'speed' | 'cozy';

export interface Strategy {
  id: StrategyId;
  name: string;
  desc: string;
  pros: string;
  cons: string;
  setupCost: number;
  icon: string;
}

export const STRATEGIES: Strategy[] = [
  { id: 'price', name: 'สู้ด้วยราคา', desc: 'ตั้งราคาถูกกว่าคู่แข่ง ดึงลูกค้าที่มองหาความคุ้ม', pros: 'ลูกค้าที่ไวต่อราคาสนใจมากขึ้น', cons: 'กำไรต่อแก้วน้อยลง', setupCost: 0, icon: '฿' },
  { id: 'creative', name: 'เมนูสร้างสรรค์', desc: 'ปลดล็อกเมนูซิกเนเจอร์ที่ไม่มีใครเหมือน', pros: 'ลูกค้าอยากลอง ยอมจ่ายแพงขึ้น', cons: 'ต้นทุนวัตถุดิบสูง ชงนานขึ้น', setupCost: 3000, icon: '✦' },
  { id: 'speed', name: 'บริการรวดเร็ว', desc: 'จัดระบบหน้าร้านให้ชงไวขึ้น ลูกค้าไม่ต้องรอ', pros: 'ชงเร็วขึ้น 25% เหมาะกับคนรีบ', cons: 'ต้องซื้อเครื่องซีลกับหม้อต้มเพิ่ม', setupCost: 8000, icon: '⚡' },
  { id: 'cozy', name: 'บรรยากาศร้าน', desc: 'แต่งร้านน่ารัก มุมถ่ายรูป ลูกค้าอยากกลับมา', pros: 'ลูกค้าพอใจมากขึ้น ชื่อเสียงโตเร็ว', cons: 'ลงทุนตกแต่งก่อน', setupCost: 15000, icon: '♥' },
];

export const STRATEGY = Object.fromEntries(STRATEGIES.map((s) => [s.id, s])) as Record<StrategyId, Strategy>;
