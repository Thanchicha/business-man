import type { CustomerBrain, CustomerContext, Reply } from './CustomerBrain';
import type { Outcome } from '../sim/service';
import * as T from './dialogue/th';

const pick = (a: string[], seed: number): string => a[Math.abs(seed) % a.length];

function fill(s: string, ctx: CustomerContext, extra: Record<string, string> = {}): string {
  return s
    .replace(/\{menu\}/g, ctx.menuName)
    .replace(/\{n\}/g, String(ctx.plan.cups))
    .replace(/\{price\}/g, String(ctx.price))
    .replace(/\{req\}/g, ctx.plan.request ?? '')
    .replace(/\{alt\}/g, extra.alt ?? ctx.altName ?? '');
}

/** Customers that speak from hand-written lines, chosen by personality and situation. */
export class ScriptedCustomerBrain implements CustomerBrain {
  async opening(ctx: CustomerContext): Promise<Reply> {
    const s = ctx.plan.seed;
    switch (ctx.intent) {
      case 'expensive':
        return { text: fill(pick(T.EXPENSIVE, s), ctx), expr: 'annoyed' };
      case 'custom':
        return { text: fill(pick(T.CUSTOM, s), ctx), expr: 'think' };
      case 'request':
        return { text: fill(pick(T.REQUEST, s), ctx), expr: 'happy' };
      case 'slow':
        return { text: fill(pick(T.SLOW, s), ctx), expr: 'annoyed' };
      default:
        return { text: fill(pick(T.OPENING[ctx.plan.personality], s), ctx), expr: ctx.plan.personality === 'shy' ? 'sad' : 'happy' };
    }
  }

  async react(ctx: CustomerContext, choiceId: string, o: Outcome): Promise<Reply> {
    const lines = T.REACT[choiceId] ?? T.REACT.accept;
    const pool = o.buys ? lines.yes : lines.no.length ? lines.no : lines.yes;
    return { text: fill(pick(pool, ctx.plan.seed), ctx), expr: o.buys ? (o.satDelta >= 0 ? 'happy' : 'normal') : 'sad' };
  }

  async pickup(ctx: CustomerContext, sat: number): Promise<Reply> {
    const s = ctx.plan.seed;
    if (sat >= 0.8) return { text: pick(ctx.catCafe && s % 2 ? T.PICKUP.cat : T.PICKUP.great, s), expr: 'happy' };
    if (sat >= 0.55) return { text: pick(T.PICKUP.ok, s), expr: 'normal' };
    return { text: pick(T.PICKUP.bad, s), expr: 'annoyed' };
  }

  grumble(ctx: CustomerContext): string {
    return pick(T.QUEUE_GRUMBLE, ctx.plan.seed);
  }

  leaveAngry(ctx: CustomerContext): string {
    return pick(T.LEAVE_ANGRY, ctx.plan.seed);
  }

  closed(ctx: CustomerContext): string {
    return pick(T.CLOSED, ctx.plan.seed);
  }
}
