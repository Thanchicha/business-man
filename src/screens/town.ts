import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, DialogBox, Hud, modal, stepChip, toast } from '../ui/components';
import { go } from '../game/flow';
import { CAST } from '../game/specs';
import { G, saveGame } from '../sim/GameState';
import { LOCATIONS } from '../data/locations';
import { MENU } from '../data/menus';
import { ING } from '../data/ingredients';
import { clearanceMenus, cupsPossible, expiringOn, isRentDay, LATE_FEE, LOAN_LIMIT, LOAN_RATE_DAY, LOAN_RATE_YEAR, nextRentMorning, ratingAll, rentPerDay, TAX_RATE, wagesPerDay } from '../sim/economy';
import { openingActive } from '../sim/pricing';
import { buildStreet } from '../three/sets/street';
import * as P from '../three/models/props';
import { mat, mesh, signPlane } from '../three/models/mat';
import { createCharacter } from '../three/models/miyu';
import { addChibi, islandBackdrop, walkTo } from './common';
import { priceModal } from './pricing';
import { baht } from '../game/format';
import { sfx } from '../ui/sfx';
import { coopActive } from '../coop/session';
import { openLobby } from './coopLobby';

const LANDLORD = CAST.extra_landlord;
const TELLER = CAST.extra_teller;

/** Money the player owes and when, for side panels. */
function moneyRows(): HTMLElement {
  const row = (k: string, v: string, cls = '') => h('tr', {}, h('td', 'muted', k), h('td', { class: cls }, v));
  return h(
    'table',
    'ledger',
    row('เงินสด', baht(G.cash), G.cash < 0 ? 'bad' : ''),
    row('ค่าเช่าค้างจ่าย', baht(G.rentDue), G.rentDue ? 'bad' : ''),
    row('เจ้าของที่มาเก็บ', `เช้าวันที่ ${isRentDay(G) ? G.day : nextRentMorning(G.landlordDay === G.day || G.day === 1 ? G.day : G.day - 1)}`),
    row('เงินมัดจำค่าเช่า (ได้คืน)', baht(G.deposit)),
    row('หนี้ธนาคาร', baht(G.loan), G.loan ? 'bad' : ''),
    row('ภาษีรอจ่าย', baht(G.taxDue), G.taxDue ? 'bad' : ''),
    row('คะแนนรีวิวสะสม', G.reviews.count ? `${ratingAll(G).toFixed(2)} ★ (${G.reviews.count} รีวิว)` : 'ยังไม่มี'),
  );
}

// ---------------------------------------------------------------- the town map hub

type Place = 'shop' | 'market' | 'furniture' | 'bank';

