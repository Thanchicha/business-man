export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  price: number;
  /** How many cups one unit is enough for. */
  servings: number;
  /** Days it keeps after buying; undefined = does not spoil during the demo. */
  shelfLife?: number;
  /** Supermarket aisle the item sits in. */
  aisle: 'tea' | 'dairy' | 'syrup' | 'topping' | 'supply';
  note?: string;
}

/**
 * Wholesale prices close to what a small Thai shop pays (Makro / online wholesale, 2025-26),
 * and servings per pack from typical recipes for a 22 oz cup. Raw cost per cup lands
 * around 10-15 baht, as Thai small-business guides report.
 */
export const INGREDIENTS: Ingredient[] = [
  { id: 'tea_black', name: 'ใบชาดำ', unit: 'ถุง 500 ก.', price: 130, servings: 50, aisle: 'tea', note: 'ใช้ ~10 ก./แก้ว' },
  { id: 'tea_green', name: 'ผงชาเขียว', unit: 'ถุง 500 ก.', price: 220, servings: 40, aisle: 'tea', note: 'ใช้ ~12 ก./แก้ว' },
  { id: 'tea_thai', name: 'ชาไทย', unit: 'ถุง 400 ก.', price: 120, servings: 40, aisle: 'tea', note: 'ใช้ ~10 ก./แก้ว' },
  { id: 'cocoa', name: 'ผงโกโก้', unit: 'ถุง 500 ก.', price: 150, servings: 30, aisle: 'tea' },
  { id: 'taro', name: 'ผงเผือก', unit: 'ถุง 500 ก.', price: 130, servings: 25, aisle: 'tea' },
  { id: 'milk', name: 'นมสด', unit: 'ขวด 2 ลิตร', price: 95, servings: 25, shelfLife: 2, aisle: 'dairy', note: 'ใช้ ~80 มล./แก้ว เก็บได้ 2 วัน' },
  { id: 'creamer', name: 'นมข้นจืด', unit: 'กระป๋อง 405 ก.', price: 27, servings: 12, aisle: 'dairy' },
  { id: 'ice', name: 'น้ำแข็งหลอด', unit: 'กระสอบ 20 กก.', price: 45, servings: 100, shelfLife: 1, aisle: 'dairy', note: '~200 ก./แก้ว ละลายภายในวัน' },
  { id: 'syrup', name: 'น้ำเชื่อม', unit: 'ขวด 1 ลิตร', price: 45, servings: 50, aisle: 'syrup' },
  { id: 'brown_sugar', name: 'ไซรัปบราวน์ชูการ์', unit: 'ขวด 1 กก.', price: 120, servings: 30, aisle: 'syrup' },
  { id: 'peach', name: 'ไซรัปพีช', unit: 'ขวด 750 มล.', price: 160, servings: 25, aisle: 'syrup' },
  { id: 'pearls', name: 'ไข่มุก', unit: 'ถุง 1 กก.', price: 70, servings: 20, shelfLife: 3, aisle: 'topping', note: '~50 ก./แก้ว ต้มแล้วเก็บได้ 3 วัน' },
  { id: 'cups', name: 'แก้ว+ฟิล์มซีล+หลอด', unit: 'แพ็ค 50 ชุด', price: 110, servings: 50, aisle: 'supply', note: 'แก้ว 22 ออนซ์' },
];

export const ING = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i])) as Record<string, Ingredient>;

export const costPerServing = (id: string): number => ING[id].price / ING[id].servings;
