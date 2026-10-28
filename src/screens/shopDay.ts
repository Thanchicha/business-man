import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, bubble, floatAt, Hud, modal, polite, stepChip, toast } from '../ui/components';
import { cupIcon } from './icons';
import { go } from '../game/flow';
import { CAST, customerSpec, type Expr } from '../game/specs';
import { G } from '../sim/GameState';
import { MENU } from '../data/menus';
import { ING } from '../data/ingredients';
import { STAFF_BY_ID } from '../data/staff';
import { planDay, planDelivery, type CustomerPlan, type DeliveryOrder } from '../sim/demand';
import { canMake, closeDay, consume, cupsPossible, emptyTally, missingFor, type DayTally } from '../sim/economy';
import { alternativeMenu, choicesFor, deliverySatisfaction, finalSatisfaction, intentFor, makeSeconds, priceOf, REP_LOST_CUSTOMER, repFromSatisfaction, resolve, reviewChance, starsFor, unitPrice, type Intent, type Outcome } from '../sim/service';
import { rng } from '../sim/rng';
import { Chibi, Cat, CAT_COATS } from '../three/models/character';
import { createCharacter, type Character } from '../three/models/miyu';
import { buildShop } from '../three/sets/interiors';
import { ScriptedCustomerBrain } from '../agents/ScriptedCustomerBrain';
import type { CustomerBrain, CustomerContext } from '../agents/CustomerBrain';
import { baht } from '../game/format';
import { sfx } from '../ui/sfx';
import * as P from '../three/models/props';
import { walkTo } from './common';
import { coopActive } from '../coop/session';

/** Real seconds that opening hours (10:00–20:00) last at 1x speed. */
const DAY_SEC = 150;

type State = 'entering' | 'queue' | 'toCounter' | 'ordering' | 'waiting' | 'seated' | 'leaving' | 'gone';

interface Actor {
  plan: CustomerPlan;
  chibi: Character;
  state: State;
  waited: number;
  grumbled: boolean;
  slot: number;
  dest: THREE.Vector3 | null;
  onArrive?: () => void;
  bubbleEl?: HTMLElement;
  ctx?: CustomerContext;
  outcome?: Outcome;
}

interface Job {
  /** The walk-in customer, or null for a delivery app order. */
  actor: Actor | null;
  delivery?: { order: DeliveryOrder; placedAt: number };
  menuId: string;
  cups: number;
  total: number;
  done: number;
}

