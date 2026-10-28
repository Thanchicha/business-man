import type * as THREE from 'three';

export const EXPRESSIONS = ['normal', 'smile', 'wink', 'surprised', 'angry', 'crying', 'sleepy', 'blush'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const EXPRESSION_LABELS: Record<Expression, { en: string; th: string }> = {
  normal: { en: 'Normal', th: 'ปกติ' },
  smile: { en: 'Smile', th: 'ยิ้ม' },
  wink: { en: 'Wink', th: 'วิงค์' },
  surprised: { en: 'Surprised', th: 'ตกใจ' },
  angry: { en: 'Pout', th: 'งอน' },
  crying: { en: 'Crying', th: 'ร้องไห้' },
  sleepy: { en: 'Sleepy', th: 'ง่วง' },
  blush: { en: 'Blush', th: 'เขิน' },
};

/** A built body part. `update` is called every frame (optional idle motion). */
export interface Part {
  object: THREE.Object3D;
  update?(time: number, delta: number): void;
}
