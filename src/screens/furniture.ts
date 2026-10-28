import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { backOut } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, DialogBox, Hud, modal, polite, stepChip, toast } from '../ui/components';
import { go } from '../game/flow';
import { CAST } from '../game/specs';
import { G, saveGame } from '../sim/GameState';
import { rentPerDay, upkeepPerDay, utilitiesPerDay, wagesPerDay } from '../sim/economy';
import { FURN, FURNITURE, SEATING_AREA, ZONE, areaUsed, canAdd, canRemove, comfortBonus, emptyFurniture, layout, seatCount, seatDemandFactor, tableSeats, totalCost, totalPieces, type FurnId, type Furniture } from '../data/furniture';
import { buildFurnitureStore, type FurnitureStation } from '../three/sets/furnitureStore';
import { buildShop } from '../three/sets/interiors';
import { buildStreet } from '../three/sets/street';
import * as F from '../three/models/furniture';
import { addChibi, walkTo } from './common';
import { baht } from '../game/format';
import { MENU } from '../data/menus';
import { sfx } from '../ui/sfx';
import type { Character } from '../three/models/miyu';

/** Days of fixed costs the shop should still be able to pay after buying furniture. */
const RESERVE_DAYS = 2;
const reserve = () => (rentPerDay(G) + wagesPerDay(G) + upkeepPerDay(G) + utilitiesPerDay(G)) * RESERVE_DAYS;

const DRIVER = CAST.extra_driver;

const PLAN_SCALE = 22;
const PLAN_COLOR: Record<FurnId, string> = { table_wood: '#b98352', table_long: '#a9713f', chair_wood: '#f6c1d4', stool: '#c9a8e6', sofa: '#f4b6c8' };
const PLAN_SIZE: Record<FurnId, [number, number]> = { table_wood: [0.9, 0.9], table_long: [1.8, 0.8], chair_wood: [0.46, 0.46], stool: [0.42, 0.42], sofa: [1.7, 0.85] };

/** Top-down drawing of the seating zone, so the player can see the limit of the floor. */
function floorPlan(f: Furniture): HTMLElement {
  const [x0, z0, x1, z1] = ZONE;
  const plan = h('div', { class: 'floor-plan', style: { position: 'relative', width: `${(x1 - x0) * PLAN_SCALE}px`, height: `${(z1 - z0) * PLAN_SCALE}px`, background: 'repeating-linear-gradient(45deg,#fff6ee,#fff6ee 8px,#fdeede 8px,#fdeede 16px)', border: '2px dashed #c89466', borderRadius: '10px', overflow: 'hidden' } });
  plan.append(h('div', { style: { position: 'absolute', left: '6px', bottom: '2px', fontSize: '12px', color: '#a8764a' } }, 'ทางเข้า / เคาน์เตอร์ ↓'), h('div', { style: { position: 'absolute', left: '6px', top: '2px', fontSize: '12px', color: '#a8764a' } }, 'ริมหน้าต่าง'));
  for (const p of layout(f)) {
    const [w, d] = PLAN_SIZE[p.id];
    const swap = Math.abs(Math.sin(p.rot)) > 0.9 && p.id !== 'sofa';
    const [pw, pd] = swap ? [d, w] : [w, d];
    plan.append(h('div', { style: { position: 'absolute', left: `${(p.x - x0 - pw / 2) * PLAN_SCALE}px`, top: `${(p.z - z0 - pd / 2) * PLAN_SCALE}px`, width: `${pw * PLAN_SCALE}px`, height: `${pd * PLAN_SCALE}px`, background: PLAN_COLOR[p.id], borderRadius: p.id === 'stool' ? '50%' : '4px', border: '1px solid rgba(0,0,0,0.25)' } }));
  }
  return plan;
}