export function shopDayScreen(stage: Stage): void {
  if (coopActive()) {
    setTimeout(() => go('coopDay'), 300);
    return;
  }
  const brain: CustomerBrain = new ScriptedCustomerBrain();
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

  const rnd = rng(G.day * 977 + (G.location?.length ?? 0) * 31 + G.menus.length);
  const { customers: plan, config } = planDay(G, rnd);
  const tally: DayTally = emptyTally(config.event?.title);
  const deliveries = planDelivery(G, rnd, config);
  let nextDelivery = 0;
  /** Seat index -> customer sitting there. */
  const taken = new Map<number, Actor>();
  const actors: Actor[] = [];
  const jobs: Job[] = [];
  let atCounter: Actor | null = null;
  let t = 0;
  let next = 0;
  let running = false;
  let closing = false;
  let finished = false;
  const tips = new Set<string>();

  // cats wander in the café corner
  if (G.shopSize === 'catcafe') {
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
      stage.click(cat.root, () => {
        sfx('meow');
        const s = e.project(cat.root.position.clone().setY(0.8));
        floatAt(s.x, s.y, '♥', 'var(--pink)');
      });
    });
  }

  // ---------- hired staff stand at their stations in the shop, turned toward the counter ----------
  const STAFF_SPOTS: Record<string, [number, number]> = { barista: [0.4, -4.9], server: [5.4, -2.4], helper: [-3.7, -5.2] };
  const staffChars = new Map<string, Character>();
  for (const id of G.staff) {
    const spot = STAFF_SPOTS[id];
    if (!spot) continue;
    const c = createCharacter(STAFF_BY_ID[id].spec);
    c.root.position.set(spot[0], 0, spot[1]);
    c.faceTo(0.3, 3.8);
    stage.add(c.root);
    stage.onUpdate((dt) => c.update(dt));
    staffChars.set(id, c);
  }

  // ---------- HUD ----------
  const hud = new Hud(`วันที่ ${G.day}`);
  hud.clock.style.display = '';
  const team = G.staff.map((s) => STAFF_BY_ID[s].name).join(', ');
  hud.extra.style.display = '';
  hud.extra.textContent = (team ? `ทีม: ${team}` : 'ทำคนเดียว') + (G.delivery.on ? ' • 📱 เดลิเวอรี่เปิด' : '');
  const speedBtn = btn('▶ x1', '', () => {
    stage.timeScale = stage.timeScale === 1 ? 2 : 1;
    speedBtn.textContent = stage.timeScale === 1 ? '▶ x1' : '▶▶ x2';
  }, 'small');
  mount(h('div', { class: 'row day-tools', style: { position: 'absolute', right: '20px', top: '76px' } }, btn('สต็อก', '', stockPopup, 'small'), speedBtn));
  stepChip('🐱', `วันที่ ${G.day} : ${G.day === 1 ? 'เปิดร้านวันแรก' : 'เปิดร้าน'}`, 'ยินดีต้อนรับลูกค้าทุกคนนะ! มาดูแลลูกค้าให้ดีที่สุดกัน!');
  const makeText = h('div', { style: { fontSize: '15px' } });
  const makeBar = h('i', { style: { width: '0%' } });
  const orderStrip = h('div', { class: 'row', style: { gap: '6px', minHeight: '64px' } });
  mount(h('div', { class: 'panel bottom-left order-panel', style: { width: '380px', padding: '12px 16px' } }, h('b', {}, '🧋 เมนูที่ลูกค้าสั่ง'), orderStrip, makeText, h('div', { class: 'bar', style: { marginTop: '6px' } }, makeBar)));
  const choiceList = h('div', 'choice-list');
  const choicePanel = mount(h('div', { class: 'panel choice-panel', style: { position: 'absolute', right: '20px', top: '130px', width: '300px', display: 'none' } }, h('h3', { style: { marginBottom: '10px' } }, 'จะตอบลูกค้าว่าไงดี?'), choiceList));
  const alert = mount(h('div', { class: 'top-center pill bad', style: { top: '80px', display: 'none' } }));
  const adv = new Advisor('bottom-right');
  adv.hide();
  const tip = (id: string, text: string, expr: Expr = 'think') => {
    if (tips.has(id) || G.day > 3) return;
    tips.add(id);
    adv.show();
    adv.say(text, expr);
    setTimeout(() => adv.hide(), 6500);
  };

  // ---------- day intro ----------
  const ev = config.event;
  const { close: closeIntro } = modal(
    [
      h('h2', { style: { textAlign: 'center' } }, G.day === 1 ? 'เปิดร้านวันแรก!' : `วันที่ ${G.day}`),
      h('p', { class: ev ? '' : 'muted', style: { textAlign: 'center', color: ev ? 'var(--pink-dark)' : undefined } }, ev ? `เหตุการณ์วันนี้: ${ev.title} — ${ev.desc}` : 'วันนี้อากาศดี ไม่มีเหตุการณ์พิเศษ'),
      h('p', {}, G.day === 1 ? 'ลูกค้าจะมาที่เคาน์เตอร์และบอกว่าอยากได้อะไร เลือกคำตอบให้ดีนะ ระหว่างชงลูกค้าคนต่อไปก็รอคิวอยู่ ถ้ารอนานเกินจะเดินออกไป (มิว)' : 'ลองนึกดูว่าเมื่อวานลูกค้าบอกอะไรเราบ้าง (มิว)'),
      h('div', { style: { textAlign: 'center' } }, btn('เปิดร้าน!', 'pink', () => {
        closeIntro();
        running = true;
        sfx('done');
      }, 'big')),
    ],
    { width: '560px' },
  );

  // ---------- helpers ----------
  const ctxFor = (a: Actor, intent: Intent = 'order'): CustomerContext => {
    const alt = alternativeMenu(G, a.plan);
    return { plan: a.plan, intent, menuName: MENU[a.plan.menuId].short, price: Math.round(unitPrice(G, a.plan)), altName: alt ? MENU[alt].short : undefined, waitedFrac: a.waited / a.plan.patience, catCafe: G.shopSize === 'catcafe' };
  };
  const say = (a: Actor, text: string, ms = 2600, cls = '') => {
    if (a.bubbleEl) stage.unlabel(a.bubbleEl);
    const el = stage.label(a.chibi.root, bubble(text, `${cls} ${a === atCounter ? 'big' : ''}`), 1.75);
    a.bubbleEl = el;
    if (ms > 0) setTimeout(() => el.isConnected && stage.unlabel(el), ms / stage.timeScale);
  };
  const moveTo = (a: Actor, p: THREE.Vector3, then?: () => void) => {
    a.dest = p.clone();
    a.onArrive = then;
  };
  const spawn = (p: CustomerPlan) => {
    const spec = p.regular ? CAST[p.regular] : customerSpec(p.seed, p.segment, G.location ?? undefined);
    const c = createCharacter(spec);
    c.root.position.copy(set.door);
    stage.add(c.root);
    const a: Actor = { plan: p, chibi: c, state: 'entering', waited: 0, grumbled: false, slot: -1, dest: null };
    actors.push(a);
    tally.visitors++;
    say(a, `${p.dineIn ? '🪑 นั่งทานที่ร้าน' : '🛍️ กลับบ้าน'}${p.coupon ? ' • 🎟️ มีคูปอง' : ''}`, 1600);
    sfx('step');
  };
  const leave = (a: Actor) => {
    a.state = 'leaving';
    if (a.bubbleEl) setTimeout(() => a.bubbleEl?.isConnected && stage.unlabel(a.bubbleEl), 1200);
    moveTo(a, set.door, () => {
      a.state = 'gone';
      a.chibi.root.removeFromParent();
    });
  };
  const leaveAngry = (a: Actor) => {
    tally.lost++;
    tally.feedback.leftAngry++;
    tally.repDelta += REP_LOST_CUSTOMER;
    a.chibi.setExpr('annoyed');
    say(a, brain.leaveAngry(ctxFor(a)), 1500, 'angry');
    if (rnd() < 0.4) review(a.chibi.root.position, 1);
    sfx('bad');
    a.state = 'leaving';
    setTimeout(() => leave(a), 600);
  };

  async function takeOrder(a: Actor) {
    a.state = 'ordering';
    a.chibi.faceTo(set.camera.pos.x, set.camera.pos.z);
    const intent = intentFor(G, a.plan, a.waited / a.plan.patience);
    a.ctx = ctxFor(a, intent);
    const line = await brain.opening(a.ctx);
    a.chibi.setExpr(line.expr);
    say(a, line.text, 0);
    sfx('pop');
    if (intent === 'outOfStock') {
      const miss = missingFor(G.inventory, a.plan.menuId, a.plan.cups);
      alert.textContent = `⚠ วัตถุดิบหมด: ${miss ? ING[miss].name : MENU[a.plan.menuId].short}`;
      alert.style.display = '';
      tip('stock', 'วัตถุดิบหมดแล้ว พรุ่งนี้ตอนไปซื้อของ ลองดูว่าอะไรขายดีแล้วซื้อเพิ่มนะ', 'surprised');
    }
    if (intent === 'expensive') tip('price', 'ลูกค้าบอกว่าแพง จะลดราคาก็ได้แต่กำไรจะลดลง ลองดูในสรุปท้ายวันว่ามีคนบ่นกี่คน');
    if (intent === 'request') tip('request', 'ลูกค้าขอเมนูใหม่ ไอเดียจากลูกค้าเป็นข้อมูลที่ดีมาก จดไว้แล้วลองเพิ่มเมนูทีหลังได้นะ', 'happy');
    choiceList.replaceChildren(...choicesFor(intent, polite()).map((o, i) => btn(`${['💗', '💬', '🍹'][i] ?? '•'}  ${o.label}`, i === 0 ? 'pink' : '', () => choose(a, intent, o.id))));
    choicePanel.style.display = '';
  }

  async function choose(a: Actor, intent: Intent, choiceId: string) {
    choiceList.replaceChildren();
    choicePanel.style.display = 'none';
    alert.style.display = 'none';
    const o = resolve(G, a.plan, intent, choiceId, rnd());
    a.outcome = o;
    const reply = await brain.react({ ...a.ctx!, altName: MENU[o.menuId].short }, choiceId, o);
    a.chibi.setExpr(reply.expr);
    if (reply.expr === 'happy') a.chibi.hop(stage);
    say(a, reply.text, 1800);
    if (o.feedback) tally.feedback[o.feedback]++;
    if (o.idea) tally.requests[o.idea] = (tally.requests[o.idea] ?? 0) + 1;
    if (o.idea && choiceId === 'note') G.ideas[o.idea] = (G.ideas[o.idea] ?? 0) + 1;
    if (o.buys && canMake(G.inventory, o.menuId, o.cups)) {
      const paid = o.priceEach * o.cups;
      tally.revenue += paid;
      tally.cogs += consume(G.inventory, o.menuId, o.cups) + o.extraCost;
      tally.cupsSold += o.cups;
      tally.sales[o.menuId] = (tally.sales[o.menuId] ?? 0) + o.cups;
      const s = e.project(new THREE.Vector3(-2.6, 1.6, 3.8));
      floatAt(s.x, s.y, `+${baht(paid)}`);
      sfx('coin');
      jobs.push({ actor: a, menuId: o.menuId, cups: o.cups, total: makeSeconds(G, o.menuId, o.cups, o.extraMakeTime), done: 0 });
      await stage.wait(900);
      a.state = 'waiting';
      atCounter = null;
      const used = new Set(actors.filter((x) => x.state === 'waiting' && x !== a).map((x) => x.slot));
      a.slot = [0, 1, 2].find((s) => !used.has(s)) ?? 2;
      moveTo(a, set.pickup[a.slot], () => a.chibi.faceTo(set.camera.pos.x, set.camera.pos.z));
    } else {
      tally.lost++;
      tally.repDelta += REP_LOST_CUSTOMER / 2;
      sfx('bad');
      await stage.wait(1000);
      atCounter = null;
      leave(a);
    }
  }

  /** Records a review and shows its stars over the customer. */
  function review(at: THREE.Vector3, stars: number) {
    tally.reviews.push(stars);
    const s = e.project(at.clone().setY(2.6));
    floatAt(s.x, s.y, '★'.repeat(stars) + '☆'.repeat(5 - stars), stars >= 4 ? '#ffb340' : 'var(--red)');
    if (stars === 5 && G.promos.coupon.on) {
      tally.couponsGiven++;
      setTimeout(() => floatAt(s.x, s.y + 30, '🎟️ ได้คูปองรอบหน้า', 'var(--pink)'), 400);
    }
  }

  function freeSeat(): number {
    for (let i = 0; i < set.seats.length; i++) if (!taken.has(i)) return i;
    return -1;
  }

  /** An order arrives in the delivery app: accept it if the stock allows. */
  function takeDelivery(order: DeliveryOrder) {
    if (!canMake(G.inventory, order.menuId, order.cups)) {
      tally.deliveryCancelled++;
      tally.repDelta -= 0.02;
      if (rnd() < 0.5) tally.reviews.push(1);
      toast(`📱 ยกเลิกออเดอร์ ${MENU[order.menuId].short} — วัตถุดิบหมด`, 'bad');
      sfx('bad');
      return;
    }
    const gross = (G.delivery.prices[order.menuId] ?? priceOf(G, order.menuId) + 10) * order.cups;
    tally.revenue += gross;
    tally.deliverySales += gross;
    tally.deliveryOrders++;
    tally.cogs += consume(G.inventory, order.menuId, order.cups);
    tally.cupsSold += order.cups;
    tally.sales[order.menuId] = (tally.sales[order.menuId] ?? 0) + order.cups;
    jobs.push({ actor: null, delivery: { order, placedAt: t }, menuId: order.menuId, cups: order.cups, total: makeSeconds(G, order.menuId, order.cups), done: 0 });
    toast(`📱 ออเดอร์เดลิเวอรี่: ${MENU[order.menuId].short} ×${order.cups} (${baht(gross)} แอปหัก 32.1%)`);
    sfx('pop');
    tip('delivery', 'มีออเดอร์จากแอปแล้ว แอปหัก GP 30% บวก VAT รวม 32.1% ตั้งราคาในแอปให้ยังมีกำไรด้วยนะ และต้องชงแทรกคิวลูกค้าหน้าร้าน', 'think');
  }

  function finishDelivery(job: Job) {
    const d = job.delivery!;
    const sat = deliverySatisfaction(G, d.order.menuId, t - d.placedAt);
    tally.repDelta += repFromSatisfaction(sat) * 0.6;
    sfx('done');
    // a rider pops in to collect the drink
    const rider = createCharacter(CAST.extra_rider);
    rider.root.position.copy(set.door);
    stage.add(rider.root);
    const off = stage.onUpdate((dt) => rider.update(dt));
    const cup = P.bubbleTea(MENU[d.order.menuId].color, !!MENU[d.order.menuId].topping, MENU[d.order.menuId].layer);
    cup.scale.setScalar(1.3);
    cup.position.set(0, 1.25, 0.35);
    void walkTo(stage, rider, set.pickup[2].x, set.pickup[2].z, 3.2).then(async () => {
      rider.root.add(cup);
      const s = e.project(rider.root.position.clone().setY(2.2));
      floatAt(s.x, s.y, '📱 ไรเดอร์รับของแล้ว', 'var(--green)');
      if (rnd() < reviewChance(G, sat) * 0.7) review(rider.root.position, starsFor(sat));
      await walkTo(stage, rider, set.door.x, set.door.z, 3.2);
      rider.root.removeFromParent();
      off();
    });
  }

  function finishJob(job: Job) {
    if (!job.actor) return finishDelivery(job);
    const a = job.actor;
    const o = a.outcome!;
    const frac = a.waited / a.plan.patience;
    const seat = a.plan.dineIn ? freeSeat() : -1;
    const noSeat = a.plan.dineIn && seat < 0;
    if (noSeat) tally.feedback.noSeat++;
    const sat = Math.max(0, finalSatisfaction(G, a.plan, o, frac) - (noSeat ? 0.08 : 0));
    if (seat >= 0) {
      tally.dineIn++;
      taken.set(seat, a);
    } else tally.takeaway++;
    tally.served++;
    tally.repDelta += repFromSatisfaction(sat);
    if (sat >= 0.85) tally.feedback.compliment++;
    if (frac > 0.8) tally.feedback.slow++;
    const cup = P.bubbleTea(MENU[job.menuId].color, !!MENU[job.menuId].topping, MENU[job.menuId].layer);
    cup.scale.setScalar(1.3);
    cup.position.set(0, 1.25, 0.35);
    a.chibi.root.add(cup);
    staffChars.get('barista')?.hop(stage);
    sfx('done');
    brain.pickup({ ...a.ctx!, waitedFrac: frac }, sat).then((r) => {
      a.chibi.setExpr(r.expr);
      if (sat >= 0.8) a.chibi.hop(stage);
      say(a, noSeat ? 'ที่นั่งเต็มเลย... งั้นขอกลับบ้านละกัน' : r.text, 1600);
      if (sat >= 0.85) {
        const s = e.project(a.chibi.root.position.clone().setY(2.3));
        floatAt(s.x, s.y, '♥', 'var(--pink)');
      }
      if (rnd() < reviewChance(G, sat)) setTimeout(() => review(a.chibi.root.position, starsFor(sat)), 900 / stage.timeScale);
      if (seat < 0) return void setTimeout(() => leave(a), 1300 / stage.timeScale);
      // sit down to drink, then go
      setTimeout(() => {
        a.state = 'seated';
        moveTo(a, set.seats[seat].pos, () => {
          a.chibi.sitting = true;
          a.chibi.root.position.y = 0.16;
          a.chibi.root.rotation.y = set.seats[seat].rot;
          void stage.wait(9000 + rnd() * 7000).then(() => {
            a.chibi.sitting = false;
            a.chibi.root.position.y = 0;
            taken.delete(seat);
            leave(a);
          });
        });
      }, 1100 / stage.timeScale);
    });
  }

  function close() {
    closing = true;
    next = plan.length;
    for (const a of actors) {
      if (a.state === 'queue' || a.state === 'entering') {
        tally.lost++;
        tally.feedback.closed++;
        say(a, brain.closed(ctxFor(a)), 1200);
        a.state = 'leaving';
        setTimeout(() => leave(a), 700);
      }
    }
  }

  function stockPopup() {
    const { close: c } = modal([h('h2', {}, 'ของที่เหลือ (ทำได้กี่แก้ว)'), ...G.menus.map((id) => h('div', { style: { fontSize: '18px' } }, `${MENU[id].short}: ${cupsPossible(G.inventory, id)} แก้ว`)), btn('ปิด', 'pink', () => c())], { width: '420px' });
  }

  // ---------- main loop ----------
  stage.onUpdate((dt) => {
    if (!running || finished) return;
    if (!closing) {
      t += dt;
      if (t >= DAY_SEC) close();
    }
    const minutes = Math.min(600, (t / DAY_SEC) * 600);
    hud.clock.textContent = `☀ ${10 + Math.floor(minutes / 60)}:${String(Math.floor((minutes % 60) / 10) * 10).padStart(2, '0')}${closing ? ' ปิดร้าน' : ''}`;
    while (!closing && next < plan.length && plan[next].arriveAt * DAY_SEC <= t) spawn(plan[next++]);
    while (!closing && nextDelivery < deliveries.length && deliveries[nextDelivery].arriveAt * DAY_SEC <= t) takeDelivery(deliveries[nextDelivery++]);

    for (const a of actors) {
      if (a.state === 'gone') continue;
      a.chibi.update(dt);
      // walking
      if (a.dest) {
        const p = a.chibi.root.position;
        const d = a.dest.distanceTo(p);
        if (d < 0.05) {
          p.copy(a.dest);
          a.dest = null;
          a.chibi.walking = false;
          const f = a.onArrive;
          a.onArrive = undefined;
          f?.();
        } else {
          a.chibi.walking = true;
          a.chibi.root.rotation.y = Math.atan2(a.dest.x - p.x, a.dest.z - p.z);
          p.addScaledVector(a.dest.clone().sub(p).normalize(), Math.min(d, dt * 2.6));
        }
      }
      // patience
      if (a.state === 'queue' || a.state === 'entering' || a.state === 'toCounter') a.waited += dt;
      else if (a.state === 'ordering') a.waited += dt * 0.4;
      else if (a.state === 'waiting') a.waited += dt * 0.7;
      const frac = a.waited / a.plan.patience;
      if ((a.state === 'queue' || a.state === 'entering') && frac > 0.55 && !a.grumbled) {
        a.grumbled = true;
        a.chibi.setExpr('annoyed');
        say(a, brain.grumble(ctxFor(a)), 1800);
        tip('queue', 'ลูกค้าในคิวเริ่มรอนานแล้ว ถ้าชงไม่ทัน ลองคิดเรื่องจ้างคนช่วย หรือลดเมนูที่ชงนานดูนะ');
      }
      if ((a.state === 'queue' || a.state === 'entering') && frac > 1) leaveAngry(a);
    }

    // queue management
    const queue = actors.filter((a) => a.state === 'queue' || a.state === 'entering');
    if (!atCounter && queue.length && queue[0].state === 'queue') {
      const a = queue.shift()!;
      atCounter = a;
      a.state = 'toCounter';
      a.slot = -1;
      moveTo(a, set.order, () => takeOrder(a));
    }
    queue.forEach((a, i) => {
      const slot = Math.min(i, set.queue.length - 1);
      if (a.slot !== slot) {
        a.slot = slot;
        moveTo(a, set.queue[slot], () => {
          if (a.state === 'entering') a.state = 'queue';
          a.chibi.faceTo(set.order.x, set.order.z);
        });
      }
    });

    // drink making
    const job = jobs[0];
    if (job) {
      job.done += dt;
      if (job.done >= job.total) {
        jobs.shift();
        finishJob(job);
      }
    }
    const sig = jobs.map((j) => j.menuId + j.cups).join();
    if (sig !== orderStrip.dataset.sig) {
      orderStrip.dataset.sig = sig;
      orderStrip.replaceChildren(...(jobs.length ? jobs.slice(0, 6).map((j) => h('div', { style: { textAlign: 'center', fontSize: '11px' } }, cupIcon(j.menuId, 44), `${j.delivery ? '📱' : ''}×${j.cups}`)) : [h('div', 'muted', 'ยังไม่มีออเดอร์')]));
    }
    makeText.textContent = job ? `กำลังชง${job.delivery ? ' (เดลิเวอรี่)' : ''}: ${MENU[job.menuId].short} ×${job.cups}${jobs.length > 1 ? ` • รอชงอีก ${jobs.length - 1}` : ''}` : closing ? 'ปิดร้านแล้ว เก็บกวาด~' : 'ว่าง • รอลูกค้า';
    makeBar.style.width = job ? `${Math.min(100, (job.done / job.total) * 100)}%` : '0%';
    hud.refresh(G.cash + tally.revenue, G.reputation + tally.repDelta);

    if (closing && !atCounter && !jobs.length && actors.every((a) => a.state === 'leaving' || a.state === 'gone')) {
      finished = true;
      const log = closeDay(G, tally);
      setTimeout(() => go('summary', { log }), 900);
    }
  });
}