/** Each morning: pick where to go before opening the shop. */
export function mapScreen(stage: Stage): void {
  // with friends in the room the morning is planned together
  if (coopActive()) {
    islandBackdrop(stage);
    setTimeout(() => go('coopMorning'), 300);
    return;
  }
  // the landlord turns up first on rent day
  if (isRentDay(G)) {
    islandBackdrop(stage);
    setTimeout(() => go('landlord'), 300);
    return;
  }
  G.checkpoint = 'morning';
  saveGame();
  const town = islandBackdrop(stage, { orbit: false });
  const e = stage.engine;
  const home = G.location ?? LOCATIONS[0].id;
  const others = LOCATIONS.filter((l) => l.id !== home);
  const mall = town.landmarks.find((l) => l.name === 'ห้างสรรพสินค้า');
  const office = town.landmarks.find((l) => l.name === 'ย่านออฟฟิศ');
  const spots: Record<Place, { obj: THREE.Object3D; label: string; icon: string; h: number }> = {
    shop: { obj: town.lotObjects[home], label: 'ร้านของเรา', icon: '🧋', h: 2.6 },
    market: { obj: mall?.obj ?? town.lotObjects[others[0].id], label: 'ร้านขายวัตถุดิบ', icon: '🛒', h: (mall?.h ?? 2.4) + 0.4 },
    furniture: { obj: town.lotObjects[others[1].id], label: 'ร้านเฟอร์นิเจอร์', icon: '🛋️', h: 2.6 },
    bank: { obj: office?.obj ?? town.lotObjects[others[2].id], label: 'ธนาคาร', icon: '🏦', h: office ? 6 : 2.6 },
  };
  let focus = town.lots[home].clone();
  let orbit = 0;
  stage.onUpdate((dt) => {
    orbit += dt * 0.03;
    const r = e.camera.aspect < 1 ? 44 : 36;
    e.camera.position.lerp(new THREE.Vector3(focus.x + Math.sin(orbit) * r * 0.4, 30, focus.z + r * 0.95), 0.04);
    e.lookAt.lerp(focus, 0.06);
    e.camera.lookAt(e.lookAt);
  });
  town.highlight(home);

  new Hud(`เช้าวันที่ ${G.day}`);
  stepChip('🗺️', `เช้าวันที่ ${G.day} • จะไปที่ไหนดี?`, 'คลิกป้ายบนแผนที่ แวะได้หลายที่ก่อนเปิดร้าน');
  const adv = new Advisor('bottom-left');
  const empty = G.menus.filter((id) => cupsPossible(G.inventory, id) === 0);
  adv.say(
    empty.length
      ? `เช้านี้ ${empty.map((id) => MENU[id].short).join(', ')} ไม่มีวัตถุดิบเลย แวะร้านขายวัตถุดิบก่อนเปิดร้านนะ`
      : G.rentDue > G.cash
        ? `ค่าเช่าค้างอยู่ ${baht(G.rentDue)} แต่เงินสดมี ${baht(G.cash)} เก็บเงินไว้ให้พอก่อนเจ้าของที่มาเก็บนะ`
        : 'วัตถุดิบยังพอขาย จะเติมของ ซื้อเฟอร์นิเจอร์ หรือไปธนาคารก่อนก็ได้ พร้อมแล้วก็กลับไปเปิดร้านกัน',
    empty.length ? 'surprised' : 'happy',
  );

  const soon = Object.entries(expiringOn(G.inventory, G.day)).filter(([ing]) => ing !== 'ice');
  if (soon.length)
    setTimeout(
      () =>
        adv.say(
          `ระวัง! ${soon.map(([ing, n]) => `${ING[ing].name} ~${n} แก้ว`).join(', ')} จะเสียคืนนี้ ถ้าขายไม่หมดต้องทิ้ง ลองเปิดโปร "โละของใกล้เสีย" ลดราคา ${clearanceMenus(G).map((id) => MENU[id].short).join(', ')} ดูไหม`,
          'surprised',
        ),
      4500,
    );
  const visit = (p: Place) => {
    focus = (spots[p].obj.getWorldPosition(new THREE.Vector3()));
    sfx('click');
    if (p === 'shop') return openShop();
    if (p === 'furniture' && G.shopSize !== 'catcafe') return adv.say('ร้านเราเป็นคีออสก์ ไม่มีที่วางโต๊ะเก้าอี้นะ', 'think');
    setTimeout(() => go(p === 'market' ? 'market' : p === 'furniture' ? 'furnitureStore' : 'bank'), 700);
  };
  for (const [id, sp] of Object.entries(spots) as [Place, (typeof spots)[Place]][]) {
    const pin = stage.label(sp.obj, h('div', 'tag3d pin', `${sp.icon} ${sp.label}`), sp.h);
    pin.addEventListener('click', () => visit(id));
  }
  mount(
    h(
      'div',
      { class: 'panel col content', style: { position: 'absolute', right: '20px', top: '80px', width: '300px', gap: '6px' } },
      h('h3', {}, '📋 สถานะร้าน'),
      moneyRows(),
      h('div', 'muted', `ค่าใช้จ่ายประจำ: ค่าเช่า ${baht(rentPerDay(G))}/วัน • ค่าแรง ${baht(wagesPerDay(G))}/วัน`),
      ...(Object.entries(spots) as [Place, (typeof spots)[Place]][]).map(([id, sp]) => btn(`${sp.icon} ${sp.label}`, id === 'shop' ? 'pink' : '', () => visit(id), id === 'shop' ? '' : 'small')),
      btn('👥 ชวนเพื่อนมาช่วย', 'lav', () => openLobby(), 'small'),
    ),
  );

  function openShop() {
    const stock = G.menus.map((id) => h('div', { class: cupsPossible(G.inventory, id) ? '' : 'bad', style: { fontSize: '15px' } }, `${MENU[id].short}: ทำได้ ${cupsPossible(G.inventory, id)} แก้ว`));
    const promos = [openingActive(G) && `🎉 ลด ${G.promos.opening.pct}%`, G.promos.coupon.on && `⭐ คูปอง ${baht(G.promos.coupon.amount)}`, G.promos.bundle.on && '👫 ซื้อหลายแก้วลด', G.delivery.on && '📱 เดลิเวอรี่'].filter(Boolean).join(' • ');
    const { close } = modal(
      [
        h('h2', {}, `เปิดร้านวันที่ ${G.day}?`),
        h('div', 'muted', 'วัตถุดิบที่มีตอนนี้'),
        ...stock,
        h('div', { style: { marginTop: '8px' } }, promos ? `โปรวันนี้: ${promos}` : 'ยังไม่ได้จัดโปรโมชั่น'),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } }, btn('กลับไปแผนที่', '', () => close()), btn('ตั้งราคา & โปร', 'gold', () => {
          close();
          priceModal('ปรับราคาหน้าร้าน ราคาในแอป และโปรโมชั่นของวันนี้', openShop);
        }), btn('เปิดร้าน! ›', 'pink', () => {
          close();
          go('shopDay');
        }, 'big')),
      ],
      { width: '520px' },
    );
  }
}