/** Budget, space and customer-effect summary shown beside the 3D store. */
function summaryPanel(cart: Furniture, owned: Furniture = emptyFurniture()): { el: HTMLElement; refresh: () => void } {
  const body = h('div', { class: 'col', style: { gap: '8px' } });
  const refresh = () => {
    const cost = totalCost(cart);
    const left = G.cash - cost;
    const both = Object.fromEntries(FURNITURE.map((i) => [i.id, owned[i.id] + cart[i.id]])) as Furniture;
    const area = areaUsed(both);
    const seats = seatCount(both);
    const unused = Math.max(0, both.chair_wood + both.stool - tableSeats(both));
    body.replaceChildren(
      h('div', { class: 'muted', style: { fontSize: '15px' } }, 'ผังพื้นที่โซนที่นั่งในร้านของเรา (มองจากด้านบน)'),
      floorPlan(both),
      totalPieces(owned) ? h('div', { class: 'muted', style: { fontSize: '14px' } }, `ในร้านมีอยู่แล้ว: ${FURNITURE.filter((i) => owned[i.id]).map((i) => `${i.short} ${owned[i.id]}`).join(', ')}`) : '',
      h('div', {}, `พื้นที่ใช้ไป `, h('b', { class: area > SEATING_AREA - 0.5 ? 'bad' : '' }, `${area.toFixed(1)} / ${SEATING_AREA} ตร.ม.`)),
      h('div', 'bar pink', h('i', { style: { width: `${Math.min(100, (area / SEATING_AREA) * 100)}%` } })),
      h('div', { style: { lineHeight: '1.6' } }, ...FURNITURE.filter((i) => cart[i.id]).map((i) => h('div', {}, `🛒 ${i.icon} ${i.short} × ${cart[i.id]}`)), totalPieces(cart) === 0 ? h('span', 'muted', 'ยังไม่ได้เลือกซื้ออะไร') : null),
      h('div', {}, `ที่นั่งลูกค้า `, h('b', {}, `${seats} ที่`), unused ? h('small', 'bad', ` (มี ${unused} ตัวที่ไม่มีโต๊ะ)`) : null),
      h('div', 'muted', seats ? `ลูกค้าเข้าร้าน ${Math.round((seatDemandFactor(both) - 1) * 100) >= 0 ? '+' : ''}${Math.round((seatDemandFactor(both) - 1) * 100)}% • ความพอใจ ${comfortBonus(both) >= 0 ? '+' : ''}${Math.round(comfortBonus(both) * 100)}%` : 'ไม่มีที่นั่ง ลูกค้าจะเข้าร้านน้อยลง ~12%'),
      h('table', 'ledger', h('tr', {}, h('td', 'muted', 'เงินสดตอนนี้'), h('td', {}, baht(G.cash))), h('tr', {}, h('td', 'muted', 'ค่าเฟอร์นิเจอร์'), h('td', { class: cost ? 'bad' : '' }, `−${baht(cost)}`)), h('tr', {}, h('td', 'muted', 'เหลือหลังซื้อ'), h('td', {}, h('b', { class: left < reserve() ? 'bad' : 'good' }, baht(left)))), h('tr', {}, h('td', 'muted', `สำรองค่าใช้จ่าย ${RESERVE_DAYS} วัน`), h('td', {}, baht(reserve())))),
      left < reserve() ? h('div', { class: 'bad', style: { fontSize: '15px' } }, '⚠️ เงินที่เหลือไม่พอจ่ายค่าเช่าและค่าแรงช่วงแรก') : '',
    );
  };
  refresh();
  return { el: mount(h('div', { class: 'panel col plan-sheet', style: { position: 'absolute', right: '20px', top: '80px', width: '300px', gap: '8px', maxHeight: 'calc(100% - 110px)', overflowY: 'auto' } }, h('h3', {}, '🛋️ แผนจัดร้านของเรา'), body)), refresh };
}

// ---------------------------------------------------------------- 1. the furniture store

