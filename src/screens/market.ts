import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, Hud, modal, polite, stepper, toast, playerName } from '../ui/components';
import { go } from '../game/flow';
import { CAST } from '../game/specs';
import { G, saveGame } from '../sim/GameState';
import { ING, INGREDIENTS } from '../data/ingredients';
import { MENU } from '../data/menus';
import { addPurchase, bulkDiscount, cartTotal, haggle, HAGGLE_RATE, stock } from '../sim/economy';
import { suggestion } from '../sim/shopping';
import { buildMarket, type MarketStation } from '../three/sets/interiors';
import { addChibi } from './common';
import { baht } from '../game/format';
import { ING_ICON } from './icons';
import { sfx } from '../ui/sfx';
import type { Character } from '../three/models/miyu';

const TIPS: Record<string, string> = {
  dairy: 'นมสดกับน้ำแข็งเสียไว ซื้อแค่พอใช้นะ ถ้าซื้อเยอะเพื่อเอาส่วนลดแล้วเหลือทิ้ง จะขาดทุนแทน',
  tea: 'ของแห้งเก็บได้นาน ซื้อเยอะเพื่อเอาส่วนลดก็คุ้ม แต่เงินจะไปจมอยู่กับสต็อกนะ',
  syrup: 'ไซรัปเก็บได้นาน ซื้อเผื่อไว้ได้',
  topping: 'ไข่มุกต้มแล้วเก็บได้ 3 วัน ดูด้วยว่าเมนูไหนใช้ไข่มุกบ้าง',
  supply: 'ทุกเมนูต้องใช้แก้ว อย่าลืมซื้อนะ',
};