// ---------------------------------------------------------------- the landlord

/** Every few days the landlord comes for the rent; the player must find the money. */
export function landlordScreen(stage: Stage): void {
  const e = stage.engine;
  e.daySky();
  e.hemi.intensity = 1.6;
  e.sun.intensity = 2.2;
  stage.add(buildStreet());
  e.camera.position.set(1.2, 2.6, 9.5);
  e.look(1.2, 1.2, 1.5);
  const hud = new Hud(`เช้าวันที่ ${G.day} • หน้าร้าน`);
  const me = addChibi(stage, CAST[G.playerKey], 0.4, 1.6, 0.5);
  const landlord = createCharacter(LANDLORD);
  landlord.root.position.set(11, 0, 2);
  stage.add(landlord.root);
  stage.onUpdate((dt) => landlord.update(dt));
  const info = mount(h('div', { class: 'panel content', style: { position: 'absolute', right: '20px', top: '80px', width: '300px' } }, h('h3', {}, '💰 การเงินตอนนี้'), moneyRows()));
  const dlg = new DialogBox();
  const refresh = () => {
    info.replaceChildren(h('h3', {}, '💰 การเงินตอนนี้'), moneyRows());
    hud.refresh();
  };

  void (async () => {
    await dlg.say([{ who: 'narrator', text: 'เช้าวันนั้น ก่อนเปิดร้าน เจ้าของที่เดินมาที่ร้าน...' }]);
    dlg.hide();
    await walkTo(stage, landlord, 1.9, 1.7, 2.2);
    landlord.faceTo(me.root.position.x, me.root.position.z);
    me.faceTo(landlord.root.position.x, landlord.root.position.z);
    const days = Math.min(G.day - 1, 3);
    await dlg.say([
      { who: 'narrator', text: `เจ้าของที่: "สวัสดีจ้ะ ครบกำหนดค่าเช่า ${days} วันแล้วนะ${G.rentLate ? ' รวมค่าปรับที่ผัดไว้รอบก่อนด้วย' : ''} ทั้งหมด ${baht(G.rentDue)} จ้ะ"` },
      { who: 'miyu', text: `ค่าเช่าคือ "ต้นทุนคงที่" ขายได้หรือไม่ได้ก็ต้องจ่าย ตอนนี้เรามีเงินสด ${baht(G.cash)} นะ`, expr: 'think' },
    ]);
    ask();
  })();

  async function ask() {
    // already put off once, and even a full loan would not cover it: the shop is lost
    if (G.rentLate > 0 && G.cash + (LOAN_LIMIT - G.loan) < G.rentDue) {
      landlord.setExpr('annoyed');
      await dlg.say([
        { who: 'narrator', text: 'เจ้าของที่: "ผัดมาแล้วรอบหนึ่ง ยังจ่ายไม่ได้อีก... ป้าคงต้องขอพื้นที่คืนนะ"' },
        { who: 'miyu', text: 'ต้องคืนพื้นที่ร้านแล้ว... เงินสดหมุนไม่ทันเป็นสาเหตุหลักที่ร้านเล็กต้องปิดตัว มาดูกันว่าพลาดตรงไหน', expr: 'sad' },
      ]);
      dlg.hide();
      return go('ending', { bankrupt: true, evicted: true });
    }
    const opts = [
      { id: 'pay', label: `จ่ายค่าเช่า ${baht(G.rentDue)}` },
      { id: 'bank', label: '🏦 ขอไปกู้เงินธนาคารก่อน' },
      ...(G.rentLate === 0 ? [{ id: 'delay', label: `ขอผัดไปรอบหน้า (ปรับ ${LATE_FEE * 100}%)` }] : []),
    ];
    const pick = await dlg.ask({ who: 'me', text: 'จะทำยังไงดีนะ...', expr: 'think' }, opts);
    if (pick === 'pay') {
      if (G.cash < G.rentDue) {
        await dlg.say([{ who: 'miyu', text: `เงินสดไม่พอ ขาดอีก ${baht(G.rentDue - G.cash)} ลองไปกู้ธนาคาร หรือขอผัดก่อนดีไหม`, expr: 'surprised' }]);
        return ask();
      }
      G.cash -= G.rentDue;
      G.rentDue = 0;
      G.rentLate = 0;
      G.landlordDay = G.day;
      sfx('coin');
      landlord.setExpr('happy');
      refresh();
      await dlg.say([
        { who: 'narrator', text: `เจ้าของที่: "ขอบใจจ้ะ จ่ายตรงเวลาแบบนี้ ป้าชอบ!"` },
        { who: 'miyu', text: 'จ่ายตรงเวลาดีแล้ว แต่อีก 3 วันเจ้าของที่ก็มาเก็บอีก ต้องเก็บเงินไว้ด้วยนะ', expr: 'happy' },
      ]);
      return leave();
    }
    if (pick === 'bank') {
      await dlg.say([{ who: 'narrator', text: 'เจ้าของที่: "ได้จ้ะ ป้ารอที่นี่นะ"' }]);
      dlg.hide();
      return go('bank');
    }
    // asking for more time: allowed once, with a fine
    G.rentDue = Math.round(G.rentDue * (1 + LATE_FEE));
    G.rentLate = 1;
    G.landlordDay = G.day;
    landlord.setExpr('annoyed');
    refresh();
    await dlg.say([
      { who: 'narrator', text: `เจ้าของที่: "ก็ได้... แต่ต้องบวกค่าปรับนะ รอบหน้าเป็น ${baht(G.rentDue)} บวกค่าเช่ารอบใหม่ แล้วห้ามผัดอีกนะจ๊ะ!"` },
      { who: 'miyu', text: 'ผัดได้ครั้งเดียวนะ ถ้ารอบหน้ายังจ่ายไม่ได้ อาจต้องคืนร้าน ต้องวางแผนเงินสดให้ดี', expr: 'surprised' },
    ]);
    leave();
  }

  async function leave() {
    dlg.hide();
    me.setExpr(G.rentDue ? 'think' : 'happy');
    await walkTo(stage, landlord, 11, 2, 2.4);
    saveGame();
    go('map');
  }
}