export function furnitureStoreScreen(stage: Stage): () => void {
  G.checkpoint = 'morning';
  saveGame();
  const e = stage.engine;
  const set = buildFurnitureStore();
  stage.add(set.group);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshStandardMaterial({ color: '#cdbba6', roughness: 0.95 }));
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, -0.01, 13);
  street.receiveShadow = true;
  stage.add(street);
  const me = addChibi(stage, CAST[G.playerKey], set.outside.x, set.outside.z, Math.PI);
  stage.onUpdate((dt) => set.cashier.update(dt));
  const cam = e.camera;
  /** Already in the shop, and what is being bought now. */
  const owned = G.furniture ?? emptyFurniture();
  const cart = emptyFurniture();
  const all = (): Furniture => Object.fromEntries(FURNITURE.map((i) => [i.id, owned[i.id] + cart[i.id]])) as Furniture;
  const firstVisit = G.history.length === 0;
  let paid = false;
  let modalOpen = true;
  let target: { x: number; z: number; station?: FurnitureStation } | null = null;
  let near: FurnitureStation | null = null;
  const keys = new Set<string>();

  const hud = new Hud('ร้านเฟอร์นิเจอร์');
  stepChip(7, 'ไปเลือกเฟอร์นิเจอร์', 'เดินไปที่ชั้นโชว์ที่มีเครื่องหมาย ! เพื่อดูของ แล้วไปจ่ายเงินที่เคาน์เตอร์');
  const sum = summaryPanel(cart, owned);
  const adv = new Advisor('bottom-left');
  adv.say(`ถึงร้านเฟอร์นิเจอร์แล้ว ร้านเรามีพื้นที่โซนที่นั่ง ${SEATING_AREA} ตร.ม. ซื้อเกินพื้นที่ไม่ได้ และต้องเหลือเงินจ่ายค่าเช่าด้วยนะ`);
  const prompt = stage.label(me.root, h('div', 'tag3d', 'กด E / คลิกชั้นโชว์'), 2.1);
  prompt.style.visibility = 'hidden';

  for (const st of set.stations) {
    stage.label(st.obj, h('div', { class: 'col', style: { alignItems: 'center', gap: '2px' } }, h('div', 'mark3d', st.id === 'checkout' ? '$' : '!'), h('div', 'tag3d', st.item ? `${st.label} ${baht(FURN[st.item].price)}` : st.label)), st.id === 'checkout' ? 2.1 : 1.6);
    stage.click(st.obj, () => {
      if (!modalOpen) target = { x: st.front.x, z: st.front.z, station: st };
    });
  }
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  e.onMiss = (ray) => {
    const p = new THREE.Vector3();
    if (!modalOpen && ray.ray.intersectPlane(floorPlane, p)) target = { x: p.x, z: p.z };
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.type === 'keydown') {
      keys.add(ev.key.toLowerCase());
      if (ev.key.toLowerCase() === 'e' && near && !modalOpen) open(near);
    } else keys.delete(ev.key.toLowerCase());
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  const blocked = (x: number, z: number) => {
    const [x0, z0, x1, z1] = set.bounds;
    if (x < x0 || x > x1 || z < z0 || z > z1) return true;
    // outside the shop the front is open; inside, the platforms block
    return set.walls.some(([a, b, c, d]) => x > a - 0.3 && x < c + 0.3 && z > b - 0.3 && z < d + 0.3);
  };
  let stuck = 0;
  stage.onUpdate((dt) => {
    let vx = 0;
    let vz = 0;
    if (!modalOpen) {
      if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
      if (keys.has('d') || keys.has('arrowright')) vx += 1;
      if (keys.has('w') || keys.has('arrowup')) vz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) vz += 1;
      if (vx || vz) target = null;
      else if (target) {
        const dx = target.x - me.root.position.x;
        const dz = target.z - me.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          const st = target.station;
          target = null;
          if (st) open(st);
        } else {
          vx = dx / d;
          vz = dz / d;
        }
      }
      const len = Math.hypot(vx, vz);
      me.walking = len > 0;
      if (len) {
        const sp = 3.6 * dt;
        const p = me.root.position;
        let moved = false;
        if (!blocked(p.x + (vx / len) * sp, p.z)) {
          p.x += (vx / len) * sp;
          moved = true;
        }
        if (!blocked(p.x, p.z + (vz / len) * sp)) {
          p.z += (vz / len) * sp;
          moved = true;
        }
        me.root.rotation.y = Math.atan2(vx, vz);
        stuck = moved ? 0 : stuck + 1;
        if (stuck > 20 && target) {
          const st = target.station;
          target = null;
          if (st && st.front.distanceTo(p) < 1.6) open(st);
        }
      }
    }
    near = set.stations.find((s) => s.front.distanceTo(me.root.position) < 1.1) ?? null;
    prompt.style.visibility = near && !modalOpen ? 'visible' : 'hidden';
    const p = me.root.position;
    cam.position.lerp(new THREE.Vector3(p.x * 0.4 + 1.5, 13.5, Math.min(p.z, 5) + 10), 0.08);
    e.look(p.x * 0.5 + 1.5, 0.6, Math.min(p.z, 5) - 4.5);
  });
  cam.position.set(set.start.x * 0.4 + 1.5, 13.5, 15);
  e.look(set.start.x * 0.5 + 1.5, 0.6, 1.5);

  // walk in from the street
  void (async () => {
    await stage.wait(500);
    await walkTo(stage, me, set.start.x, set.start.z, 3);
    me.root.rotation.y = Math.PI;
    modalOpen = false;
  })();

  function open(st: FurnitureStation) {
    if (modalOpen) return;
    me.root.rotation.y = Math.PI;
    if (st.item) item(st.item);
    else checkout();
  }

  function item(id: FurnId) {
    modalOpen = true;
    const it = FURN[id];
    const count = h('b', { style: { minWidth: '36px', textAlign: 'center', fontSize: '24px' } });
    const note = h('div', { class: 'bad', style: { fontSize: '15px', minHeight: '22px' } });
    const minus = btn('−', '', () => change(-1), 'square small');
    const plus = btn('+', 'pink', () => change(1), 'square small');
    const rowTotal = h('div', { class: 'muted' });
    const draw = (why = '') => {
      count.textContent = String(cart[id]);
      const add = canAdd(all(), id);
      const afford = it.price <= G.cash - totalCost(cart);
      minus.disabled = cart[id] <= 0;
      plus.disabled = !add.ok || !afford;
      rowTotal.textContent = cart[id] ? `${cart[id]} ตัว = ${baht(cart[id] * it.price)}` : '';
      note.textContent = why || (!add.ok ? add.reason : !afford ? 'เงินไม่พอซื้ออีกตัวแล้ว' : '');
    };
    const change = (d: number) => {
      if (d > 0) {
        const ok = canAdd(all(), id);
        if (!ok.ok) return draw(ok.reason);
        cart[id]++;
        sfx('pop');
      } else {
        if (cart[id] <= 0) return;
        const ok = canRemove(all(), id);
        if (!ok.ok) return draw(ok.reason || '');
        cart[id]--;
      }
      sum.refresh();
      draw();
    };
    draw();
    const seatText = it.tableSeats ? `มีที่นั่งให้ ${it.tableSeats} ที่` : it.ownSeats ? `ที่นั่ง ${it.ownSeats} ที่` : '';
    const { close } = modal(
      [
        h('h2', {}, `${it.icon} ${it.name}`),
        h('p', {}, it.desc),
        h('table', 'ledger', h('tr', {}, h('td', 'muted', 'ราคา'), h('td', {}, `${baht(it.price)} / ตัว`)), h('tr', {}, h('td', 'muted', 'พื้นที่ที่ใช้'), h('td', {}, `${it.area} ตร.ม.`)), seatText ? h('tr', {}, h('td', 'muted', 'ที่นั่ง'), h('td', {}, seatText)) : null),
        h('div', 'good', `+ ${it.pros}`),
        h('div', 'bad', `− ${it.cons}`),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } }, minus, count, plus),
        h('div', { style: { textAlign: 'center' } }, rowTotal),
        note,
        h('div', { style: { textAlign: 'center', marginTop: '10px' } }, btn('ตกลง ✓', 'mint', () => close())),
      ],
      {
        width: '480px',
        onClose: () => {
          modalOpen = false;
          const total = totalPieces(cart);
          if (total) adv.say(`ใช้พื้นที่ ${areaUsed(all()).toFixed(1)} จาก ${SEATING_AREA} ตร.ม. แล้ว ที่นั่ง ${seatCount(all())} ที่ เหลือเงิน ${baht(G.cash - totalCost(cart))}`, 'think');
        },
      },
    );
  }

  function checkout() {
    modalOpen = true;
    const cost = totalCost(cart);
    const total = totalPieces(cart);
    const left = G.cash - cost;
    const lines = FURNITURE.filter((i) => cart[i.id]).map((i) => h('div', 'row', h('span', {}, i.icon), h('span', { style: { flex: '1' } }, `${i.name} × ${cart[i.id]}`), h('span', {}, baht(i.price * cart[i.id]))));
    const empty = total === 0;
    const pay = btn(empty ? (firstVisit ? 'ไม่ซื้ออะไรเลย' : 'ออกจากร้าน') : `จ่ายเงิน ${baht(cost)}`, empty ? '' : 'pink', () => {
      paid = true;
      G.furniture = all();
      G.cash -= cost;
      G.pendingSetup += cost;
      G.checkpoint = 'morning';
      saveGame();
      hud.refresh();
      close();
      modalOpen = true;
      if (empty) {
        if (!firstVisit) return void go('map');
        adv.say('ไม่ซื้อเลยเหรอ? ร้านที่ไม่มีที่นั่งลูกค้าจะน้อยลงนะ แต่ก็ประหยัดเงินได้มาก', 'think');
        setTimeout(() => go('shopDay'), 2200);
        return;
      }
      sfx('coin');
      adv.say('จ่ายเงินเรียบร้อย แจ้งที่อยู่ร้านให้เขามาส่งได้เลย');
      setTimeout(() => go('delivery', { bought: { ...cart }, before: owned }), 2000);
    }, 'big');
    const { close } = modal(
      [
        h('h2', {}, '🧾 เคาน์เตอร์จ่ายเงิน'),
        ...(lines.length ? lines : [h('div', 'muted', 'ยังไม่ได้เลือกอะไรเลย')]),
        h('div', { style: { fontSize: '20px', marginTop: '12px' } }, `รวม `, h('b', {}, baht(cost)), h('br'), `เงินคงเหลือหลังซื้อ `, h('b', { class: left < reserve() ? 'bad' : 'good' }, baht(left))),
        empty ? h('div', { class: 'bad', style: { marginTop: '8px' } }, firstVisit ? 'ถ้าไม่ซื้อ ร้านจะไม่มีที่นั่งให้ลูกค้า' : 'ไม่ได้ซื้ออะไรเพิ่ม') : left < reserve() ? h('div', { class: 'bad', style: { marginTop: '8px' } }, `⚠️ เงินสำรองน้อยกว่าค่าใช้จ่ายประจำ ${RESERVE_DAYS} วัน (${baht(reserve())}) เสี่ยงเงินขาดมือนะ`) : h('div', { class: 'good', style: { marginTop: '8px' } }, '✓ ยังมีเงินสำรองเพียงพอ'),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } }, btn('กลับไปเลือกต่อ', '', () => close()), pay),
      ],
      {
        width: '560px',
        onClose: () => {
          if (!paid) modalOpen = false;
        },
      },
    );
    if (left < reserve() && !empty) adv.say('เงินเหลือน้อยไปหน่อยนะ ค่าเช่ากับค่าแรงต้องจ่ายทุกวัน ลองลดของลงไหม?', 'surprised');
  }

  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  };
}

