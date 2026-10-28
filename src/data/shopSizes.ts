export type ShopSize = 'kiosk' | 'catcafe';

export interface ShopSizeInfo {
  id: ShopSize;
  name: string;
  desc: string;
  setup: number;
  rentMult: number;
  demandMult: number;
  satisfaction: number;
  /** Daily cost of looking after the cats (food, litter). */
  upkeep: number;
  /** Daily electricity and water (fridge, sealer, lights, air-con). */
  utilities: number;
  pros: string;
  cons: string;
}

export const SHOP_SIZES: Record<ShopSize, ShopSizeInfo> = {
  kiosk: {
    id: 'kiosk',
    name: 'ลงทุนน้อยๆ: คีออสก์',
    desc: 'ซุ้มเล็ก 6–9 ตร.ม. ขายกลับบ้านอย่างเดียว (เคาน์เตอร์ เครื่องซีล ตู้เย็นมือสอง)',
    setup: 30000,
    rentMult: 0.55,
    demandMult: 0.85,
    satisfaction: -0.03,
    upkeep: 0,
    utilities: 100,
    pros: 'ใช้เงินน้อย ค่าเช่าถูก เจ๊งก็เจ็บไม่มาก',
    cons: 'ไม่มีที่นั่ง ลูกค้าน้อยกว่า',
  },
  catcafe: {
    id: 'catcafe',
    name: 'ลงทุนเต็มที่: ร้านชานม + คาเฟ่แมว',
    desc: 'ร้านเล็กมีที่นั่ง แต่งร้านแบบประหยัด + อุปกรณ์ครบ + น้องแมว 3 ตัว (ยังไม่รวมโต๊ะเก้าอี้)',
    setup: 110000,
    rentMult: 1,
    demandMult: 1.15,
    satisfaction: 0.06,
    upkeep: 150,
    utilities: 300,
    pros: 'ลูกค้าอยากมา อยู่นาน กลับมาซ้ำ',
    cons: 'ลงทุนสูง มีค่าดูแลแมวทุกวัน',
  },
};