// ---------------------------------------------------------------- the bank

function buildBank(): THREE.Group {
  const g = new THREE.Group();
  const floor = mesh(new THREE.PlaneGeometry(14, 10), mat('#e8e4dc'));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  const wall = mesh(new THREE.BoxGeometry(14, 4, 0.3), mat('#f4f1ea'));
  wall.position.set(0, 2, -4);
  g.add(wall);
  const band = mesh(new THREE.BoxGeometry(14, 0.5, 0.32), mat('#2f6fae'));
  band.position.set(0, 3.2, -4);
  g.add(band);
  for (const x of [-7, 7]) {
    const side = mesh(new THREE.BoxGeometry(0.3, 4, 10), mat('#ece8e0'));
    side.position.set(x, 2, 1);
    g.add(side);
  }
  const sign = signPlane('BANK', 2.4, 0.6, { bg: '#2f6fae', fg: '#ffffff', border: '#ffffff', font: 'Fredoka, Mitr, sans-serif' });
  sign.position.set(0, 2.5, -3.83);
  g.add(sign);
  const counter = P.counterBlock(6, '#c9d6e6', '#ffffff');
  counter.position.set(0, 0, -1.6);
  g.add(counter);
  for (const x of [-1.6, 1.6]) {
    const glass = mesh(new THREE.BoxGeometry(2.6, 0.9, 0.04), mat('#dff3fb', { opacity: 0.4, rough: 0.1 }), false);
    glass.position.set(x, 1.55, -1.6);
    g.add(glass);
  }
  const reg = P.register();
  reg.position.set(1.4, 1.08, -1.6);
  g.add(reg);
  for (const [x, z] of [[-6.2, -3.3], [6.2, -3.3]]) {
    const pl = P.plant(1.4);
    pl.position.set(x, 0, z);
    g.add(pl);
  }
  return g;
}

