import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, stepChip, toast, playerName } from '../ui/components';
import { go } from '../game/flow';
import { G, setMenus } from '../sim/GameState';
import { MENUS, MENU, cupCost } from '../data/menus';
import { SHOP_SIZES, type ShopSize } from '../data/shopSizes';
import { LOCATIONS, dailyRent } from '../data/locations';
import { baht } from '../game/format';
import { islandBackdrop } from './common';
import { cupIcon } from './icons';
import { openNotebook } from './research';
import * as THREE from 'three';
import * as C from '../three/models/city';
import { snapshot } from '../three/portrait';

/** Step 1: what kind of shop. Only bubble tea is open in the demo. */
export function shopTypeScreen(stage: Stage): void {
  stage.engine.viewLocked = true;
  islandBackdrop(stage);
  stepChip(1, 'เลือกร้านที่อยากเปิด', 'ธุรกิจแรกของเรา จะเริ่มจากอะไรดี?');
  const adv = new Advisor('bottom-right');
  adv.say(`เริ่มจากคิดก่อนว่า "ลูกค้าคือใคร" และ "เงินทุนมีเท่าไหร่" ${playerName()} มีเงินทุน 180,000 บาท ร้านเล็กๆ ก็ใช้เงินเป็นแสนแล้วนะ ต้องเหลือไว้จ่ายมัดจำ ค่าเช่า และวัตถุดิบด้วย`);
  const shops: [string, string, string, string, boolean][] = [
    ['ร้านชานม + คาเฟ่แมว', 'ลงทุนไม่สูง เมนูหลากหลาย คนชอบทั้งชานมและน้องแมว', 'Bubble Tea', '#f27aa8', true],
    ['ร้านกาแฟ', '(ปลดล็อกในอนาคต)', 'Coffee', '#7a5a44', false],
    ['ร้านขนมหวาน', '(ปลดล็อกในอนาคต)', 'Bakery', '#e0a43a', false],
  ];
  const list = mount(h('div', { class: 'panel row content', style: { position: 'absolute', left: '20px', top: '130px', alignItems: 'stretch', gap: '14px', maxWidth: 'calc(100% - 40px)' } }));
  let picked = false;
  for (const [name, desc, sign, color, open] of shops) {
    const thumb = snapshot(`store|${sign}`, () => C.teaStore(color, { name: sign, w: 2.6 }), new THREE.Vector3(0, 1.25, 0), 6.4);
    const card = h(
      'div',
      { class: `card col ${open ? '' : 'locked'}`, style: { width: '210px', gap: '6px', textAlign: 'center', padding: '10px' } },
      h('img', { class: 'shop-thumb', src: thumb }),
      open ? null : h('div', 'lock', '🔒'),
      h('h3', {}, name),
      h('div', { class: 'muted', style: { fontSize: '15px' } }, desc),
    );
    card.addEventListener('click', () => {
      if (!open) return adv.say('ร้านนี้ยังไม่เปิดให้เล่นในเดโมนะ ลองร้านชานมก่อน', 'think');
      if (picked) return;
      picked = true;
      card.classList.add('sel');
      adv.say('ดีเลย! ชานมกำไรต่อแก้วดี ทำไม่ยาก ส่วนมุมแมวก็เป็นจุดเด่นที่ร้านอื่นไม่มี');
      setTimeout(() => go('invest'), 1500);
    });
    list.append(card);
  }
}

