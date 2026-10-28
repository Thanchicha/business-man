import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, stepChip, toast, playerName } from '../ui/components';
import { go } from '../game/flow';
import { G, saveGame } from '../sim/GameState';
import { STAFF, dailyWage } from '../data/staff';
import { LOCATIONS, LOCATION, dailyRent, marketPrice, type Location } from '../data/locations';
import { STRATEGIES, type StrategyId } from '../data/strategies';
import { SHOP_SIZES } from '../data/shopSizes';
import { MENU } from '../data/menus';
import { averagePrice } from '../sim/demand';
import { baht } from '../game/format';
import { islandBackdrop } from './common';
import { portrait } from '../three/portrait';
import { CAST } from '../game/specs';
import { priceModal } from './pricing';
import { openNotebook } from './research';

/** Step 4: hire staff or run the shop alone. */
export function hireScreen(stage: Stage): void {
  islandBackdrop(stage);
  stepChip(6, 'จ้างพนักงาน หรือ ทำเอง?', 'ค่าจ้างคือ "ต้นทุนคงที่" ต้องจ่ายทุกวัน ขายได้หรือไม่ก็ตาม');
  const adv = new Advisor('bottom-right');
  adv.say(`ทำคนเดียวประหยัดที่สุด แต่ถ้าลูกค้าเยอะ ${playerName()} อาจชงไม่ทัน ลูกค้ารอนานก็จะเดินออกไปนะ ลองชั่งใจดู`, 'think');
  const hired = new Set(G.staff);
  const row = mount(h('div', { class: 'row content', style: { position: 'absolute', left: '20px', top: '130px', alignItems: 'stretch' } }));
  const total = h('div', { style: { fontSize: '19px', fontWeight: 500 } });
  const cards: [string, HTMLElement][] = [];
  const refresh = () => {
    for (const [id, c] of cards) c.classList.toggle('sel', id === 'solo' ? hired.size === 0 : hired.has(id));
    const daily = STAFF.filter((s) => hired.has(s.id)).reduce((t, s) => t + dailyWage(s), 0);
    total.textContent = `ค่าจ้างรวม ${baht(daily)}/วัน (${baht(daily * 30)}/เดือน)`;
  };
  const card = (id: string, img: string, name: string, role: string, perk: string, cost: string, tags: [string, boolean][]) => {
    const c = h(
      'div',
      { class: 'card col', style: { width: '200px', textAlign: 'center', alignItems: 'center', gap: '6px' } },
      h('div', 'check', '✓'),
      h('img', { src: img, width: 140, style: { borderRadius: '16px', background: '#fff0f6' } }),
      h('h3', {}, name),
      h('div', { style: { color: 'var(--pink-dark)', fontSize: '15px' } }, role),
      h('span', 'pill', '🪙 ', cost),
      h('div', 'pillset', ...tags.map(([t, good]) => h('span', good ? '' : 'neg', t))),
      h('div', { class: 'muted', style: { fontSize: '15px', minHeight: '40px' } }, perk),
    );
    c.addEventListener('click', () => {
      if (id === 'solo') hired.clear();
      else if (hired.has(id)) hired.delete(id);
      else hired.add(id);
      refresh();
    });
    cards.push([id, c]);
    row.append(c);
  };
  const TAGS: Record<string, [string, boolean][]> = {
    barista: [['ชงเร็ว', true], ['ค่าแรงสูง', false]],
    server: [['บริการดี', true], ['ลูกค้าใจเย็น', true]],
    helper: [['ร้านสะอาด', true], ['ช่วยทั่วไป', true]],
  };
  for (const s of STAFF) card(s.id, portrait(`staff_${s.id}`, s.spec, 'happy'), s.name, s.role, s.perk, `วันละ ${baht(dailyWage(s))}`, TAGS[s.id] ?? []);
  card('solo', portrait(G.playerKey, CAST[G.playerKey], 'think'), 'หรือ... ทำเองคนเดียว', 'เจ้าของร้าน', 'ร้านเล็กๆ อาจจะทำเองก่อนก็ได้ แต่ถ้าลูกค้าเยอะขึ้น การมีพนักงานจะช่วยได้มาก', 'วันละ ฿0', [['ประหยัด', true], ['ชงช้า', false]]);
  mount(h('div', { class: 'panel row dock', style: { position: 'absolute', left: '20px', bottom: '20px' } }, total, btn('✓ เลือกแล้ว', 'pink', () => {
    G.staff = [...hired];
    go('strategy');
  }, 'big')));
  refresh();
}

