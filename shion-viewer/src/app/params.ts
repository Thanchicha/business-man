import { GESTURES, type Gesture } from '../character/anim/Animator';
import { EXPRESSIONS, type Expression } from '../character/types';

export const VIEWS = ['front', 'side', 'back', 'threequarter', 'face', 'free'] as const;
export type ViewName = (typeof VIEWS)[number];

export interface AppParams {
  view: ViewName;
  expr: Expression;
  ui: boolean;
  /** Screenshot mode: deterministic frame, no idle motion, no autorotate. */
  shot: boolean;
  /** Start walking (in place in screenshot mode). */
  walk: boolean;
  /** Start talking. */
  talk: boolean;
  /** Gesture to play on load (held at full strength in screenshot mode). */
  gesture: Gesture | null;
  /** Animation time used in screenshot mode (seconds). */
  time: number;
}

export function readParams(search = window.location.search): AppParams {
  const q = new URLSearchParams(search);
  const view = q.get('view') as ViewName | null;
  const expr = q.get('expr') as Expression | null;
  return {
    view: view && VIEWS.includes(view) ? view : 'threequarter',
    expr: expr && EXPRESSIONS.includes(expr) ? expr : 'normal',
    ui: q.get('ui') !== '0',
    shot: q.get('shot') === '1',
    walk: q.get('walk') === '1',
    talk: q.get('talk') === '1',
    gesture: GESTURES.find((g) => g === q.get('gesture')) ?? null,
    time: Number(q.get('time')) || 0,
  };
}