/** Step 2: start small (kiosk) or go big (cat café). */
export function investScreen(stage: Stage): void {
  stage.engine.viewLocked = true;
  islandBackdrop(stage);
  stepChip(2, 'ลงทุนแค่ไหนดี?', 'ลองเริ่มเล็กๆ ก่อน หรือจะลงเต็มที่ตั้งแต่แรก');
  const adv = new Advisor('bottom-right');
  adv.say('เงินต้องเหลือไว้ซื้อวัตถุดิบ จ่ายค่าเช่า ค่าแรง และเผื่อวันที่ขายไม่ดีด้วยนะ', 'think');
  const avgRent = LOCATIONS.reduce((s, l) => s + dailyRent(l), 0) / LOCATIONS.length;
  const row = mount(h('div', { class: 'row content', style: { position: 'absolute', left: '20px', top: '130px', alignItems: 'stretch', flexWrap: 'wrap', maxWidth: 'calc(100% - 520px)', minWidth: '560px' } }));
  let picked = false;
  (['kiosk', 'catcafe'] as ShopSize[]).forEach((id) => {
    const s = SHOP_SIZES[id];
    const rows: [string, string][] = [
      ['ค่าตกแต่ง/อุปกรณ์ (ครั้งเดียว)', baht(s.setup)],
      ['ค่าเช่า', `×${s.rentMult} (~${baht(avgRent * s.rentMult)}/วัน)`],
      ['ลูกค้า', s.demandMult > 1 ? 'มากกว่าปกติ' : 'น้อยกว่าปกติ'],
      ['ค่าดูแลแมว', s.upkeep ? `${baht(s.upkeep)}/วัน` : '-'],
      ['ค่าน้ำค่าไฟ', `~${baht(s.utilities * 30)}/เดือน`],
    ];
    const card = h(
      'div',
      { class: 'card col', style: { width: '330px', cursor: 'default' } },
      h('div', { style: { fontSize: '44px' } }, id === 'kiosk' ? '🏪' : '🏠🐈🐈‍⬛🐈'),
      h('h3', {}, s.name),
      h('div', 'muted', s.desc),
      h('table', 'ledger', ...rows.map(([k, v]) => h('tr', {}, h('td', 'muted', k), h('td', {}, v)))),
      h('div', 'good', `+ ${s.pros}`),
      h('div', 'bad', `− ${s.cons}`),
      btn('เลือกแบบนี้', id === 'kiosk' ? 'mint' : 'pink', () => {
        if (picked) return;
        picked = true;
        G.shopSize = id;
        G.cash -= s.setup;
        G.pendingSetup += s.setup;
        adv.say(
          id === 'kiosk'
            ? 'เริ่มเล็กๆ ลองตลาดก่อนก็ดีนะ ถ้าไปได้ดีค่อยขยายทีหลัง'
            : 'คาเฟ่แมวเป็นจุดขายที่ดี แต่ลงทุนเยอะ ต้องขายให้ได้มากขึ้นถึงจะคืนทุนนะ',
        );
        toast(`จ่ายค่าตกแต่ง ${baht(s.setup)} • เหลือเงิน ${baht(G.cash)}`);
        setTimeout(() => go('townMap'), 1800);
      }),
    );
    row.append(card);
  });
}

/** Step 3: tick which drinks to sell. */
export function menuSelectScreen(stage: Stage): void {
  islandBackdrop(stage);
  stepChip(5, 'เลือกเมนูที่ต้องการขาย', 'ดูจากสมุดสำรวจว่าลูกค้าแถวนี้ชอบอะไร แล้วติ๊กเมนูที่อยากขาย');
  const adv = new Advisor('bottom-right');
  adv.say('เริ่มที่ 3–5 เมนูก็พอ เปิดสมุดสำรวจดูว่าลูกค้าแถวนี้ชอบอะไร จ่ายได้เท่าไหร่ แล้วดู "ต้นทุนต่อแก้ว" ประกอบด้วยนะ', 'think');
  mount(h('div', { class: 'top-right', style: { top: '20px' } }, btn('📒 สมุดสำรวจ', 'gold', openNotebook, 'small')));
  const chosen = new Set(G.menus);
  const grid = mount(h('div', { class: 'content menu-grid', style: { position: 'absolute', left: '20px', right: '310px', top: '120px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', maxWidth: '760px' } }));
  const summary = h('div', { style: { lineHeight: '1.7' } });
  const confirm = btn('ถัดไป ›', 'pink', () => {
    setMenus([...chosen]);
    go('market');
  }, 'big');
  const refresh = () => {
    const ids = [...chosen];
    const ings = new Set(ids.flatMap((id) => Object.keys(MENU[id].recipe)));
    summary.replaceChildren(
      ...(ids.length ? ids.map((id) => h('div', {}, `• ${MENU[id].name}`)) : [h('div', 'muted', 'ยังไม่ได้เลือก')]),
      h('div', { class: 'muted', style: { marginTop: '10px' } }, `รวม ${ids.length} เมนู • วัตถุดิบ ${ings.size} อย่าง`),
    );
    confirm.disabled = ids.length === 0;
    if (ids.length >= 7) adv.say('เมนูเยอะไปหรือเปล่า? ยิ่งเมนูเยอะ ยิ่งต้องสต็อกของหลายอย่าง ชงช้าลง และของเสียง่ายขึ้นนะ', 'surprised');
  };
  for (const m of MENUS.filter((x) => !x.signature)) {
    const card = h(
      'div',
      { class: `card ${chosen.has(m.id) ? 'sel' : ''}`, style: { textAlign: 'center', padding: '12px' } },
      h('div', 'check', '✓'),
      cupIcon(m.id, 90),
      h('div', { style: { fontWeight: 600 } }, m.name),
      h('div', { style: { color: 'var(--pink-dark)' } }, `ขาย ${baht(m.basePrice)}`),
      h('div', { class: 'muted', style: { fontSize: '15px' } }, `ต้นทุน ~${baht(cupCost(m.id))}/แก้ว`),
    );
    card.addEventListener('click', () => {
      if (chosen.has(m.id)) chosen.delete(m.id);
      else chosen.add(m.id);
      card.classList.toggle('sel', chosen.has(m.id));
      refresh();
    });
    grid.append(card);
  }
  mount(h('div', { class: 'panel col dock', style: { position: 'absolute', right: '20px', top: '120px', width: '270px' } }, h('h3', {}, '🧋 เมนูที่เลือกแล้ว'), summary, confirm));
  refresh();
}
