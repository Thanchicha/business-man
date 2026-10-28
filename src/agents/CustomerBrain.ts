import type { Expr } from '../game/specs';
import type { CustomerPlan } from '../sim/demand';
import type { Intent, Outcome } from '../sim/service';

export interface CustomerContext {
  plan: CustomerPlan;
  intent: Intent;
  menuName: string;
  price: number;
  altName?: string;
  waitedFrac: number;
  catCafe: boolean;
}

export interface Reply {
  text: string;
  expr: Expr;
}

/**
 * What a customer says. The game rules (who buys, satisfaction) live in sim/service;
 * a brain only decides the words, so a Claude-powered brain can be swapped in later
 * by implementing this interface behind a small server that holds the API key.
 */
export interface CustomerBrain {
  opening(ctx: CustomerContext): Promise<Reply>;
  react(ctx: CustomerContext, choiceId: string, outcome: Outcome): Promise<Reply>;
  pickup(ctx: CustomerContext, satisfaction: number): Promise<Reply>;
  grumble(ctx: CustomerContext): string;
  leaveAngry(ctx: CustomerContext): string;
  closed(ctx: CustomerContext): string;
}