/** Step 5: pick one of five lots on the 3D town. */
export function townMapScreen(stage: Stage): void {
  const town = islandBackdrop(stage, { orbit: false });
  const e = stage.engine;
  e.camera.position.set(0, 30, 28);
  e.look(0, 0, 0);
  stepChip(3, 'เลือกทำเลที่จะไปสำรวจ', `คลิกป้ายทำเล • เวลาเตรียมร้านเหลือ ${G.research.hours} ชม. • แรง ${G.research.energy}/100`);
  const adv = new Advisor('bottom-left');
  adv.say('ทำเลดีคนเยอะ แต่ค่าเช่าแพงและมีคู่แข่ง ทำเลถูกคนก็น้อย เลือกทำเลที่สนใจ แล้วลงไปสำรวจก่อนตัดสินใจนะ', 'think');
  const info = mount(h('div', { class: 'panel content', style: { position: 'absolute', right: '20px', top: '90px', width: '380px', display: 'none' } }));
  const pins: HTMLElement[] = [];
  let orbit = 0;
  let focus = new THREE.Vector3(0, 0, -5);
  stage.onUpdate((dt) => {
    orbit += dt * 0.04;
    const r = e.camera.aspect < 1 ? 42 : 34;
    e.camera.position.lerp(new THREE.Vector3(focus.x + Math.sin(orbit) * r * 0.45, 30, focus.z + r * 0.95), 0.04);
    e.lookAt.lerp(focus, 0.06);
    e.camera.lookAt(e.lookAt);
  });
  LOCATIONS.forEach((l, i) => {
    const rent = Math.round(dailyRent(l) * SHOP_SIZES[G.shopSize].rentMult);
    const pin = stage.label(
      town.lotObjects[l.id],
      h(
        'div',
        'lotcard',
        h('b', {}, `📍 ${l.name}`),
        h('div', 'muted', l.area),
        h('div', {}, `ค่าเช่า ${baht(rent)}/วัน`),
        h('div', { class: l.competitors.length ? 'bad' : 'good' }, l.competitors.length ? `♥ มีคู่แข่ง ${l.competitors.length} ร้าน` : '✓ ไม่มีคู่แข่ง'),
      ),
      2.4,
    );
    pin.addEventListener('click', () => show(l, pin));
    stage.click(town.lotObjects[l.id], () => show(l, pin));
    pins.push(pin);
  });
  for (const lm of town.landmarks) stage.label(lm.obj, h('div', 'tag3d', lm.name), lm.h);

  function show(l: Location, pin: HTMLElement) {
    pins.forEach((p) => p.classList.remove('sel'));
    pin.classList.add('sel');
    focus = town.lots[l.id].clone();
    town.highlight(l.id);
    const rent = Math.round(dailyRent(l) * SHOP_SIZES[G.shopSize].rentMult);
    const done = G.research.done[l.id]?.length ?? 0;
    info.style.display = '';
    // who the customers are is not shown here: the player has to go and find out
    info.replaceChildren(
      h('h2', {}, `${l.name} • ${l.area}`),
      h('div', {}, `ค่าเช่า ${baht(l.monthlyRent * SHOP_SIZES[G.shopSize].rentMult)}/เดือน (~${baht(rent)}/วัน)`),
      h('b', { class: l.competitors.length ? 'bad' : 'good' }, l.competitors.length ? `เห็นร้านชานม ${l.competitors.length} ร้าน` : 'ไม่เห็นร้านชานมแถวนี้'),
      h('p', { style: { color: 'var(--pink-dark)' } }, `ข่าวลือ: "${l.hint}"`),
      h('div', done ? 'good' : 'muted', done ? `📒 สำรวจแล้ว ${done} วิธี` : 'ยังไม่รู้ว่าลูกค้าแถวนี้เป็นใคร ชอบอะไร จ่ายได้เท่าไหร่'),
      h('div', 'row', btn(done ? '🔍 กลับไปสำรวจต่อ' : '🔍 ไปสำรวจทำเลนี้', 'pink', () => go('research', { loc: l.id }), 'big'), done ? btn('📒 สมุดสำรวจ', '', openNotebook, 'small') : null),
    );
    adv.say(`ค่าเช่า ${baht(rent)}/วัน ส่วนลูกค้าแถวนี้เป็นใคร ชอบอะไร ต้องลงไปสำรวจเองนะ เวลาเตรียมร้านเหลือ ${G.research.hours} ชม.`, 'think');
  }
}

