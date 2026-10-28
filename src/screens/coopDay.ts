import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, bubble, floatAt, Hud, stepChip, toast } from '../ui/components';
import { cupIcon, ING_ICON } from './icons';
import { go } from '../game/flow';
import { CAST, customerSpec, type Expr } from '../game/specs';
import { G } from '../sim/GameState';
import { MENU } from '../data/menus';
import { ING } from '../data/ingredients';
import { planDay, planDelivery, type CustomerPlan, type DeliveryOrder } from '../sim/demand';
import { addPurchase, canMake, closeDay, consume, consumeServings, cupsPossible, emptyTally, missingFor, stock, type DayTally } from '../sim/economy';
import { alternativeMenu, choicesFor, deliverySatisfaction, finalSatisfaction, intentFor, makeSeconds, priceOf, REP_LOST_CUSTOMER, repFromSatisfaction, resolve, reviewChance, starsFor, unitPrice, type Choice, type Intent, type Outcome } from '../sim/service';
import { EXTRA_PEARL_PRICE, ICE_LABEL, interview, makePenalty, orderSpec, QUESTIONS, segName, specText, SWEET_LABEL, type Insight, type Level, type OrderSpec, type Question } from '../sim/taste';
import { rng } from '../sim/rng';
import { Cat, CAT_COATS } from '../three/models/character';
import { createCharacter, type Character } from '../three/models/miyu';
import { buildShop } from '../three/sets/interiors';
import { ScriptedCustomerBrain } from '../agents/ScriptedCustomerBrain';
import type { CustomerContext } from '../agents/CustomerBrain';
import { baht } from '../game/format';
import { sfx, type Sound } from '../ui/sfx';
import * as P from '../three/models/props';
import { act, getPlayers, isHost, mayDo, myId, myRole, nameOf, on, dayOp, roleFilled, sendFrame, sendFx } from '../coop/session';
import { ROLE, ROLES, type RoleId } from '../coop/roles';

/** A little longer and calmer than playing alone: the team has to talk to each other. */
const DAY_SEC = 180;
const PATIENCE_MULT = 1.3;
const INTERVIEW_COOLDOWN = 5;
const DELIVERY_DECIDE = 12;
const RUSH_SEC = 15;
const RUSH_MARKUP = 1.3;
/** A hired barista helps with bills nobody has picked up after this long. */
const STAFF_HELP_AFTER = 6;

type AState = 'entering' | 'queue' | 'toCounter' | 'ordering' | 'waiting' | 'seated' | 'leaving' | 'gone';

interface ActorView {
  id: number;
  seed: number;
  reg?: CustomerPlan['regular'];
  x: number;
  z: number;
  ry: number;
  walk: boolean;
  expr: Expr;
  sit: boolean;
  cup: string | null;
  say: string | null;
  cls: string;
  no: number | null;
  state: AState;
  iv: boolean;
  menu: string;
  seg: string;
}

interface TicketView {
  id: number;
  no: number;
  delivery: boolean;
  menuId: string;
  cups: number;
  spec: OrderSpec;
  status: 'queued' | 'claimed' | 'making' | 'ready';
  maker: string | null;
  done: number;
  total: number;
}

interface CounterView {
  actorId: number;
  text: string;
  menuId: string;
  cups: number;
  spec: OrderSpec;
  price: number;
  choices: Choice[];
}

interface Frame {
  running: boolean;
  clock: string;
  closing: boolean;
  actors: ActorView[];
  counter: CounterView | null;
  tickets: TicketView[];
  deliveries: { id: number; menuId: string; cups: number; left: number }[];
  stats: { revenue: number; cups: number; served: number; lost: number; cash: number; rep: number; stock: Record<string, number>; low: string[]; rush: { ing: string; left: number }[] };
  cooldown: Record<string, number>;
}

type Op =
  | { op: 'reply'; actorId: number; choiceId: string }
  | { op: 'delivery'; id: number; accept: boolean }
  | { op: 'rush'; ing: string }
  | { op: 'claim'; ticketId: number }
  | { op: 'release'; ticketId: number }
  | { op: 'make'; ticketId: number; menuId: string; spec: OrderSpec }
  | { op: 'serve'; ticketId: number; actorId: number }
  | { op: 'interview'; actorId: number; q: Question };

type Fx = { k: 'float'; x: number; y: number; z: number; text: string; color?: string } | { k: 'toast'; text: string; cls?: string } | { k: 'sfx'; s: Sound } | { k: 'insight'; ins: Insight };

const TIPS: Record<RoleId, string> = {
  cashier: 'คุณอยู่เคาน์เตอร์! ลูกค้ามาถึงจะบอกว่าอยากได้อะไร เลือกคำตอบแล้วรับเงิน ดูสต็อกด้วยนะ ใกล้หมดสั่งของด่วนได้',
  barista: 'บิลจะเข้ามาทางซ้าย กด "รับบิล" เลือกเมนู น้ำแข็ง ความหวานให้ตรง แล้วส่งให้ลูกค้าที่มีเลขตรงกันนะ',
  scout: 'เดินคุยกับลูกค้าที่มี 🎤 บนหัว ถามเรื่องรสชาติ ร้านคู่แข่ง หรือสิ่งที่อยากได้ แล้วส่งข้อมูลให้คนชงไปปรับสูตร',
};