export function marketScreen(stage: Stage): () => void {
  G.checkpoint = 'morning';
  saveGame();
  const set = buildMarket();
  stage.add(set.group);
  const cashier = set.group.userData.cashier as Character;
  stage.onUpdate((dt) => cashier.update(dt));
  const me = addChibi(stage, CAST[G.playerKey], set.start.x, set.start.z, Math.PI);
  const cam = stage.engine.camera;
  const cart: Record<string, number> = {};
  let haggled = false;
  let bonus = 0;
  let modalOpen = false;
  let target: { x: number; z: number; station?: MarketStation } | null = null;
  const keys = new Set<string>();

  const hud = new Hud(G.day === 1 ? 'ซูเปอร์มาร์เก็ต' : `เช้าวันที่ ${G.day} • ซื้อของ`);
  const adv = new Advisor('bottom-left');
  adv.say(
    G.day === 1
      ? 'ถึงซูเปอร์แล้ว เดินไปที่ชั้นที่มีเครื่องหมาย ! เพื่อซื้อวัตถุดิบ แล้วไปจ่ายเงินที่แคชเชียร์นะ'
      : `เช้าวันที่ ${G.day} แล้ว เช็กของที่เหลือก่อนซื้อเพิ่มนะ ของสดเมื่อวานอาจเสียไปแล้ว`,
  );
  const list = h('div', { style: { lineHeight: '1.75', fontSize: '15px' } });
  const total = h('div', { style: { marginTop: '8px', fontWeight: 500 } });
  mount(h('div', { class: 'panel side-list', style: { position: 'absolute', right: '20px', top: '80px', width: '300px' } }, h('h3', {}, 'รายการที่ควรซื้อ (แนะนำ)'), h('div', { class: 'muted', style: { fontSize: '15px' } }, 'ช่วงจำนวนจาก มิว • 🛒 = ในรถเข็น'), list, total));
  /** Ingredients the chosen menus need that are neither in stock nor in the cart. */
  const missingNow = () =>
    [...new Set(G.menus.flatMap((m) => Object.keys(MENU[m].recipe)))].filter((i) => stock(G.inventory, i) === 0 && !(cart[i] > 0));
  /** Menus that can't be made at all while those ingredients are missing. */
  const blockedMenus = (missing: string[]) => G.menus.filter((m) => Object.keys(MENU[m].recipe).some((i) => missing.includes(i)));
  const refresh = () => {
    const missing = missingNow();
    list.replaceChildren(
      ...INGREDIENTS.flatMap((ing) => {
        const s = suggestion(G, ing);
        const n = cart[ing.id] ?? 0;
        if (!s && !n) return [];
        const range = !s ? '-' : s.high === 0 ? 'มีพอแล้ว' : s.low === s.high ? `${s.high}` : `${s.low}–${s.high}`;
        const lacking = missing.includes(ing.id);
        return [
          h(
            'div',
            { class: `row ${lacking ? 'bad' : ''}`, title: lacking ? 'ยังไม่มีของชิ้นนี้เลย' : '' },
            h('span', {}, lacking ? '⚠️' : ING_ICON[ing.id]),
            h('span', { style: { flex: '1', fontWeight: lacking ? 600 : 400 } }, ing.name),
            h('span', lacking ? 'bad' : 'muted', range),
            h('b', { style: { minWidth: '40px', textAlign: 'right' } }, `🛒${n}`),
          ),
        ];
      }),
    );
    if (missing.length) list.append(h('div', { class: 'bad', style: { fontSize: '15px', marginTop: '6px' } }, `⚠️ ยังขาด ${missing.length} อย่าง (สีแดง)`));
    else list.append(h('div', { class: 'good', style: { fontSize: '15px', marginTop: '6px' } }, '✓ วัตถุดิบครบทุกเมนูแล้ว'));
    const t = cartTotal(cart);
    const net = Math.round(t.net * (1 - bonus));
    total.innerHTML = `รวม ${baht(t.gross)}${t.discount ? ` <span class="good">ลด ${baht(t.gross - net)}</span>` : ''}<br>จ่ายจริง <b class="${net > G.cash ? 'bad' : ''}">${baht(net)}</b> / มี ${baht(G.cash)}`;
  };
  refresh();

  // markers over the shelves
  for (const st of set.stations) {
    const needed = st.items.some((i) => G.menus.some((m) => MENU[m].recipe[i]));
    stage.label(st.obj, h('div', { class: 'col', style: { alignItems: 'center', gap: '2px' } }, needed || st.id === 'checkout' ? h('div', 'mark3d', st.id === 'checkout' ? '$' : '!') : null, h('div', 'tag3d', st.label)), st.id === 'dairy' ? 2.3 : 1.9);
    stage.click(st.obj, () => {
      if (modalOpen) return;
      target = { x: st.front.x, z: st.front.z, station: st };
    });
  }
  const prompt = stage.label(me.root, h('div', 'tag3d', 'กด E / คลิกชั้นวาง'), 2.1);

  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  stage.engine.onMiss = (ray) => {
    if (modalOpen) return;
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(floorPlane, p)) target = { x: p.x, z: p.z };
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.type === 'keydown') {
      keys.add(e.key.toLowerCase());
      if ((e.key === 'e' || e.key === 'E') && near && !modalOpen) open(near);
    } else keys.delete(e.key.toLowerCase());
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  const blocked = (x: number, z: number) => {
    const [x0, z0, x1, z1] = set.bounds;
    if (x < x0 || x > x1 || z < z0 || z > z1) return true;
    return set.walls.some(([a, b, c, d]) => x > a - 0.3 && x < c + 0.3 && z > b - 0.3 && z < d + 0.3);
  };
  let near: MarketStation | null = null;
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
    }
    const len = Math.hypot(vx, vz);
    me.walking = len > 0;
    if (len) {
      const sp = 3.4 * dt;
      const p = me.root.position;
      const nx = p.x + (vx / len) * sp;
      const nz = p.z + (vz / len) * sp;
      let moved = false;
      if (!blocked(nx, p.z)) {
        p.x = nx;
        moved = true;
      }
      if (!blocked(p.x, nz)) {
        p.z = nz;
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
    near = set.stations.find((s) => s.front.distanceTo(me.root.position) < 1.1) ?? null;
    prompt.style.visibility = near && !modalOpen ? 'visible' : 'hidden';
    const p = me.root.position;
    cam.position.lerp(new THREE.Vector3(p.x * 0.6, 9.5, p.z + 8.5), 0.08);
    stage.engine.look(p.x * 0.8, 0.8, p.z - 1);
  });
  cam.position.set(set.start.x * 0.6, 9.5, set.start.z + 8.5);

  function open(st: MarketStation) {
    if (modalOpen) return;
    me.root.rotation.y = Math.PI;
    if (st.id === 'checkout') checkout();
    else shelf(st);
  }

  function shelf(st: MarketStation) {
    modalOpen = true;
    adv.say(TIPS[st.id] ?? '', 'think');
    const rows = st.items.map((id) => {
      const ing = ING[id];
      const s = suggestion(G, ing);
      const disc = h('small', 'good');
      const showDisc = (n: number) => (disc.textContent = bulkDiscount(n) ? ` ลด ${bulkDiscount(n) * 100}%` : '');
      showDisc(cart[id] ?? 0);
      return h(
        'div',
        { class: 'row', style: { padding: '10px', borderRadius: '14px', background: '#fff6fa', marginTop: '8px' } },
        h('div', { style: { fontSize: '34px', width: '48px', textAlign: 'center' } }, ING_ICON[id]),
        h(
          'div',
          { style: { flex: '1' } },
          h('b', { style: { color: s ? 'var(--ink)' : 'var(--ink-soft)' } }, `${ing.name} (${ing.unit})`),
          h('div', { class: 'muted', style: { fontSize: '15px' } }, `${baht(ing.price)} • พอสำหรับ ~${ing.servings} แก้ว${ing.note ? ` • ${ing.note}` : ''}`),
          h('div', { class: 'muted', style: { fontSize: '15px' } }, `ที่ร้านมีอยู่ ~${stock(G.inventory, id)} แก้ว${s ? '' : ' • เมนูที่เลือกไม่ได้ใช้'}`),
        ),
        h('div', 'col', stepper(cart[id] ?? 0, (n) => {
          cart[id] = n;
          showDisc(n);
          refresh();
        }, 0, 40), disc),
      );
    });
    const { close } = modal([h('h2', {}, `${st.label}`), h('div', 'good', 'ซื้อ 5 ชิ้นขึ้นไป ลด 5% • 10 ชิ้นขึ้นไป ลด 10%'), ...rows, h('div', { style: { textAlign: 'center', marginTop: '14px' } }, btn('ใส่รถเข็น ✓', 'mint', () => close()))], {
      width: '640px',
      onClose: () => {
        modalOpen = false;
        refresh();
      },
    });
  }

  function checkout() {
    modalOpen = true;
    const t0 = cartTotal(cart);
    const net = () => Math.round(t0.net * (1 - bonus));
    const lines = Object.entries(cart)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => h('div', 'row', h('span', {}, ING_ICON[id]), h('span', { style: { flex: '1' } }, `${ING[id].name} × ${n}`), h('span', {}, baht(ING[id].price * n)), bulkDiscount(n) ? h('small', 'good', `−${bulkDiscount(n) * 100}%`) : null));
    const totals = h('div', { style: { fontSize: '20px', marginTop: '12px' } });
    const draw = () => (totals.innerHTML = `ราคาเต็ม ${baht(t0.gross)} • ส่วนลด <span class="good">${baht(t0.gross - net())}</span><br>ยอดที่ต้องจ่าย <b>${baht(net())}</b>`);
    draw();
    const missing = missingNow();
    const blocked = blockedMenus(missing);
    const warn = missing.length
      ? h(
          'div',
          { class: 'panel', style: { background: '#fff1f3', borderColor: '#f6b8c4', marginTop: '12px', padding: '12px 14px' } },
          h('b', 'bad', `⚠️ ยังขาด: ${missing.map((i) => `${ING_ICON[i]} ${ING[i].name}`).join(', ')}`),
          h('div', { style: { fontSize: '15px', marginTop: '4px' } }, blocked.length === G.menus.length ? 'ถ้าไม่ซื้อ จะทำเครื่องดื่มไม่ได้เลยสักเมนู!' : `ถ้าไม่ซื้อ จะขายเมนูเหล่านี้ไม่ได้: ${blocked.map((m) => MENU[m].short).join(', ')}`),
          h(
            'div',
            { class: 'row', style: { marginTop: '8px' } },
            btn('➕ ใส่ของที่ขาดลงรถเข็น', 'mint', () => {
              for (const i of missing) cart[i] = Math.max(1, suggestion(G, ING[i])?.low ?? 1);
              toast(`เพิ่ม ${missing.map((i) => ING[i].name).join(', ')} ลงรถเข็นแล้ว`, 'good');
              close();
              checkout();
            }, 'small'),
          ),
        )
      : h('div', { class: 'good', style: { marginTop: '10px' } }, '✓ วัตถุดิบครบทุกเมนูแล้ว');
    if (missing.length) adv.say(`ยังไม่ได้หยิบ ${missing.map((i) => ING[i].name).join(', ')} เลยนะ ไม่มีของจะชงไม่ได้`, 'surprised');
    const pay = btn(`จ่ายเงิน ${baht(net())}`, 'pink', () => {
      const bill = net();
      if (bill > G.cash) return;
      if (missingNow().length) return confirmLeave(() => finish(bill));
      finish(bill);
    }, 'big');
    /** Ask before leaving with ingredients missing; going back keeps the cart. */
    const confirmLeave = (onYes: () => void) => {
      const m = missingNow();
      const { close: closeAsk } = modal(
        [
          h('h2', {}, 'ยังซื้อของไม่ครบนะ!'),
          h('p', {}, `ยังขาด ${m.map((i) => `${ING_ICON[i]} ${ING[i].name}`).join(', ')}`),
          h('p', 'bad', blockedMenus(m).length === G.menus.length ? 'ถ้าออกไปตอนนี้ วันนี้จะขายอะไรไม่ได้เลย' : `วันนี้จะขาย ${blockedMenus(m).map((x) => MENU[x].short).join(', ')} ไม่ได้`),
          h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, btn('กลับไปซื้อให้ครบ', 'pink', () => {
            closeAsk();
            close();
          }, 'big'), btn('จ่ายเงินและออกจากร้านเลย', '', () => {
            closeAsk();
            onYes();
          })),
        ],
        { width: '520px' },
      );
    };
    const finish = (bill: number) => {
      for (const [id, n] of Object.entries(cart)) addPurchase(G.inventory, id, n, G.day);
      G.cash -= bill;
      G.pendingShopping += bill;
      sfx('coin');
      close();
      hud.refresh();
      leave(bill);
    };
    pay.disabled = net() > G.cash;
    const hag = btn(haggled ? 'ต่อราคาไปแล้ว' : `ขอลดหน่อยได้ไหม${polite()}?`, 'gold', () => {
      haggled = true;
      hag.disabled = true;
      hag.textContent = 'ต่อราคาไปแล้ว';
      const r = haggle(t0.net, Math.random());
      if (r === 'success') {
        bonus = HAGGLE_RATE;
        sfx('coin');
        toast('แคชเชียร์: "ซื้อเยอะขนาดนี้ ลดให้อีก 5% ละกัน!"', 'good');
        adv.say('เห็นไหม ซื้อเยอะแล้วลองต่อราคา บางทีก็ได้ส่วนลดเพิ่ม เป็นทักษะสำคัญของเจ้าของร้านนะ');
        cashier.setExpr('happy');
      } else {
        sfx('bad');
        cashier.setExpr('sad');
        toast(r === 'fail' ? 'แคชเชียร์: "ขอโทษนะคะ ราคานี้ต่ำสุดแล้ว"' : 'แคชเชียร์: "ยอดแค่นี้ลดไม่ได้จริงๆ ค่ะ"', 'bad');
        adv.say(r === 'fail' ? 'ไม่ได้ก็ไม่เป็นไร ลองแล้วไม่เสียอะไร' : 'ร้านค้ามักลดให้เมื่อซื้อเยอะ (1,500 บาทขึ้นไป) ซื้อน้อยก็ต่อยากหน่อยนะ', 'think');
      }
      draw();
      pay.textContent = `จ่ายเงิน ${baht(net())}`;
      pay.disabled = net() > G.cash;
    });
    hag.disabled = haggled || t0.net === 0;
    if (t0.net === 0) adv.say(`ยังไม่ได้หยิบอะไรเลยนะ ${playerName()} ไม่มีวัตถุดิบก็ขายไม่ได้`, 'surprised');
    const { close } = modal([h('h2', {}, '🧾 แคชเชียร์'), ...(lines.length ? lines : [h('div', 'muted', 'ยังไม่มีของในรถเข็น')]), totals, warn, h('div', { class: 'row', style: { marginTop: '16px', justifyContent: 'center' } }, btn('กลับไปเลือกต่อ', '', () => close()), hag, pay)], {
      width: '600px',
      onClose: () => {
        modalOpen = false;
        refresh();
      },
    });
  }

  function leave(bill: number) {
    modalOpen = true;
    const missing = G.menus.filter((m) => Object.keys(MENU[m].recipe).some((i) => stock(G.inventory, i) === 0));
    adv.say(
      missing.length
        ? `${missing.map((m) => MENU[m].short).join(', ')} ยังขาดวัตถุดิบอยู่ ทำเมนูนี้ไม่ได้จนกว่าจะซื้อ แต่จะเปิดร้านแบบนี้ก็ได้`
        : `เรียบร้อย ใช้ไป ${baht(bill)} เงินนี้คือ "ต้นทุน" ที่ต้องขายให้ได้คืนนะ`,
      missing.length ? 'think' : 'happy',
    );
    setTimeout(() => go(G.history.length === 0 && !G.strategy ? 'hire' : 'map'), 2800);
  }

  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  };
}