/** Step 6: study the competition, pick how to compete, then set prices. */
export function strategyScreen(stage: Stage): void {
  const town = islandBackdrop(stage, { orbit: false });
  const loc = LOCATION[G.location!];
  const lot = town.lots[loc.id];
  let a = 0;
  stage.onUpdate((dt) => {
    a += dt * 0.08;
    stage.engine.camera.position.set(lot.x + Math.sin(a) * 9, 7, lot.z + Math.cos(a) * 9);
    stage.engine.look(lot.x, 0.8, lot.z);
  });
  stepChip(7, 'วางกลยุทธ์สู้คู่แข่ง', `${loc.area} • ราคาเฉลี่ยแถวนี้ ${baht(marketPrice(loc))}`);
  const adv = new Advisor('bottom-left');
  adv.say(
    loc.competitors.length
      ? 'ดูจุดแข็งจุดอ่อนของคู่แข่งก่อน แล้วเลือกว่าเราจะต่างจากเขาตรงไหน ไม่จำเป็นต้องสู้ด้วยราคาเสมอไปนะ'
      : 'ไม่มีคู่แข่งก็ดี แต่ร้านเราก็ต้องมีจุดเด่นให้คนอยากแวะมานะ',
    'think',
  );
  mount(h('div', { class: 'top-right', style: { top: '76px' } }, btn('📒 สมุดสำรวจ', 'gold', openNotebook, 'small')));
  const comp = mount(h('div', { class: 'row content', style: { position: 'absolute', left: '20px', top: '126px', alignItems: 'stretch' } }));
  if (!loc.competitors.length) comp.append(h('div', 'panel good', h('h3', {}, 'ไม่มีร้านชานมคู่แข่งในละแวกนี้')));
  for (const c of loc.competitors) {
    comp.append(h('div', { class: 'panel', style: { width: '340px', borderTop: `8px solid ${c.color}` } }, h('h3', {}, `🧋 ${c.name}`), h('div', 'muted', `เฉลี่ย ${baht(c.avgPrice)} • ★${c.rating} • ขายดี: ${c.famous}`), h('div', 'good', `จุดแข็ง: ${c.strength}`), h('div', 'bad', `จุดอ่อน: ${c.weakness}`)));
  }
  const strats = mount(h('div', { class: 'row content', style: { position: 'absolute', left: '20px', bottom: '124px', alignItems: 'stretch' } }));
  let picked = false;
  for (const s of STRATEGIES) {
    const c = h('div', { class: 'card col', style: { width: '262px', gap: '6px' } }, h('div', { style: { fontSize: '34px', color: 'var(--pink-dark)', textAlign: 'center' } }, s.icon), h('h3', { style: { textAlign: 'center' } }, s.name), h('div', { class: 'muted', style: { fontSize: '15px', textAlign: 'center' } }, s.desc), h('div', { class: 'good', style: { fontSize: '15px' } }, `+ ${s.pros}`), h('div', { class: 'bad', style: { fontSize: '15px' } }, `− ${s.cons}`), h('b', { style: { textAlign: 'center', color: 'var(--pink-dark)' } }, s.setupCost ? `ลงทุน ${baht(s.setupCost)}` : 'ไม่มีค่าใช้จ่าย'));
    c.addEventListener('click', () => {
      if (picked) return;
      picked = true;
      c.classList.add('sel');
      pick(s.id);
    });
    strats.append(c);
  }

  function pick(id: StrategyId) {
    const s = STRATEGIES.find((x) => x.id === id)!;
    G.strategy = id;
    G.cash -= s.setupCost;
    G.pendingSetup += s.setupCost;
    if (id === 'price') for (const m of G.menus) G.prices[m] = Math.max(25, Math.min(G.prices[m], Math.round(marketPrice(loc) * 0.9)));
    if (id === 'creative' && !G.menus.includes('signature')) {
      G.menus.push('signature');
      G.prices.signature = MENU.signature.basePrice;
    }
    if (s.setupCost) toast(`ลงทุน ${baht(s.setupCost)} • เหลือเงิน ${baht(G.cash)}`);
    const note =
      id === 'price'
        ? `ตั้งราคาให้ต่ำกว่าแถวนี้ (${baht(marketPrice(loc))}) เล็กน้อยแล้ว แต่ระวังกำไรต่อแก้วจะบางเกินไปนะ`
        : id === 'creative'
          ? 'เมนูซิกเนเจอร์ปลดล็อกแล้ว! ใช้ชาไทย นมข้นจืด บราวน์ชูการ์ และไข่มุก ถ้ายังไม่ได้ซื้อ พรุ่งนี้ซื้อเพิ่มนะ'
          : `ราคาเฉลี่ยแถวนี้ ${baht(marketPrice(loc))} ของเราตอนนี้เฉลี่ย ${baht(averagePrice(G))}`;
    priceModal(note, () => {
      G.checkpoint = 'morning';
      saveGame();
      // the kiosk has no seats to furnish
      go(G.shopSize === 'catcafe' ? 'furnitureStore' : 'shopDay');
    });
  }
}
