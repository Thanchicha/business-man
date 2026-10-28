import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, Hud, modal, stepChip, stepper, toast } from '../ui/components';
import { go } from '../game/flow';
import { G } from '../sim/GameState';
import { INGREDIENTS, ING } from '../data/ingredients';
import { MENU } from '../data/menus';
import { cartTotal, cupsPossible, LATE_FEE, LOAN_LIMIT, LOAN_RATE_DAY, nextRentMorning, rentPerDay, stock, wagesPerDay } from '../sim/economy';
import { suggestion } from '../sim/shopping';
import { recipeOf, rivalsFor, STRENGTH_LABEL, SWEET_LABEL, VISITS_PER_MORNING, type Level } from '../sim/taste';
import { buildShop } from '../three/sets/interiors';
import { baht } from '../game/format';
import { sfx } from '../ui/sfx';
import { act, allReady, canDo, coopActive, isHost, me, myRole, on, resetReady, roleFilled, getPlayers } from '../coop/session';
import { rentStatus } from '../coop/actions';
import { ROLE, ROLES, type RoleId } from '../coop/roles';
import { ING_ICON, cupIcon } from './icons';
import { priceModal } from './pricing';
import { openNotebook } from './research';
import { openLobby, playersPanel } from './coopLobby';

const TIPS: Record<RoleId, string> = {
  cashier: 'ดูยอดขายเมื่อวานกับของที่เหลือก่อนซื้อนะ ของสดอย่างนมกับไข่มุกเก็บได้ไม่นาน แล้วอย่าลืมเก็บเงินไว้จ่ายค่าเช่าด้วย',
  barista: 'ลองอ่านข้อเสนอจากนักสำรวจ แล้วตัดสินใจว่าจะปรับสูตรไหม ลูกค้าแต่ละกลุ่มชอบหวาน/เข้มไม่เหมือนกันนะ',
  scout: 'ไปดูร้านคู่แข่งว่าเขาขายดีเพราะอะไร แล้วส่งข้อเสนอให้คนชง ตอนเปิดร้านไปสัมภาษณ์ลูกค้าเพิ่มได้อีก',
};