// ---------------------------------------------------------------- 2. the delivery truck

export function deliveryScreen(stage: Stage, data: { bought?: Furniture; before?: Furniture } = {}): void {
  const e = stage.engine;
  // the truck brings only what was just bought
  const f = data.bought ?? G.furniture ?? emptyFurniture();
  e.daySky();
  e.hemi.intensity = 1.6;
  e.sun.intensity = 2.2;
  stage.add(buildStreet());
  const roadZ = 6.4;
  e.camera.position.set(0.8, 4.4, 17);
  e.look(-0.4, 1.3, 2.5);
  new Hud('หน้าร้าน');
  const dlg = new DialogBox();
  const me = addChibi(stage, CAST[G.playerKey], 3.6, 3.2, 0);
  const miyu = addChibi(stage, CAST.advisor, 4.8, 3.3, -0.3);
  const truck = F.deliveryTruck();
  truck.position.set(22, 0, roadZ);
  // facing left, so the open back is toward the shop door
  truck.rotation.y = Math.PI;
  stage.add(truck);
  const wheels = truck.userData.wheels as THREE.Mesh[];
  const load = truck.userData.load as THREE.Group;
  let rolling = true;

  void (async () => {
    await dlg.say([{ who: 'narrator', text: 'บ่ายวันนั้น รถขนส่งเฟอร์นิเจอร์ก็ขับมาถึงหน้าร้าน...' }]);
    dlg.hide();
    const spin = stage.onUpdate((dt) => {
      if (rolling) for (const w of wheels) w.rotation.z -= dt * 6;
    });
    await stage.tween(truck.position, { x: -0.9 }, 3200, (t) => 1 - Math.pow(1 - t, 2));
    rolling = false;
    spin();
    sfx('done');
    const driver = addChibi(stage, DRIVER, truck.position.x - 1.5, roadZ + 1.5, 0);
    driver.setExpr('happy');
    await stage.wait(400);
    // the driver comes round to the open back and hauls boxes to the shop door, one trip per kind of furniture
    const kinds = FURNITURE.filter((i) => f[i.id]);
    const boxes = [...load.children];
    const rear = truck.position.x - (truck.userData.rear as THREE.Vector3).x + 0.9;
    const door = { x: 0.4, z: 2.2 };
    let i = 0;
    for (const k of kinds.length ? kinds : [FURN.table_wood]) {
      await walkTo(stage, driver, rear, roadZ, 4.2);
      const b = F.cardboardBox(k.id === 'sofa' || k.id === 'table_long' ? 1.1 : 0.7, 0.5, 0.55);
      b.position.set(0, 0.62, 0.42);
      driver.root.add(b);
      boxes[i++ % boxes.length]?.removeFromParent();
      await walkTo(stage, driver, door.x, door.z, 3.4);
      b.removeFromParent();
      sfx('pop');
    }
    await walkTo(stage, driver, 3.0, 3.4, 3.6);
    driver.root.rotation.y = Math.PI / 2 + 0.3;
    driver.setExpr('happy');
    const p = polite();
    const list = FURNITURE.filter((i) => f[i.id]).map((i) => `${i.short} ${f[i.id]}`).join(' • ') || 'ไม่มีของ';
    await dlg.say([
      { who: 'narrator', text: `พนักงานขนส่ง: "ส่งเฟอร์นิเจอร์ให้ร้านชานมครับ! มี ${list} เซ็นรับของตรงนี้ได้เลย"` },
      { who: 'miyu', text: 'ของมาถึงแล้ว นับให้ครบตามใบสั่งซื้อก่อนเซ็นรับนะ ถ้าของผิดหรือเสียหายต้องแจ้งตอนรับเลย', expr: 'happy' },
      { who: 'me', text: `ขอบคุณ${p} ช่วยยกเข้าไปวางในร้านให้หน่อยนะ${p}`, expr: 'happy' },
    ]);
    dlg.hide();
    go('furnish', data);
  })();
  void miyu;
  void me;
}