export function coopDayScreen(stage: Stage, data: { guest?: boolean } = {}): () => void {
  const host = isHost() && !data.guest;
  const set = buildShop(G.shopSize === 'catcafe', G.furniture);
  stage.add(set.group);
  set.setMenu(G.menus.map((id) => `${MENU[id].short} ${priceOf(G, id)}`));
  const e = stage.engine;
  e.camera.position.copy(set.camera.pos);
  e.look(set.camera.look.x, set.camera.look.y, set.camera.look.z);
  e.setSky('#4a3a32', false);
  e.hemi.color.set('#fff1e0');
  e.hemi.groundColor.set('#b08a68');
  e.sun.color.set('#ffe6c4');
  addCats(stage, set);
  const offs: (() => void)[] = [];

  // ---------------------------------------------------------------- effects everyone sees
  const notes: Insight[] = [...G.coop.insights.filter((i) => i.day === G.day)];
  function playFx(f: Fx) {
    if (f.k === 'float') {
      const s = e.project(new THREE.Vector3(f.x, f.y, f.z));
      floatAt(s.x, s.y, f.text, f.color);
    } else if (f.k === 'toast') toast(f.text, f.cls);
    else if (f.k === 'sfx') sfx(f.s);
    else if (f.k === 'insight') {
      notes.push(f.ins);
      redrawPanel(true);
    }
  }
  const fx = (f: Fx) => {
    playFx(f);
    sendFx(f);
  };
  if (!host) offs.push(on('fx', playFx));

  // ---------------------------------------------------------------- host simulation
  let frame: Frame = emptyFrame();
  const sim = host ? hostSim() : null;
  if (!host) offs.push(on('frame', (f: Frame) => (frame = f)));
  if (import.meta.env.DEV) Object.assign(window, { __coopFrame: () => frame });

  function hostSim() {
    const brain = new ScriptedCustomerBrain();
    const rnd = rng(G.day * 977 + (G.location?.length ?? 0) * 31 + G.menus.length + 7);
    const { customers: plan, config } = planDay(G, rnd);
    for (const p of plan) p.patience *= PATIENCE_MULT;
    const tally: DayTally = emptyTally(config.event?.title);
    const deliveries = planDelivery(G, rnd, config);
    const taken = new Map<number, number>();

    interface Actor {
      plan: CustomerPlan;
      x: number;
      z: number;
      ry: number;
      dest: { x: number; z: number } | null;
      onArrive?: () => void;
      walk: boolean;
      state: AState;
      waited: number;
      grumbled: boolean;
      slot: number;
      expr: Expr;
      sit: boolean;
      cup: string | null;
      say: { text: string; cls: string; until: number } | null;
      spec: OrderSpec;
      no: number | null;
      ticket: number | null;
      iv: boolean;
      penalty: number;
      ctx?: CustomerContext;
      outcome?: Outcome;
    }
    interface Ticket extends TicketView {
      actor: Actor | null;
      order?: DeliveryOrder;
      placedAt: number;
      made?: { menuId: string; spec: OrderSpec };
      queuedAt: number;
      readyAt?: number;
    }
    const actors: Actor[] = [];
    const tickets: Ticket[] = [];
    const pending: { order: DeliveryOrder; until: number }[] = [];
    const rush: { ing: string; at: number }[] = [];
    const cooldown: Record<string, number> = {};
    const timers: { at: number; fn: () => void }[] = [];
    let counter: { actor: Actor; intent: Intent; text: string; choices: Choice[]; autoAt: number | null } | null = null;
    let atCounter: Actor | null = null;
    let t = 0;
    let simT = 0;
    let next = 0;
    let nextDelivery = 0;
    let nextNo = 1;
    let nextTicket = 1;
    let running = false;
    let closing = false;
    let finished = false;
    let sendIn = 0;

    const later = (sec: number, fn: () => void) => timers.push({ at: simT + sec, fn });
    const say = (a: Actor, text: string, sec = 2.6, cls = '') => (a.say = { text, cls, until: sec > 0 ? simT + sec : Infinity });
    const moveTo = (a: Actor, p: THREE.Vector3, then?: () => void) => {
      a.dest = { x: p.x, z: p.z };
      a.onArrive = then;
    };
    const ctxFor = (a: Actor, intent: Intent = 'order'): CustomerContext => {
      const alt = alternativeMenu(G, a.plan);
      return { plan: a.plan, intent, menuName: MENU[a.plan.menuId].short, price: Math.round(unitPrice(G, a.plan)), altName: alt ? MENU[alt].short : undefined, waitedFrac: a.waited / a.plan.patience, catCafe: G.shopSize === 'catcafe' };
    };
    const cashierLook = () => getPlayers().find((p) => p.role === 'cashier')?.look ?? G.playerKey;
    const staffHas = (id: string) => G.staff.includes(id);

    function spawn(p: CustomerPlan) {
      const a: Actor = { plan: p, x: set.door.x, z: set.door.z, ry: 0, dest: null, walk: false, state: 'entering', waited: 0, grumbled: false, slot: -1, expr: 'normal', sit: false, cup: null, say: null, spec: orderSpec(G, p), no: null, ticket: null, iv: false, penalty: 0 };
      actors.push(a);
      tally.visitors++;
      say(a, `${p.dineIn ? '🪑 นั่งทานที่ร้าน' : '🛍️ กลับบ้าน'}${p.coupon ? ' • 🎟️ มีคูปอง' : ''}`, 1.6);
    }
    function leave(a: Actor) {
      a.state = 'leaving';
      moveTo(a, set.door, () => (a.state = 'gone'));
    }
    function review(a: Actor, stars: number) {
      tally.reviews.push(stars);
      fx({ k: 'float', x: a.x, y: 2.6, z: a.z, text: '★'.repeat(stars) + '☆'.repeat(5 - stars), color: stars >= 4 ? '#ffb340' : 'var(--red)' });
      if (stars === 5 && G.promos.coupon.on) tally.couponsGiven++;
    }
    function leaveAngry(a: Actor) {
      tally.lost++;
      tally.feedback.leftAngry++;
      tally.repDelta += REP_LOST_CUSTOMER;
      a.expr = 'annoyed';
      say(a, brain.leaveAngry(ctxFor(a)), 1.5, 'angry');
      if (rnd() < 0.4) review(a, 1);
      fx({ k: 'sfx', s: 'bad' });
      a.state = 'leaving';
      later(0.6, () => leave(a));
    }

    async function takeOrder(a: Actor) {
      a.state = 'ordering';
      a.ry = Math.atan2(set.camera.pos.x - a.x, set.camera.pos.z - a.z);
      const intent = intentFor(G, a.plan, a.waited / a.plan.patience);
      a.ctx = ctxFor(a, intent);
      const line = await brain.opening(a.ctx);
      a.expr = line.expr;
      say(a, line.text, 0);
      fx({ k: 'sfx', s: 'pop' });
      if (intent === 'outOfStock') {
        const miss = missingFor(G.inventory, a.plan.menuId, a.plan.cups);
        fx({ k: 'toast', text: `⚠ วัตถุดิบหมด: ${miss ? ING[miss].name : MENU[a.plan.menuId].short}`, cls: 'bad' });
      }
      const choices = choicesFor(intent, cashierLook() === 'player_f' ? 'ค่ะ' : 'ครับ');
      counter = { actor: a, intent, text: line.text, choices, autoAt: roleFilled('cashier') ? null : simT + 1.2 };
    }

    async function reply(a: Actor, choiceId: string) {
      if (!counter || counter.actor !== a) return;
      const intent = counter.intent;
      counter = null;
      const o = resolve(G, a.plan, intent, choiceId, rnd());
      a.outcome = o;
      const r = await brain.react({ ...a.ctx!, altName: MENU[o.menuId].short }, choiceId, o);
      a.expr = r.expr;
      say(a, r.text, 1.8);
      if (o.feedback) tally.feedback[o.feedback]++;
      if (o.idea) tally.requests[o.idea] = (tally.requests[o.idea] ?? 0) + 1;
      if (o.idea && choiceId === 'note') G.ideas[o.idea] = (G.ideas[o.idea] ?? 0) + 1;
      if (o.buys && canMake(G.inventory, o.menuId, o.cups)) {
        const spec = o.menuId === a.plan.menuId ? a.spec : orderSpec(G, a.plan, o.menuId);
        a.spec = spec;
        const extra = spec.extraPearl ? EXTRA_PEARL_PRICE * o.cups : 0;
        const paid = o.priceEach * o.cups + extra;
        tally.revenue += paid;
        tally.cogs += consume(G.inventory, o.menuId, o.cups) + o.extraCost;
        if (spec.extraPearl) tally.cogs += (consumeServings(G.inventory, 'pearls', o.cups) * ING.pearls.price) / ING.pearls.servings;
        tally.cupsSold += o.cups;
        tally.sales[o.menuId] = (tally.sales[o.menuId] ?? 0) + o.cups;
        fx({ k: 'float', x: -2.6, y: 1.6, z: 3.8, text: `+${baht(paid)}` });
        fx({ k: 'sfx', s: 'coin' });
        const no = nextNo++;
        a.no = no;
        const tk: Ticket = { id: nextTicket++, no, delivery: false, menuId: o.menuId, cups: o.cups, spec, status: 'queued', maker: null, done: 0, total: makeSeconds(G, o.menuId, o.cups, o.extraMakeTime), actor: a, placedAt: simT, queuedAt: simT };
        tickets.push(tk);
        a.ticket = tk.id;
        later(0.9, () => {
          a.state = 'waiting';
          atCounter = null;
          const used = new Set(actors.filter((x) => x.state === 'waiting' && x !== a).map((x) => x.slot));
          a.slot = [0, 1, 2].find((s) => !used.has(s)) ?? 2;
          moveTo(a, set.pickup[a.slot], () => (a.ry = Math.atan2(set.camera.pos.x - a.x, set.camera.pos.z - a.z)));
        });
      } else {
        tally.lost++;
        tally.repDelta += REP_LOST_CUSTOMER / 2;
        fx({ k: 'sfx', s: 'bad' });
        later(1, () => {
          atCounter = null;
          leave(a);
        });
      }
    }

    function acceptDelivery(order: DeliveryOrder) {
      if (!canMake(G.inventory, order.menuId, order.cups)) {
        tally.deliveryCancelled++;
        tally.repDelta -= 0.02;
        if (rnd() < 0.5) tally.reviews.push(1);
        fx({ k: 'toast', text: `📱 ยกเลิกออเดอร์ ${MENU[order.menuId].short} — วัตถุดิบหมด`, cls: 'bad' });
        fx({ k: 'sfx', s: 'bad' });
        return;
      }
      const gross = (G.delivery.prices[order.menuId] ?? priceOf(G, order.menuId) + 10) * order.cups;
      tally.revenue += gross;
      tally.deliverySales += gross;
      tally.deliveryOrders++;
      tally.cogs += consume(G.inventory, order.menuId, order.cups);
      tally.cupsSold += order.cups;
      tally.sales[order.menuId] = (tally.sales[order.menuId] ?? 0) + order.cups;
      tickets.push({ id: nextTicket++, no: nextNo++, delivery: true, menuId: order.menuId, cups: order.cups, spec: { ice: 1, sweet: 1, extraPearl: false }, status: 'queued', maker: null, done: 0, total: makeSeconds(G, order.menuId, order.cups), actor: null, order, placedAt: simT, queuedAt: simT });
      fx({ k: 'toast', text: `📱 รับออเดอร์เดลิเวอรี่: ${MENU[order.menuId].short} ×${order.cups}` });
      fx({ k: 'sfx', s: 'pop' });
    }

    function freeSeat(): number {
      for (let i = 0; i < set.seats.length; i++) if (!taken.has(i)) return i;
      return -1;
    }

    function finish(tk: Ticket) {
      tickets.splice(tickets.indexOf(tk), 1);
      fx({ k: 'sfx', s: 'done' });
      const made = tk.made ?? { menuId: tk.menuId, spec: tk.spec };
      const miss = makePenalty({ menuId: tk.menuId, spec: tk.spec }, made);
      if (!tk.actor) {
        const sat = Math.max(0, deliverySatisfaction(G, tk.menuId, simT - tk.placedAt) - miss);
        tally.repDelta += repFromSatisfaction(sat) * 0.6;
        if (miss >= 0.3) tally.feedback.wrongOrder++;
        fx({ k: 'float', x: set.pickup[2].x, y: 2.2, z: set.pickup[2].z, text: '📱 ไรเดอร์รับของแล้ว', color: 'var(--green)' });
        if (rnd() < reviewChance(G, sat) * 0.7) tally.reviews.push(starsFor(sat));
        return;
      }
      const a = tk.actor;
      const o = { ...a.outcome!, menuId: made.menuId };
      const frac = a.waited / a.plan.patience;
      const seat = a.plan.dineIn ? freeSeat() : -1;
      const noSeat = a.plan.dineIn && seat < 0;
      if (noSeat) tally.feedback.noSeat++;
      if (miss >= 0.3) tally.feedback.wrongOrder++;
      const sat = Math.max(0, finalSatisfaction(G, a.plan, o, frac) - (noSeat ? 0.08 : 0) - a.penalty - miss);
      if (seat >= 0) {
        tally.dineIn++;
        taken.set(seat, a.plan.id);
      } else tally.takeaway++;
      tally.served++;
      tally.repDelta += repFromSatisfaction(sat);
      if (sat >= 0.85) tally.feedback.compliment++;
      if (frac > 0.8) tally.feedback.slow++;
      a.cup = made.menuId;
      a.no = null;
      void brain.pickup({ ...a.ctx!, waitedFrac: frac }, sat).then((r) => {
        a.expr = r.expr;
        say(a, noSeat ? 'ที่นั่งเต็มเลย... งั้นขอกลับบ้านละกัน' : miss >= 0.3 ? 'เอ๊ะ... นี่ไม่ใช่เมนูที่สั่งนี่นา' : miss > 0 ? 'ไม่ค่อยตรงที่สั่งนะ... แต่ไม่เป็นไร' : r.text, 1.6);
        if (sat >= 0.85) fx({ k: 'float', x: a.x, y: 2.3, z: a.z, text: '♥', color: 'var(--pink)' });
        if (rnd() < reviewChance(G, sat)) later(0.9, () => review(a, starsFor(sat)));
        if (seat < 0) return later(1.3, () => leave(a));
        later(1.1, () => {
          a.state = 'seated';
          moveTo(a, set.seats[seat].pos, () => {
            a.sit = true;
            a.ry = set.seats[seat].rot;
            later(9 + rnd() * 7, () => {
              a.sit = false;
              taken.delete(seat);
              leave(a);
            });
          });
        });
      });
    }

    function close() {
      closing = true;
      next = plan.length;
      for (const p of pending.splice(0)) acceptDelivery(p.order);
      for (const a of actors) {
        if (a.state === 'queue' || a.state === 'entering') {
          tally.lost++;
          tally.feedback.closed++;
          say(a, brain.closed(ctxFor(a)), 1.2);
          a.state = 'leaving';
          later(0.7, () => leave(a));
        }
      }
    }

    // moves from players, checked against their job
    offs.push(
      on('day', (o: Op, from: string) => {
        const who = nameOf(from);
        if (o.op === 'reply' && mayDo(from, 'cashier') && counter && counter.actor.plan.id === o.actorId) void reply(counter.actor, o.choiceId);
        else if (o.op === 'delivery' && mayDo(from, 'cashier')) {
          const i = pending.findIndex((p) => p.order.id === o.id);
          if (i < 0) return;
          const [p] = pending.splice(i, 1);
          if (o.accept) acceptDelivery(p.order);
          else {
            tally.deliveryCancelled++;
            tally.repDelta -= 0.005;
            fx({ k: 'toast', text: `📱 ปฏิเสธออเดอร์ ${MENU[p.order.menuId].short}` });
          }
        } else if (o.op === 'rush' && mayDo(from, 'cashier') && ING[o.ing]) {
          const price = Math.round(ING[o.ing].price * RUSH_MARKUP);
          if (G.cash + tally.revenue < price) return fx({ k: 'toast', text: 'เงินไม่พอสั่งของด่วน', cls: 'bad' });
          G.cash -= price;
          G.pendingShopping += price;
          rush.push({ ing: o.ing, at: simT + RUSH_SEC });
          fx({ k: 'toast', text: `🛵 ${who} สั่ง${ING[o.ing].name}ด่วน ${baht(price)} มาถึงใน ${RUSH_SEC} วิ` });
        } else if (o.op === 'claim' && mayDo(from, 'barista')) {
          const tk = tickets.find((x) => x.id === o.ticketId);
          if (tk && tk.status === 'queued' && !tickets.some((x) => x.maker === from && (x.status === 'claimed' || x.status === 'making'))) {
            tk.status = 'claimed';
            tk.maker = from;
          }
        } else if (o.op === 'release') {
          const tk = tickets.find((x) => x.id === o.ticketId);
          if (tk && tk.maker === from && tk.status === 'claimed') {
            tk.status = 'queued';
            tk.maker = null;
          }
        } else if (o.op === 'make') {
          const tk = tickets.find((x) => x.id === o.ticketId);
          if (tk && tk.maker === from && tk.status === 'claimed' && MENU[o.menuId]) {
            tk.made = { menuId: o.menuId, spec: o.spec };
            tk.status = 'making';
            // the player's own hands, a bit quicker than the shop's usual pace
            tk.total = makeSeconds(G, tk.menuId, tk.cups) * 0.8;
          }
        } else if (o.op === 'serve' && mayDo(from, 'barista')) {
          const tk = tickets.find((x) => x.id === o.ticketId);
          const a = actors.find((x) => x.plan.id === o.actorId);
          if (!tk || tk.status !== 'ready' || !a || a.state !== 'waiting') return;
          if (a.ticket !== tk.id) {
            say(a, `ไม่ใช่ของฉันนะ ฉันเลข #${a.no}`, 1.8, 'angry');
            if (tk.actor) tk.actor.penalty += 0.03;
            fx({ k: 'sfx', s: 'bad' });
            return;
          }
          finish(tk);
        } else if (o.op === 'interview' && mayDo(from, 'scout')) {
          const a = actors.find((x) => x.plan.id === o.actorId);
          if (!a || a.iv || !['queue', 'ordering', 'waiting', 'seated'].includes(a.state) || (cooldown[from] ?? 0) > simT) return;
          a.iv = true;
          cooldown[from] = simT + INTERVIEW_COOLDOWN;
          // a friendly chat makes the wait feel shorter
          if (a.state === 'queue') a.waited = Math.max(0, a.waited - 3);
          const id = Math.max(0, ...G.coop.insights.map((i) => i.id), ...G.coop.proposals.map((p) => p.id)) + 1;
          const ins = interview(G, a.plan, a.outcome?.menuId ?? a.plan.menuId, o.q, who, id);
          G.coop.insights.push(ins);
          a.expr = 'happy';
          say(a, ins.text.replace(/^\([^)]*\)\s*/, ''), 3);
          fx({ k: 'insight', ins });
          fx({ k: 'sfx', s: 'page' });
        }
      }),
    );

    function step(dt: number) {
      simT += dt;
      for (let i = timers.length - 1; i >= 0; i--)
        if (timers[i].at <= simT) {
          const [tm] = timers.splice(i, 1);
          tm.fn();
        }
      if (running && !finished) {
        if (!closing) {
          t += dt;
          if (t >= DAY_SEC) close();
        }
        while (!closing && next < plan.length && plan[next].arriveAt * DAY_SEC <= t) spawn(plan[next++]);
        while (!closing && nextDelivery < deliveries.length && deliveries[nextDelivery].arriveAt * DAY_SEC <= t) {
          const d = deliveries[nextDelivery++];
          if (roleFilled('cashier')) {
            pending.push({ order: d, until: simT + DELIVERY_DECIDE });
            fx({ k: 'sfx', s: 'pop' });
          } else acceptDelivery(d);
        }
        for (let i = pending.length - 1; i >= 0; i--) if (pending[i].until <= simT) acceptDelivery(pending.splice(i, 1)[0].order);
        for (let i = rush.length - 1; i >= 0; i--)
          if (rush[i].at <= simT) {
            const [r] = rush.splice(i, 1);
            addPurchase(G.inventory, r.ing, 1, G.day);
            fx({ k: 'toast', text: `🛵 ${ING[r.ing].name} มาส่งแล้ว`, cls: 'good' });
          }
        // after closing nobody is kept waiting at the counter, even if the cashier stepped away
        if (counter && closing && counter.autoAt === null) counter.autoAt = simT + 4;
        if (counter?.autoAt && counter.autoAt <= simT) void reply(counter.actor, counter.choices[0].id);

        for (const a of actors) {
          if (a.state === 'gone') continue;
          if (a.dest) {
            const d = Math.hypot(a.dest.x - a.x, a.dest.z - a.z);
            if (d < 0.05) {
              a.x = a.dest.x;
              a.z = a.dest.z;
              a.dest = null;
              a.walk = false;
              const f = a.onArrive;
              a.onArrive = undefined;
              f?.();
            } else {
              a.walk = true;
              a.ry = Math.atan2(a.dest.x - a.x, a.dest.z - a.z);
              const s = Math.min(d, dt * 2.6) / d;
              a.x += (a.dest.x - a.x) * s;
              a.z += (a.dest.z - a.z) * s;
            }
          }
          if (a.state === 'queue' || a.state === 'entering' || a.state === 'toCounter') a.waited += dt;
          else if (a.state === 'ordering') a.waited += dt * 0.4;
          else if (a.state === 'waiting') a.waited += dt * 0.7;
          const frac = a.waited / a.plan.patience;
          if ((a.state === 'queue' || a.state === 'entering') && frac > 0.55 && !a.grumbled) {
            a.grumbled = true;
            a.expr = 'annoyed';
            say(a, brain.grumble(ctxFor(a)), 1.8);
          }
          if ((a.state === 'queue' || a.state === 'entering') && frac > 1) leaveAngry(a);
          if (a.say && a.say.until <= simT) a.say = null;
        }

        const queue = actors.filter((a) => a.state === 'queue' || a.state === 'entering');
        if (!atCounter && queue.length && queue[0].state === 'queue') {
          const a = queue.shift()!;
          atCounter = a;
          a.state = 'toCounter';
          a.slot = -1;
          moveTo(a, set.order, () => void takeOrder(a));
        }
        queue.forEach((a, i) => {
          const slot = Math.min(i, set.queue.length - 1);
          if (a.slot !== slot) {
            a.slot = slot;
            moveTo(a, set.queue[slot], () => {
              if (a.state === 'entering') a.state = 'queue';
              a.ry = Math.atan2(set.order.x - a.x, set.order.z - a.z);
            });
          }
        });

        // bills: players make what they claimed; the shop's own hands do the rest
        const ids = new Set(getPlayers().map((p) => p.id));
        // a friend who left: their bills go back on the rail, finished cups are handed out for them
        for (const tk of [...tickets]) {
          if (!tk.maker || tk.maker === 'staff' || ids.has(tk.maker)) continue;
          if (tk.status === 'ready') finish(tk);
          else ((tk.status = 'queued'), (tk.maker = null));
        }
        const baristas = roleFilled('barista');
        // after closing an extra pair of hands helps so the team is never stuck waiting on one bill
        const staffSlots = (baristas ? 0 : 1) + (baristas && staffHas('barista') ? 1 : 0) + (closing ? 2 : 0);
        const staffBusy = tickets.filter((x) => x.maker === 'staff').length;
        if (staffBusy < staffSlots) {
          const tk = tickets.find((x) => x.status === 'queued' && (!baristas || simT - x.queuedAt > STAFF_HELP_AFTER));
          if (tk) {
            tk.status = 'making';
            tk.maker = 'staff';
            tk.made = { menuId: tk.menuId, spec: tk.spec };
          }
        }
        for (const tk of [...tickets]) {
          if (tk.status !== 'making') continue;
          tk.done += dt;
          if (tk.done < tk.total) continue;
          tk.status = 'ready';
          tk.readyAt = simT;
          if (tk.maker === 'staff' || tk.delivery) finish(tk);
          else fx({ k: 'sfx', s: 'done' });
        }

        if (closing)
          for (const tk of [...tickets]) {
            if (tk.status === 'ready' && simT - (tk.readyAt ?? simT) > 10) finish(tk);
            else if (tk.status === 'claimed' && simT - tk.queuedAt > 20) ((tk.status = 'queued'), (tk.maker = null));
          }

        if (closing && !atCounter && !tickets.length && !pending.length && actors.every((a) => a.state === 'leaving' || a.state === 'gone')) {
          finished = true;
          const log = closeDay(G, tally);
          later(0.9, () => go('summary', { log }));
        }
      }
      const minutes = Math.min(600, (t / DAY_SEC) * 600);
      frame = {
        running,
        clock: `☀ ${10 + Math.floor(minutes / 60)}:${String(Math.floor((minutes % 60) / 10) * 10).padStart(2, '0')}${closing ? ' ปิดร้าน' : ''}`,
        closing,
        actors: actors
          .filter((a) => a.state !== 'gone')
          .map((a) => ({ id: a.plan.id, seed: a.plan.seed, reg: a.plan.regular, x: a.x, z: a.z, ry: a.ry, walk: a.walk, expr: a.expr, sit: a.sit, cup: a.cup, say: a.say?.text ?? null, cls: a.say?.cls ?? '', no: a.no, state: a.state, iv: a.iv, menu: a.outcome?.menuId ?? a.plan.menuId, seg: segName(a.plan.segment) })),
        counter: counter && { actorId: counter.actor.plan.id, text: counter.text, menuId: counter.actor.plan.menuId, cups: counter.actor.plan.cups, spec: counter.actor.spec, price: Math.round(unitPrice(G, counter.actor.plan) * counter.actor.plan.cups), choices: counter.choices },
        tickets: tickets.map((x) => ({ id: x.id, no: x.no, delivery: x.delivery, menuId: x.menuId, cups: x.cups, spec: x.spec, status: x.status, maker: x.maker, done: x.done, total: x.total })),
        deliveries: pending.map((p) => ({ id: p.order.id, menuId: p.order.menuId, cups: p.order.cups, left: Math.ceil(p.until - simT) })),
        stats: {
          revenue: Math.round(tally.revenue),
          cups: tally.cupsSold,
          served: tally.served,
          lost: tally.lost,
          cash: G.cash + tally.revenue,
          rep: G.reputation + tally.repDelta,
          stock: Object.fromEntries(G.menus.map((id) => [id, cupsPossible(G.inventory, id)])),
          low: [...new Set([...G.menus.flatMap((m) => Object.keys(MENU[m].recipe)), 'pearls'])].filter((i) => stock(G.inventory, i) < 6),
          rush: rush.map((r) => ({ ing: r.ing, left: Math.ceil(r.at - simT) })),
        },
        cooldown: Object.fromEntries(Object.entries(cooldown).map(([k, v]) => [k, Math.max(0, Math.ceil(v - simT))])),
      };
      sendIn -= dt / stage.timeScale;
      if (sendIn <= 0) {
        sendIn = 0.15;
        sendFrame(frame);
      }
    }
    return { step, start: () => (running = true) };
  }

  // ---------------------------------------------------------------- the shop as everyone sees it
  interface View {
    chibi: Character;
    cup: THREE.Object3D | null;
    cupId: string | null;
    say: string | null;
    sayEl?: HTMLElement;
    tag: string;
    tagEl?: HTMLElement;
    expr: Expr;
  }
  const views = new Map<number, View>();
  function render(dt: number) {
    const seen = new Set<number>();
    for (const a of frame.actors) {
      seen.add(a.id);
      let v = views.get(a.id);
      if (!v) {
        const chibi = createCharacter(a.reg ? CAST[a.reg] : customerSpec(a.seed, undefined, G.location ?? undefined));
        chibi.root.position.set(a.x, 0, a.z);
        stage.add(chibi.root);
        stage.click(chibi.root, () => clickActor(a.id));
        v = { chibi, cup: null, cupId: null, say: null, tag: '', expr: 'normal' };
        views.set(a.id, v);
      }
      const p = v.chibi.root.position;
      const far = Math.hypot(a.x - p.x, a.z - p.z) > 3;
      const k = host || far ? 1 : Math.min(1, dt * 8);
      p.x += (a.x - p.x) * k;
      p.z += (a.z - p.z) * k;
      p.y = a.sit ? 0.16 : 0;
      v.chibi.root.rotation.y = a.ry;
      v.chibi.walking = a.walk;
      v.chibi.sitting = a.sit;
      if (v.expr !== a.expr) v.chibi.setExpr((v.expr = a.expr));
      if (v.cupId !== a.cup) {
        v.cup?.removeFromParent();
        v.cupId = a.cup;
        v.cup = null;
        if (a.cup) {
          const m = MENU[a.cup];
          v.cup = P.bubbleTea(m.color, !!m.topping, m.layer);
          v.cup.scale.setScalar(1.3);
          v.cup.position.set(0, 1.25, 0.35);
          v.chibi.root.add(v.cup);
        }
      }
      if (v.say !== a.say) {
        if (v.sayEl) stage.unlabel(v.sayEl);
        v.sayEl = undefined;
        v.say = a.say;
        if (a.say) v.sayEl = stage.label(v.chibi.root, bubble(a.say, `${a.cls} ${a.state === 'ordering' ? 'big' : ''}`), 1.75);
      }
      const mic = myRole() === 'scout' && !a.iv && ['queue', 'ordering', 'waiting', 'seated'].includes(a.state);
      const tag = [a.no ? `#${a.no}` : '', mic ? '🎤' : ''].filter(Boolean).join(' ');
      if (v.tag !== tag) {
        if (v.tagEl) stage.unlabel(v.tagEl);
        v.tagEl = undefined;
        v.tag = tag;
        if (tag) v.tagEl = stage.label(v.chibi.root, h('div', `tag3d ${mic ? 'pin' : ''}`, tag), a.say ? 2.9 : 2.05);
      }
      v.chibi.update(dt);
    }
    for (const [id, v] of views)
      if (!seen.has(id)) {
        if (v.sayEl) stage.unlabel(v.sayEl);
        if (v.tagEl) stage.unlabel(v.tagEl);
        stage.clickables.delete(v.chibi.root);
        v.chibi.root.removeFromParent();
        views.delete(id);
      }
  }

  // ---------------------------------------------------------------- panels
  const hud = new Hud(`วันที่ ${G.day} • ทีม`);
  hud.clock.style.display = '';
  hud.extra.style.display = '';
  const me = myRole();
  hud.extra.textContent = me ? `${ROLE[me].icon} ${ROLE[me].name}` : 'ทีม';
  stepChip('🐱', `วันที่ ${G.day} : เปิดร้านด้วยกัน`, 'แต่ละคนดูแลหน้าที่ของตัวเอง หน้าที่ว่างมีคนช่วยให้');
  if (host) {
    const speed = btn('▶ x1', '', () => {
      stage.timeScale = stage.timeScale === 1 ? 2 : 1;
      speed.textContent = stage.timeScale === 1 ? '▶ x1' : '▶▶ x2';
    }, 'small');
    mount(h('div', { class: 'row day-tools', style: { position: 'absolute', right: '20px', top: '76px' } }, speed));
  }
  // my own job first, then any job nobody has
  const myTabs: RoleId[] = [...(me ? [me] : []), ...ROLES.map((r) => r.id).filter((r) => r !== me && !roleFilled(r))];
  let tab: RoleId = myTabs[0] ?? 'cashier';
  const tabsEl = h('div', 'tabs');
  const panelBody = h('div');
  mount(h('div', { class: 'panel content coop-panel', style: { position: 'absolute', left: '20px', bottom: '20px', width: '440px', maxHeight: 'calc(100% - 150px)', overflowY: 'auto' } }, tabsEl, panelBody));
  const drawTabs = () =>
    tabsEl.replaceChildren(
      ...myTabs.map((r) => {
        const b = btn(`${ROLE[r].icon} ${ROLE[r].name}${r === me ? ' ⭐' : ''}`, '', () => {
          tab = r;
          drawTabs();
          redrawPanel(true);
        }, 'small');
        b.classList.toggle('on', r === tab);
        return b;
      }),
    );
  drawTabs();
  const adv = new Advisor('bottom-right');
  adv.say(me ? TIPS[me] : 'ช่วยกันดูแลร้านนะ!', 'happy');
  setTimeout(() => adv.el.isConnected && adv.hide(), 9000);

  // the barista's cup in progress, local to this screen
  let build: { ticketId: number; menuId: string | null; ice: Level | null; sweet: Level | null; pearl: boolean } | null = null;
  let serving: number | null = null;
  let asking: number | null = null;
  let sig = '';

  function clickActor(id: number) {
    const a = frame.actors.find((x) => x.id === id);
    if (!a) return;
    if (serving !== null && a.state === 'waiting') {
      dayOp({ op: 'serve', ticketId: serving, actorId: id });
      serving = null;
      return redrawPanel(true);
    }
    if (myTabs.includes('scout') && !a.iv) {
      tab = 'scout';
      asking = id;
      drawTabs();
      redrawPanel(true);
    }
  }

  function redrawPanel(force = false) {
    const f = frame;
    const key = JSON.stringify([tab, f.running, f.counter, f.deliveries.map((d) => d.id), f.tickets.map((x) => [x.id, x.status, x.maker]), f.stats.stock, f.stats.low, f.stats.rush.length, build, serving, asking, f.actors.map((a) => [a.id, a.state, a.iv, a.no]), notes.length, f.cooldown[myId()] ? 1 : 0]);
    if (!force && key === sig) return updateLive();
    sig = key;
    if (!f.running) panelBody.replaceChildren(h('div', 'muted', host ? 'กด "เปิดร้าน!" เมื่อทีมพร้อม' : 'รอเจ้าของร้านเปิดร้าน...'));
    else panelBody.replaceChildren(tab === 'cashier' ? cashierPanel(f) : tab === 'barista' ? baristaPanel(f) : scoutPanel(f));
    updateLive();
  }

  function updateLive() {
    panelBody.querySelectorAll<HTMLElement>('[data-prog]').forEach((el) => {
      const tk = frame.tickets.find((x) => x.id === Number(el.dataset.prog));
      if (tk) el.style.width = `${Math.min(100, (tk.done / tk.total) * 100)}%`;
    });
    panelBody.querySelectorAll<HTMLElement>('[data-left]').forEach((el) => {
      const d = frame.deliveries.find((x) => x.id === Number(el.dataset.left));
      if (d) el.textContent = `${d.left} วิ`;
    });
  }

  function cashierPanel(f: Frame): HTMLElement {
    const c = f.counter;
    const box = h('div', 'col');
    box.append(h('div', 'row wrap', h('span', 'pill', `🪙 ${baht(f.stats.revenue)}`), h('span', 'pill', `🧋 ${f.stats.cups} แก้ว`), h('span', 'pill', `🙂 ${f.stats.served}`), h('span', 'pill bad', `🚶 เสีย ${f.stats.lost}`)));
    if (c) {
      box.append(
        h(
          'div',
          'promo on',
          h('div', 'row', cupIcon(c.menuId, 44), h('div', {}, h('b', {}, `${MENU[c.menuId].short} ×${c.cups}`), h('div', { style: { fontSize: '14px' } }, specText(c.spec)), h('div', 'muted', `ราคา ~${baht(c.price + (c.spec.extraPearl ? EXTRA_PEARL_PRICE * c.cups : 0))}`))),
          h('div', { style: { fontSize: '15px', margin: '6px 0' } }, `💬 "${c.text}"`),
          h('div', 'choice-list', ...c.choices.map((o, i) => btn(`${['💗', '💬', '🍹'][i] ?? '•'}  ${o.label}`, i === 0 ? 'pink' : '', () => dayOp({ op: 'reply', actorId: c.actorId, choiceId: o.id })))),
        ),
      );
    } else box.append(h('div', 'muted', f.closing ? 'ปิดร้านแล้ว~' : 'ยังไม่มีลูกค้าที่เคาน์เตอร์'));
    for (const d of f.deliveries)
      box.append(h('div', 'row promo', h('span', { style: { flex: '1' } }, `📱 ${MENU[d.menuId].short} ×${d.cups} `, h('small', { class: 'muted', 'data-left': d.id }, `${d.left} วิ`)), btn('รับ', 'mint', () => dayOp({ op: 'delivery', id: d.id, accept: true }), 'small'), btn('ปฏิเสธ', '', () => dayOp({ op: 'delivery', id: d.id, accept: false }), 'small')));
    box.append(h('b', {}, '📦 ทำได้อีก'), h('div', 'row wrap', ...Object.entries(f.stats.stock).map(([id, n]) => h('span', { class: `pill ${n <= 3 ? 'bad' : ''}` }, `${MENU[id].short} ${n}`))));
    if (f.stats.low.length)
      box.append(h('b', {}, `🛵 สั่งของด่วน (แพงขึ้น ${Math.round((RUSH_MARKUP - 1) * 100)}%)`), h('div', 'row wrap', ...f.stats.low.map((i) => btn(`${ING_ICON[i] ?? ''} ${ING[i].name} ${baht(Math.round(ING[i].price * RUSH_MARKUP))}`, 'gold', () => dayOp({ op: 'rush', ing: i }), 'small'))));
    for (const r of f.stats.rush) box.append(h('div', 'muted', `🛵 ${ING[r.ing].name} กำลังมา`));
    return box;
  }

  function baristaPanel(f: Frame): HTMLElement {
    const box = h('div', 'col');
    const mineTk = f.tickets.find((x) => x.maker === myId() && (x.status === 'claimed' || x.status === 'making'));
    const ready = f.tickets.filter((x) => x.status === 'ready' && x.maker === myId());
    const queued = f.tickets.filter((x) => x.status === 'queued');
    if (build && !f.tickets.some((x) => x.id === build!.ticketId && x.status === 'claimed')) build = null;
    if (serving !== null && !ready.some((x) => x.id === serving)) serving = null;
    for (const tk of ready) {
      const waiting = f.actors.filter((a) => a.state === 'waiting');
      box.append(
        h(
          'div',
          'promo on',
          h('div', 'row', cupIcon(tk.menuId, 40), h('b', { style: { flex: '1' } }, `✅ บิล #${tk.no} ${MENU[tk.menuId].short} ×${tk.cups} เสร็จแล้ว`)),
          serving === tk.id
            ? h('div', 'col', h('div', 'muted', 'ส่งให้ใคร? (คลิกลูกค้าในร้านก็ได้)'), h('div', 'row wrap', ...waiting.map((a) => btn(`#${a.no ?? '?'} ${MENU[a.menu].short}`, 'pink', () => {
                dayOp({ op: 'serve', ticketId: tk.id, actorId: a.id });
                serving = null;
                redrawPanel(true);
              }, 'small'))))
            : btn('ส่งให้ลูกค้า ›', 'pink', () => {
                serving = tk.id;
                redrawPanel(true);
              }, 'small'),
        ),
      );
    }
    if (mineTk?.status === 'making')
      box.append(h('div', 'promo', h('b', {}, `🫖 กำลังชงบิล #${mineTk.no} ${MENU[mineTk.menuId].short}`), h('div', { class: 'bar', style: { marginTop: '6px' } }, h('i', { 'data-prog': mineTk.id, style: { width: '0%' } }))));
    if (mineTk?.status === 'claimed') {
      if (!build || build.ticketId !== mineTk.id) build = { ticketId: mineTk.id, menuId: null, ice: null, sweet: null, pearl: false };
      const b = build;
      const pick = <T,>(label: string, cur: T, val: T, onPick: () => void, small = true) => btn(label, cur === val ? 'lav' : '', () => (onPick(), redrawPanel(true)), small ? 'small' : '');
      const start = btn('🫖 เริ่มชง', 'pink', () => {
        dayOp({ op: 'make', ticketId: mineTk.id, menuId: b.menuId!, spec: { ice: b.ice!, sweet: b.sweet!, extraPearl: b.pearl } });
        build = null;
      });
      start.disabled = b.menuId === null || b.ice === null || b.sweet === null;
      box.append(
        h(
          'div',
          'promo on',
          h('b', {}, `🧾 บิล #${mineTk.no}: ${MENU[mineTk.menuId].short} ×${mineTk.cups} • ${specText(mineTk.spec)}`),
          h('div', 'muted', 'เลือกให้ตรงกับบิล'),
          h('div', 'row wrap', ...G.menus.map((id) => {
            const c = h('div', { class: `card ${b.menuId === id ? 'sel' : ''}`, style: { padding: '4px 6px', fontSize: '12px', textAlign: 'center', width: '72px' } }, cupIcon(id, 34), MENU[id].short);
            c.addEventListener('click', () => ((b.menuId = id), redrawPanel(true)));
            return c;
          })),
          h('div', 'row wrap', ...ICE_LABEL.map((l, i) => pick(`🧊 ${l}`, b.ice, i as Level, () => (b.ice = i as Level)))),
          h('div', 'row wrap', ...SWEET_LABEL.map((l, i) => pick(`🍯 ${l}`, b.sweet, i as Level, () => (b.sweet = i as Level))), pick('⚫ +ไข่มุก', b.pearl, true, () => (b.pearl = !b.pearl))),
          h('div', 'row', start, btn('คืนบิล', '', () => dayOp({ op: 'release', ticketId: mineTk.id }), 'small')),
        ),
      );
    }
    box.append(h('b', {}, `🧾 บิลรอชง (${queued.length})`));
    if (!queued.length) box.append(h('div', 'muted', f.closing ? 'ปิดร้านแล้ว~' : 'ยังไม่มีบิล'));
    for (const tk of queued.slice(0, 6)) {
      const claim = btn('รับบิล', 'mint', () => dayOp({ op: 'claim', ticketId: tk.id }), 'small');
      claim.disabled = !!mineTk;
      box.append(h('div', 'row', cupIcon(tk.menuId, 32), h('span', { style: { flex: '1', fontSize: '14px' } }, `${tk.delivery ? '📱' : `#${tk.no}`} ${MENU[tk.menuId].short} ×${tk.cups}`, h('br'), h('small', 'muted', specText(tk.spec))), claim));
    }
    const others = f.tickets.filter((x) => x.maker && x.maker !== myId() && x.status !== 'queued');
    if (others.length) box.append(h('div', { class: 'muted', style: { fontSize: '13px' } }, others.map((x) => `#${x.no} ${x.maker === 'staff' ? 'พนักงาน' : nameOf(x.maker!)} กำลังทำ`).join(' • ')));
    return box;
  }

  function scoutPanel(f: Frame): HTMLElement {
    const box = h('div', 'col');
    const cd = f.cooldown[myId()] ?? 0;
    const people = f.actors.filter((a) => !a.iv && ['queue', 'ordering', 'waiting', 'seated'].includes(a.state));
    if (asking !== null && !people.some((a) => a.id === asking)) asking = null;
    const target = asking !== null ? f.actors.find((a) => a.id === asking) : null;
    if (target)
      box.append(
        h(
          'div',
          'promo on',
          h('b', {}, `🎤 คุยกับลูกค้า (${target.seg}) ที่สั่ง${MENU[target.menu].short}`),
          h('div', 'choice-list', ...QUESTIONS.map((q) => {
            const b = btn(q.label, '', () => {
              dayOp({ op: 'interview', actorId: target.id, q: q.id });
              asking = null;
              redrawPanel(true);
            });
            b.disabled = cd > 0;
            return b;
          })),
          cd > 0 ? h('div', 'muted', 'กำลังเดินไปหาลูกค้า...') : '',
          btn('ยกเลิก', '', () => ((asking = null), redrawPanel(true)), 'small'),
        ),
      );
    box.append(h('b', {}, `👥 ลูกค้าที่ยังไม่ได้คุย (${people.length})`), h('div', 'muted', 'คลิกลูกค้าที่มี 🎤 ในร้าน หรือเลือกจากรายชื่อ'));
    box.append(h('div', 'row wrap', ...people.slice(0, 8).map((a) => btn(`🎤 ${a.seg} • ${MENU[a.menu].short}`, '', () => ((asking = a.id), redrawPanel(true)), 'small'))));
    box.append(h('b', {}, `📝 บันทึกวันนี้ (${notes.length})`));
    const sent = new Set(G.coop.proposals.map((p) => p.reason));
    for (const n of [...notes].reverse().slice(0, 6)) {
      const row = h('div', { style: { fontSize: '14px', borderTop: '1px dashed var(--line)', paddingTop: '4px' } }, h('span', 'muted', `${n.who}: `), n.text);
      if (n.menuId && n.field && n.value !== undefined && !sent.has(n.text))
        row.append(' ', btn('📨 ส่งให้คนชง', 'pink', () => {
          act({ k: 'propose', menuId: n.menuId!, field: n.field!, value: n.value!, reason: n.text });
          sent.add(n.text);
          toast('ส่งข้อเสนอแล้ว คนชงจะเห็นตอนเช้า', 'good');
          redrawPanel(true);
        }, 'small'));
      box.append(row);
    }
    return box;
  }

  // ---------------------------------------------------------------- start & loop
  if (host) {
    const intro = mount(
      h(
        'div',
        { class: 'panel col', style: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '520px', textAlign: 'center' } },
        h('h2', {}, `เปิดร้านวันที่ ${G.day} ด้วยกัน!`),
        h('p', {}, getPlayers().map((p) => `${ROLE[p.role].icon} ${p.name}`).join(' • ')),
        h('p', 'muted', ROLES.filter((r) => !roleFilled(r.id)).map((r) => r.fallback).join(' ') || 'ทุกหน้าที่มีคนดูแลครบ!'),
        btn('เปิดร้าน!', 'pink', () => {
          intro.remove();
          sim!.start();
          fx({ k: 'sfx', s: 'done' });
        }, 'big'),
      ),
    );
  }
  // browsers stop drawing hidden tabs; keep the host's shop running so friends are not frozen
  // the shop runs on the wall clock, so a throttled or hidden host tab keeps true time
  let lastStep = performance.now();
  const stepSim = () => {
    const now = performance.now();
    // a hidden tab may only wake once a minute: catch up in small steps so nothing jumps
    let left = Math.min(120, (now - lastStep) / 1000) * stage.timeScale;
    lastStep = now;
    if (stage.paused || !sim) return;
    while (left > 0) {
      sim.step(Math.min(0.1, left));
      left -= 0.1;
    }
  };
  const keepAlive = window.setInterval(() => performance.now() - lastStep > 400 && stepSim(), 250);
  offs.push(() => clearInterval(keepAlive));
  stage.onUpdate((dt) => {
    stepSim();
    render(dt);
    hud.clock.textContent = frame.clock;
    hud.refresh(frame.stats.cash, frame.stats.rep);
    redrawPanel();
  });
  return () => offs.forEach((f) => f());
}

function emptyFrame(): Frame {
  return { running: false, clock: '☀ 10:00', closing: false, actors: [], counter: null, tickets: [], deliveries: [], stats: { revenue: 0, cups: 0, served: 0, lost: 0, cash: G.cash, rep: G.reputation, stock: {}, low: [], rush: [] }, cooldown: {} };
}

/** Cats wandering in the café corner; each screen moves its own, they are only for looks. */
function addCats(stage: Stage, set: ReturnType<typeof buildShop>): void {
  if (G.shopSize !== 'catcafe') return;
  const [x0, z0, x1, z1] = set.catArea;
  CAT_COATS.forEach(([a, b], i) => {
    const cat = new Cat(a, b);
    cat.root.position.set(x0 + 1 + i, 0, z0 + 0.5 + (i % 2));
    stage.add(cat.root);
    let goal: THREE.Vector3 | null = null;
    let rest = 1 + i * 1.5;
    stage.onUpdate((dt) => {
      cat.update(dt);
      if (!goal) {
        rest -= dt;
        if (rest <= 0) goal = new THREE.Vector3(x0 + Math.random() * (x1 - x0), 0, z0 + Math.random() * (z1 - z0));
        cat.walking = false;
        return;
      }
      const p = cat.root.position;
      const d = goal.distanceTo(p);
      if (d < 0.05) {
        goal = null;
        rest = 2 + Math.random() * 4;
        return;
      }
      cat.walking = true;
      cat.root.rotation.y = Math.atan2(goal.x - p.x, goal.z - p.z);
      p.addScaledVector(goal.clone().sub(p).normalize(), Math.min(d, dt * 0.8));
    });
    stage.click(cat.root, () => sfx('meow'));
  });
}