/** Borrow, repay and pay the income tax that has been set aside. */
export function bankScreen(stage: Stage): void {
  const e = stage.engine;
  stage.add(buildBank());
  e.camera.position.set(0, 3.2, 7.5);
  e.look(0, 1.2, -1.5);
  const teller = createCharacter(TELLER);
  teller.root.position.set(0, 0, -2.4);
  stage.add(teller.root);
  stage.onUpdate((dt) => teller.update(dt));
  addChibi(stage, CAST[G.playerKey], -0.4, 0.2, Math.PI);
  const hud = new Hud('ธนาคาร');
  stepChip('🏦', 'ธนาคาร', 'กู้เงิน คืนเงินกู้ และจ่ายภาษี');
  const adv = new Advisor('bottom-left');
  adv.say(`กู้เงินช่วยให้มีเงินสดหมุน แต่ต้องจ่ายดอกเบี้ยทุกวัน (${LOAN_RATE_YEAR * 100}% ต่อปี) กู้เท่าที่จำเป็นนะ ส่วนภาษีเงินได้เรากันไว้ ${TAX_RATE * 100}% ของกำไรทุกวัน มาจ่ายที่นี่ได้`, 'think');
  const panel = mount(h('div', { class: 'panel col content', style: { position: 'absolute', right: '20px', top: '80px', width: '340px', gap: '8px' } }));
  const draw = () => {
    hud.refresh();
    const room = LOAN_LIMIT - G.loan;
    const borrow = (n: number) =>
      btn(`กู้ ${baht(n)}`, 'mint', () => {
        G.loan += n;
        G.cash += n;
        sfx('coin');
        toast(`ได้รับเงินกู้ ${baht(n)} • ดอกเบี้ย ~${baht(Math.round(G.loan * LOAN_RATE_DAY))}/วัน`, 'good');
        adv.say(`ตอนนี้หนี้รวม ${baht(G.loan)} ดอกเบี้ยวันละ ~${baht(Math.round(G.loan * LOAN_RATE_DAY))} ยิ่งคืนเร็วยิ่งเสียดอกเบี้ยน้อย`, 'think');
        draw();
      }, 'small');
    const repay = (n: number, label: string) => {
      const b = btn(label, '', () => {
        G.loan -= n;
        G.cash -= n;
        sfx('coin');
        toast(`คืนเงินกู้ ${baht(n)} แล้ว`, 'good');
        draw();
      }, 'small');
      b.disabled = n <= 0 || n > G.cash;
      return b;
    };
    const b5 = borrow(10000);
    b5.disabled = room < 10000;
    const b10 = borrow(30000);
    b10.disabled = room < 30000;
    const payTax = btn(`จ่ายภาษี ${baht(G.taxDue)}`, 'gold', () => {
      G.cash -= G.taxDue;
      toast(`จ่ายภาษี ${baht(G.taxDue)} เรียบร้อย`, 'good');
      G.taxDue = 0;
      sfx('coin');
      adv.say('จ่ายภาษีครบแล้ว ไม่โดนเบี้ยปรับ และกู้เงินได้ง่ายขึ้นในอนาคตด้วย', 'happy');
      draw();
    });
    payTax.disabled = !G.taxDue || G.taxDue > G.cash;
    panel.replaceChildren(
      h('h3', {}, '💰 บัญชีของร้าน'),
      moneyRows(),
      h('h3', {}, '🏦 กู้เงิน'),
      h('div', 'muted', `วงเงินกู้สูงสุด ${baht(LOAN_LIMIT)} • กู้ได้อีก ${baht(room)} • ดอกเบี้ย ${LOAN_RATE_YEAR * 100}%/ปี (~${baht(Math.round(10000 * LOAN_RATE_DAY * 30))}/เดือน ต่อเงินกู้หมื่นบาท)`),
      h('div', 'row', b5, b10),
      h('h3', {}, '↩ คืนเงินกู้'),
      h('div', 'row', repay(Math.min(10000, G.loan), 'คืน ฿10,000'), repay(G.loan, `คืนทั้งหมด ${baht(G.loan)}`)),
      h('h3', {}, '🧾 ภาษีเงินได้'),
      h('div', 'muted', `กันไว้ ${TAX_RATE * 100}% ของกำไรแต่ละวัน ถ้าค้างจนจบเดโมจะโดนเบี้ยปรับ 20%`),
      payTax,
      btn(isRentDay(G) ? '← กลับไปจ่ายค่าเช่า' : '← กลับแผนที่', 'pink', () => go('map'), 'big'),
    );
  };
  draw();
}