// ---------------------------------------------------------------- 3. placing it in the shop

export function furnishScreen(stage: Stage, data: { before?: Furniture } = {}): void {
  const e = stage.engine;
  const f = G.furniture ?? emptyFurniture();
  const firstDay = G.history.length === 0;
  // pieces already standing in the shop stay put; only new ones are carried in
  const old = new Map<string, number>();
  const keyOf = (p: { id: string; x: number; z: number }) => `${p.id}|${p.x}|${p.z}`;
  for (const p of layout(data.before ?? emptyFurniture())) old.set(keyOf(p), (old.get(keyOf(p)) ?? 0) + 1);
  const set = buildShop(G.shopSize === 'catcafe', f);
  stage.add(set.group);
  // pulled back and tilted a little more than a shop day, so the seating area is in sight (the ceiling stops us going higher)
  e.camera.position.set(0.3, 3.7, 11.5);
  e.look(-1.6, 0.7, -2.5);
  e.setSky('#4a3a32', false);
  e.hemi.color.set('#fff1e0');
  e.hemi.groundColor.set('#b08a68');
  e.sun.color.set('#ffe6c4');
  set.setMenu(G.menus.map((id) => `${MENU[id].short} ${G.prices[id]}`));
  new Hud('ร้านชานม');
  stepChip('🛋️', 'จัดร้านให้เรียบร้อย', 'คนขนส่งกับเรากำลังช่วยกันยกเฟอร์นิเจอร์เข้าที่');
  const adv = new Advisor('bottom-left');
  const pieces = set.furniture.filter((p) => {
    const n = old.get(keyOf(p.placement)) ?? 0;
    if (n > 0) old.set(keyOf(p.placement), n - 1);
    return n === 0;
  });
  for (const p of pieces) p.obj.visible = false;
  const progress = h('b');
  const status = mount(h('div', { class: 'panel top-center', style: { top: '90px' } }, 'วางแล้ว ', progress));
  const done = () => pieces.filter((p) => p.obj.visible).length;
  const refresh = () => (progress.textContent = `${done()} / ${pieces.length} ชิ้น`);
  refresh();
  adv.say(pieces.length ? 'ช่วยกันยกเข้าที่ พื้นที่มีจำกัด ต้องเว้นทางเดินให้ลูกค้าด้วยนะ' : 'ร้านยังไม่มีที่นั่ง แต่ประหยัดเงินได้ เปิดร้านกันเลย', 'think');
  const driver = addChibi(stage, DRIVER, set.door.x, set.door.z - 0.2, 0);
  const me = addChibi(stage, CAST[G.playerKey], 3.4, -4.6, 0);
  let skipped = false;
  let finishing = false;

  const place = (p: (typeof pieces)[number]) => {
    p.obj.visible = true;
    sfx('pop');
    p.obj.scale.setScalar(0.01);
    void stage.tween(p.obj.scale, { x: 1, y: 1, z: 1 }, 380, backOut);
    refresh();
  };
  const hauler = async (who: Character, mine: typeof pieces, home: { x: number; z: number }) => {
    for (const p of mine) {
      if (skipped) return;
      const carry = F.cardboardBox(p.placement.id === 'sofa' || p.placement.id === 'table_long' ? 1.0 : 0.6, 0.45, 0.5);
      carry.position.set(0, 0.62, 0.42);
      who.root.add(carry);
      await walkTo(stage, who, p.placement.x, Math.min(p.placement.z + 1.0, 1.4), 8);
      carry.removeFromParent();
      if (skipped) return;
      place(p);
      await stage.wait(80);
      await walkTo(stage, who, home.x, home.z, 8);
    }
  };
  const finish = async () => {
    if (finishing) return;
    finishing = true;
    skip.remove();
    for (const p of pieces) if (!p.obj.visible) place(p);
    status.remove();
    driver.setExpr('happy');
    await walkTo(stage, driver, set.door.x, set.door.z, 4);
    driver.root.visible = false;
    me.setExpr('happy');
    me.hop(stage);
    sfx('done');
    const seats = seatCount(f);
    adv.say(
      pieces.length
        ? `เรียบร้อย ร้านมีที่นั่ง ${seats} ที่ ใช้พื้นที่ ${areaUsed(f).toFixed(1)}/${SEATING_AREA} ตร.ม. ลงทุนเฟอร์นิเจอร์ไป ${baht(totalCost(f))} ต้องขายให้คืนทุนนะ`
        : 'ร้านพร้อมแล้ว ไปเปิดร้านวันแรกกัน',
    );
    G.checkpoint = 'morning';
    saveGame();
    mount(h('div', 'bottom-center', firstDay ? btn('เปิดร้านวันแรก! ›', 'pink', () => go('shopDay'), 'big') : btn('กลับแผนที่ ›', 'pink', () => go('map'), 'big')));
  };
  const skip = mount(h('div', { class: 'top-right', style: { top: '76px' } }, btn('ข้าม ›', '', () => {
    skipped = true;
    void finish();
  }, 'small')));

  void (async () => {
    await stage.wait(700);
    // the driver and the owner each carry every other piece
    const mine = pieces.filter((_, i) => i % 2 === 0);
    const yours = pieces.filter((_, i) => i % 2 === 1);
    await walkTo(stage, driver, set.door.x, set.door.z + 1.2, 3);
    await Promise.all([hauler(driver, mine, { x: set.door.x, z: set.door.z + 1.2 }), hauler(me, yours, { x: 3.4, z: -4.6 })]);
    if (!skipped) await finish();
  })();
}