/** The team's morning: each player prepares their part, then the host opens the shop. */
export function coopMorningScreen(stage: Stage, data: { guest?: boolean } = {}): () => void {
  const set = buildShop(G.shopSize === 'catcafe', G.furniture);
  stage.add(set.group);
  const e = stage.engine;
  e.camera.position.set(2.5, 3.4, 6.5);
  e.look(-1, 1.2, 0);
  if (isHost() && !data.guest) resetReady();

  const hud = new Hud(`เช้าวันที่ ${G.day}`);
  stepChip('🌅', `เช้าวันที่ ${G.day} • เตรียมร้านด้วยกัน`, 'แต่ละคนเตรียมงานของตัวเอง พร้อมแล้วกด "พร้อม"');
  const cart: Record<string, number> = {};
  const mine = myRole();
  let tab: RoleId = mine ?? 'cashier';
  const tabs = h('div', 'tabs');
  const body = h('div');
  mount(h('div', { class: 'panel content morning-panel', style: { position: 'absolute', left: '20px', top: '120px', width: '600px', maxHeight: 'calc(100% - 140px)', overflowY: 'auto' } }, tabs, body));
  const side = h('div', 'col');
  mount(h('div', { class: 'panel col content', style: { position: 'absolute', right: '20px', top: '80px', width: '330px', maxHeight: 'calc(100% - 240px)', overflowY: 'auto' } }, side));
  const adv = new Advisor('bottom-right');
  adv.say(mine ? TIPS[mine] : 'ทุกคนช่วยกันเตรียมร้านได้เลย หน้าที่ไหนว่าง ใครก็ช่วยทำได้นะ', 'happy');

  const draw = () => {
    hud.refresh();
    tabs.replaceChildren(
      ...ROLES.map((r) => {
        const b = btn(`${r.icon} ${r.name}${r.id === mine ? ' ⭐' : ''}`, '', () => {
          tab = r.id;
          draw();
        }, 'small');
        b.classList.toggle('on', r.id === tab);
        return b;
      }),
    );
    const view = canDo(tab) ? '' : h('div', 'pill muted', `👀 ดูอย่างเดียว — หน้าที่ของ ${getPlayers().filter((p) => p.role === tab).map((p) => p.name).join(', ')}`);
    body.replaceChildren(view, tab === 'cashier' ? cashierTab() : tab === 'barista' ? baristaTab() : scoutTab());
    drawSide();
  };

  // ---------------------------------------------------------------- cashier
  function cashierTab(): HTMLElement {
    const can = canDo('cashier');
    const box = h('div', 'col');
    const rent = rentStatus(G);
    if (rent !== 'none') {
      box.append(
        h(
          'div',
          'promo on',
          h('b', {}, '🏠 เจ้าของที่มาเก็บค่าเช่า'),
          h('div', {}, `ค่าเช่าค้าง ${baht(G.rentDue)} • เงินสด ${baht(G.cash)}`),
          rent === 'evict'
            ? h('div', 'bad', 'ผัดมาแล้วรอบหนึ่ง และกู้เต็มวงเงินก็ยังไม่พอ... ต้องคืนพื้นที่ร้าน')
            : h('div', 'row wrap', lock(btn(`จ่าย ${baht(G.rentDue)}`, 'pink', () => act({ k: 'rent', how: 'pay' }), 'small'), can), G.rentLate === 0 ? lock(btn(`ขอผัด (ปรับ ${LATE_FEE * 100}%)`, '', () => act({ k: 'rent', how: 'delay' }), 'small'), can) : ''),
        ),
      );
    }
    const yesterday = G.history[G.history.length - 1];
    box.append(
      h('div', 'muted', yesterday ? `เมื่อวานขาย ${yesterday.cupsSold} แก้ว • รายได้ ${baht(yesterday.revenue)} • กำไร ${baht(yesterday.profit)}` : 'ยังไม่มียอดขาย'),
      h('div', 'muted', `ค่าใช้จ่ายประจำ: ค่าเช่า ${baht(rentPerDay(G))}/วัน • ค่าแรง ${baht(wagesPerDay(G))}/วัน • เจ้าของที่มาเก็บเช้าวันที่ ${rentStatus(G) === 'none' ? nextRentMorning(G.day) : G.day}`),
      h('h3', {}, '🧋 ทำได้กี่แก้ว'),
      h('div', 'row wrap', ...G.menus.map((id) => h('span', { class: `pill ${cupsPossible(G.inventory, id) ? '' : 'bad'}` }, `${MENU[id].short} ${cupsPossible(G.inventory, id)}`))),
      h('h3', {}, '🛒 สั่งวัตถุดิบ (ส่งถึงร้านก่อนเปิด)'),
    );
    const totalEl = h('b');
    const buy = lock(btn('สั่งซื้อ', 'mint', () => {
      act({ k: 'buy', cart: { ...cart } });
      for (const k of Object.keys(cart)) delete cart[k];
      sfx('coin');
    }, 'small'), can);
    const updateTotal = () => {
      const t = cartTotal(cart);
      totalEl.textContent = `รวม ${baht(t.net)}${t.discount ? ` (ลดจำนวนมาก ${baht(t.discount)})` : ''}`;
      buy.disabled = !can || !t.net;
    };
    const used = new Set([...G.menus.flatMap((m) => Object.keys(MENU[m].recipe)), 'pearls']);
    box.append(
      h(
        'table',
        { class: 'ledger', style: { fontSize: '14px' } },
        h('tr', 'muted', h('td', {}, 'วัตถุดิบ'), h('td', {}, 'มีอยู่'), h('td', {}, 'มิวแนะนำ'), h('td', {}, 'ราคา'), h('td', {}, 'สั่ง')),
        ...INGREDIENTS.filter((i) => used.has(i.id)).map((i) => {
          const s = suggestion(G, i);
          return h(
            'tr',
            {},
            h('td', {}, `${ING_ICON[i.id] ?? ''} ${i.name}`),
            h('td', stock(G.inventory, i.id) ? '' : 'bad', `~${stock(G.inventory, i.id)} แก้ว`),
            h('td', 'muted', s ? (s.high ? `${s.low}–${s.high}` : 'พอแล้ว') : '-'),
            h('td', {}, `${baht(i.price)}/${i.unit.split(' ')[0]}`),
            h('td', {}, can ? stepper(cart[i.id] ?? 0, (v) => ((cart[i.id] = v), updateTotal()), 0, 30) : '-'),
          );
        }),
      ),
      h('div', 'row', totalEl, buy),
    );
    updateTotal();
    box.append(
      h('h3', {}, '🏦 ธนาคาร'),
      h('div', 'muted', `เงินสด ${baht(G.cash)} • หนี้ ${baht(G.loan)} (ดอกเบี้ย ~${baht(Math.round(G.loan * LOAN_RATE_DAY))}/วัน) • ภาษีรอจ่าย ${baht(G.taxDue)}`),
      h(
        'div',
        'row wrap',
        lock(btn('กู้ ฿10,000', '', () => act({ k: 'borrow', n: 10000 }), 'small'), can && G.loan + 10000 <= LOAN_LIMIT),
        lock(btn('กู้ ฿30,000', '', () => act({ k: 'borrow', n: 30000 }), 'small'), can && G.loan + 30000 <= LOAN_LIMIT),
        lock(btn('คืน ฿10,000', '', () => act({ k: 'repay', n: 10000 }), 'small'), can && G.loan > 0 && G.cash >= Math.min(10000, G.loan)),
        lock(btn(`จ่ายภาษี ${baht(G.taxDue)}`, 'gold', () => act({ k: 'payTax' }), 'small'), can && G.taxDue > 0 && G.cash >= G.taxDue),
      ),
      h('h3', {}, '🏷️ ราคา & โปรโมชั่น'),
      lock(btn('ตั้งราคา & โปร', 'gold', () => priceModal('ราคาที่ตั้งจะใช้กับทั้งทีม', () => act({ k: 'pricing', prices: G.prices, delivery: G.delivery, promos: G.promos })), 'small'), can),
    );
    return box;
  }

  // ---------------------------------------------------------------- barista
  function baristaTab(): HTMLElement {
    const can = canDo('barista');
    const levels = (menuId: string, field: 'sweet' | 'strength', labels: string[]) =>
      h(
        'div',
        'row',
        ...labels.map((l, i) => {
          const on = recipeOf(G, menuId)[field] === i;
          return lock(btn(l, on ? 'lav' : '', () => act({ k: 'recipe', menuId, field, value: i as Level }), 'small'), can);
        }),
      );
    const fresh = G.coop.proposals.filter((p) => p.status === 'new');
    const old = G.coop.proposals.filter((p) => p.status !== 'new').slice(-5).reverse();
    return h(
      'div',
      'col',
      h('div', 'muted', 'สูตรประจำร้าน: ปรับให้ตรงกับที่ลูกค้าแถวนี้ชอบ ลูกค้ายังขอปรับแต่ละแก้วได้ตอนสั่ง'),
      h('h3', {}, `📨 ข้อเสนอจากนักสำรวจ (${fresh.length})`),
      ...(fresh.length
        ? fresh.map((p) =>
            h(
              'div',
              'promo on',
              h('b', {}, `${MENU[p.menuId].short}: ${(p.field === 'sweet' ? SWEET_LABEL : STRENGTH_LABEL)[p.value]}`),
              h('div', { style: { fontSize: '14px' } }, `จาก ${p.from}: ${p.reason}`),
              h('div', 'row', lock(btn('✓ ปรับสูตร', 'mint', () => act({ k: 'proposal', id: p.id, status: 'applied' }), 'small'), can), lock(btn('✕ ยังไม่ปรับ', '', () => act({ k: 'proposal', id: p.id, status: 'rejected' }), 'small'), can)),
            ),
          )
        : [h('div', 'muted', 'ยังไม่มีข้อเสนอใหม่')]),
      ...old.map((p) => h('div', { class: 'muted', style: { fontSize: '13px' } }, `${p.status === 'applied' ? '✓' : '✕'} ${MENU[p.menuId].short} ${(p.field === 'sweet' ? SWEET_LABEL : STRENGTH_LABEL)[p.value]} (${p.from})`)),
      h('h3', {}, '📋 สูตรเมนู'),
      h(
        'table',
        { class: 'ledger', style: { fontSize: '14px' } },
        ...G.menus.map((id) => h('tr', {}, h('td', {}, h('div', 'row', cupIcon(id, 34), MENU[id].short)), h('td', {}, levels(id, 'sweet', SWEET_LABEL), h('div', { style: { height: '4px' } }), levels(id, 'strength', STRENGTH_LABEL)))),
      ),
    );
  }

  // ---------------------------------------------------------------- scout
  function scoutTab(): HTMLElement {
    const can = canDo('scout');
    const used = G.coop.visitDay === G.day ? G.coop.visits : 0;
    const left = VISITS_PER_MORNING - used;
    const notes = [...G.coop.insights].reverse().slice(0, 14);
    const sent = new Set(G.coop.proposals.map((p) => p.reason));
    const menuSel = h('select', { class: 'role-select' }, ...G.menus.map((id) => h('option', { value: id }, MENU[id].short))) as HTMLSelectElement;
    const fieldSel = h('select', { class: 'role-select' }, ...SWEET_LABEL.map((l, i) => h('option', { value: `sweet:${i}` }, l)), ...STRENGTH_LABEL.map((l, i) => h('option', { value: `strength:${i}` }, l))) as HTMLSelectElement;
    return h(
      'div',
      'col',
      h('h3', {}, `🏪 สำรวจร้านคู่แข่ง (เหลือ ${left}/${VISITS_PER_MORNING} ร้านเช้านี้)`),
      ...rivalsFor(G).map((r) =>
        h(
          'div',
          'row promo',
          h('span', { style: { flex: '1' } }, h('b', {}, r.name), h('div', { class: 'muted', style: { fontSize: '13px' } }, `${r.area} • ★${r.rating} • ขึ้นชื่อ: ${r.famous}${G.coop.seen.includes(r.name) ? ' • เคยไปแล้ว' : ''}`)),
          lock(btn('ไปสำรวจ', 'mint', () => act({ k: 'visit', name: r.name }), 'small'), can && left > 0),
        ),
      ),
      h('div', 'row', btn('📒 สมุดสำรวจก่อนเปิดร้าน', '', () => openNotebook(), 'small')),
      h('h3', {}, '📝 บันทึกจากการสำรวจ/สัมภาษณ์'),
      ...(notes.length
        ? notes.map((n) =>
            h(
              'div',
              { style: { fontSize: '14px', borderTop: '1px dashed var(--line)', paddingTop: '4px' } },
              h('span', 'muted', `วัน ${n.day} • ${n.who}: `),
              n.text,
              n.menuId && n.field && n.value !== undefined && !sent.has(n.text)
                ? lock(btn('📨 ส่งให้คนชง', 'pink', () => act({ k: 'propose', menuId: n.menuId!, field: n.field!, value: n.value!, reason: n.text }), 'small'), can)
                : '',
            ),
          )
        : [h('div', 'muted', 'ยังไม่มีบันทึก ลองไปสำรวจร้านคู่แข่ง หรือสัมภาษณ์ลูกค้าตอนเปิดร้าน')]),
      h('h3', {}, '✍️ เขียนข้อเสนอเอง'),
      h(
        'div',
        'row wrap',
        menuSel,
        fieldSel,
        lock(btn('ส่งให้คนชง', 'pink', () => {
          const [field, v] = fieldSel.value.split(':');
          act({ k: 'propose', menuId: menuSel.value, field: field as 'sweet' | 'strength', value: Number(v) as Level, reason: 'นักสำรวจคิดว่าน่าลอง' });
          toast('ส่งข้อเสนอแล้ว', 'good');
        }, 'small'), can && G.menus.length > 0),
      ),
    );
  }

  // ---------------------------------------------------------------- team & opening
  function drawSide() {
    const rent = rentStatus(G);
    const self = me();
    const ready = btn(self?.ready ? '✓ พร้อมแล้ว' : 'พร้อม!', self?.ready ? 'mint' : 'pink', () => act({ k: 'ready', on: !self?.ready }));
    const empty = G.menus.filter((id) => cupsPossible(G.inventory, id) === 0);
    side.replaceChildren(
      h('h3', {}, '👥 ทีมวันนี้'),
      playersPanel(),
      btn('ห้อง & เปลี่ยนหน้าที่', '', () => openLobby(), 'small'),
      empty.length ? h('div', 'bad', `⚠ ${empty.map((id) => MENU[id].short).join(', ')} ไม่มีวัตถุดิบ`) : '',
      rent === 'due' ? h('div', 'bad', `🏠 ต้องจัดการค่าเช่าก่อนเปิดร้าน (${ROLE.cashier.icon} แคชเชียร์)`) : '',
    );
    if (!isHost()) return void side.append(ready, h('div', 'muted', 'เจ้าของร้านจะเปิดร้านเมื่อทุกคนพร้อม'));
    if (rent === 'evict') return void side.append(btn('ดูผลสรุป ›', 'pink', () => go('ending', { bankrupt: true, evicted: true }), 'big'));
    const open = btn('เปิดร้าน! ›', 'pink', () => {
      if (allReady()) return go('coopDay');
      const { close } = modal([h('h2', {}, 'ยังมีเพื่อนที่ไม่พร้อม'), h('p', {}, 'เปิดร้านเลยไหม?'), h('div', 'row', btn('รอก่อน', '', () => close()), btn('เปิดเลย', 'pink', () => (close(), go('coopDay'))))]);
    }, 'big');
    open.disabled = rent !== 'none' || !G.menus.length;
    side.append(h('div', 'muted', allReady() ? '✓ ทุกคนพร้อมแล้ว' : 'รอเพื่อนกดพร้อม...'), open);
    if (!coopActive()) side.append(btn('เล่นคนเดียวแบบปกติ', '', () => go('map'), 'small'));
  }

  draw();
  const offs = [on('state', draw), on('lobby', drawSide)];
  return () => offs.forEach((f) => f());
}

function lock(b: HTMLButtonElement, enabled: boolean): HTMLButtonElement {
  b.disabled = !enabled;
  return b;
}
