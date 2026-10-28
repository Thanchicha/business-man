import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import * as THREE from 'three';
import { Advisor, DialogBox, Hud, modal, toast, type Line, playerName } from '../ui/components';
import { bubbleTea } from '../three/models/props';
import { buildShop, buildStreet } from '../three/sets/interiors';
import { buildTerrace } from '../three/sets/terrace';
import { go } from '../game/flow';
import { CAST } from '../game/specs';
import { clearSave, DEMO_DAYS, G, saveGame, type DayLog } from '../sim/GameState';
import { MENU, MENUS } from '../data/menus';
import { STAFF, dailyWage } from '../data/staff';
import { eveningAdvice } from '../agents/advisor';
import { expiringOn, netWorth, nextRentMorning, ratingAll } from '../sim/economy';
import { ING } from '../data/ingredients';
import { ING_ICON } from './icons';
import { baht } from '../game/format';
import { sfx } from '../ui/sfx';
import { addCat, addChibi } from './common';
import { priceModal } from './pricing';
import { cupIcon } from './icons';
import { act, coopActive, leaveRoom } from '../coop/session';

export function summaryScreen(stage: Stage, data: { log: DayLog; guest?: boolean }): void {
  const log = data.log;
  const set = buildShop(G.shopSize === 'catcafe', G.furniture);
  stage.add(set.group);
  const e = stage.engine;
  e.setSky('#3a3060', false);
  e.hemi.intensity = 0.9;
  e.sun.intensity = 0.8;
  e.camera.position.set(2.5, 3.4, 6.5);
  e.look(-1, 1.2, 0);
  if (G.shopSize === 'catcafe') addCat(stage, 0, 0.8, 2.8, -0.3);

  new Hud(`สรุปวันที่ ${log.day}`);
  const row = (label: string, v: number, strong = false) =>
    v || strong ? h('tr', {}, h('td', 'muted', label), h('td', { class: v >= 0 ? 'good' : '' }, `${v >= 0 ? '' : '−'}${baht(Math.abs(v))}`)) : null;
  const profit = h('td', { class: log.profit >= 0 ? 'good' : 'bad' }, '฿0');
  mount(
    h(
      'div',
      { class: 'panel content', style: { position: 'absolute', left: '20px', top: '76px', width: '380px', maxHeight: 'calc(100% - 180px)', overflowY: 'auto' } },
      h('h3', {}, '📒 สรุปผลประกอบการ'),
      h('div', { class: 'muted', style: { fontSize: '15px', marginBottom: '8px' } }, `จบวันที่ ${log.day} แล้ว! บัญชีทำให้อัตโนมัติ`),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
        h('div', 'stat-tile', '🪙 รายรับ', h('strong', 'tile-num', baht(log.revenue))),
        h('div', 'stat-tile', '🧾 ค่าใช้จ่าย', h('strong', 'tile-num', baht(log.revenue - log.profit))),
      ),
      h(
        'table',
        'ledger',
        row(`รายได้ (ขาย ${log.cupsSold} แก้ว${log.deliveryOrders ? ` • เดลิเวอรี่ ${log.deliveryOrders} ออเดอร์` : ''})`, log.revenue, true),
        row('ค่า GP แอปเดลิเวอรี่ (30% + VAT)', -log.deliveryFee),
        row('ต้นทุนวัตถุดิบที่ใช้', -log.cogs),
        row('ของเสีย/ทิ้ง', -log.waste),
        row('ค่าแรงพนักงาน', -log.wages),
        row('ค่าเช่าที่ (ค้างจ่ายเจ้าของที่)', -log.rent),
        row('ค่าดูแลน้องแมว', -log.upkeep),
        row('ค่าน้ำค่าไฟ', -(log.utilities ?? 0)),
        row('ดอกเบี้ยเงินกู้', -log.interest),
        row('ภาษีเงินได้ (กันไว้จ่ายธนาคาร)', -log.tax),
        row('ค่าลงทุน/ตกแต่ง', -log.setup),
        h('tr', 'total', h('td', {}, log.profit >= 0 ? 'กำไร' : 'ขาดทุน'), profit),
      ),
      h('div', { class: 'muted', style: { fontSize: '15px', marginTop: '8px' } }, `จ่ายค่าซื้อของไปแล้ว ${baht(log.shopping)} (นับเป็นต้นทุนเมื่อใช้หรือทิ้ง)`, h('br'), `เงินสดคงเหลือ ${baht(G.cash)}`, h('br'), h('span', 'bad', `ค่าเช่าค้างจ่าย ${baht(G.rentDue)} • เจ้าของที่มาเก็บเช้าวันที่ ${nextRentMorning(log.day)}`), G.taxDue || G.loan ? h('br') : '', G.taxDue ? `ภาษีรอจ่าย ${baht(G.taxDue)} ` : '', G.loan ? `• หนี้ธนาคาร ${baht(G.loan)}` : ''),
      wasteBox(log),
    ),
  );
  let shown = 0;
  stage.onUpdate((dt) => {
    if (shown === log.profit) return;
    shown = Math.abs(log.profit - shown) < 5 ? log.profit : shown + (log.profit - shown) * Math.min(1, dt * 4);
    profit.textContent = `${shown < 0 ? '−' : ''}${baht(Math.abs(shown))}`;
  });

  const f = log.feedback;
  const voices = [
    `ลูกค้าที่ได้รับเครื่องดื่ม ${log.served} คน • เสียไป ${log.lost} คน`,
    f.compliment && `♥ ชมว่าอร่อย/ประทับใจ ${f.compliment} คน`,
    f.expensive && `฿ บอกว่าแพง ${f.expensive} คน`,
    f.slow + f.leftAngry && `⏱ รอนาน/เดินหนี ${f.slow + f.leftAngry} คน`,
    f.closed && `🚪 มาไม่ทันร้านปิด ${f.closed} คน`,
    f.wrongOrder && `🧋 ได้เครื่องดื่มไม่ตรงที่สั่ง ${f.wrongOrder} คน`,
    f.noSeat && `🪑 อยากนั่งแต่ที่นั่งเต็ม ${f.noSeat} คน`,
    log.deliveryCancelled && `📱 ออเดอร์เดลิเวอรี่ถูกยกเลิก (ของหมด) ${log.deliveryCancelled} ออเดอร์`,
    f.custom && `✎ ขอปรับสูตร (หวานน้อย ฯลฯ) ${f.custom} คน`,
    f.outOfStock && `✕ เมนูที่อยากได้หมด ${f.outOfStock} คน`,
    ...Object.entries(log.requests).map(([k, n]) => `💡 อยากให้มี "${k}" ${n} คน`),
  ].filter(Boolean) as string[];
  const sales = Object.entries(log.sales).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...sales.map(([, n]) => n));
  const repChange = log.repAfter - log.repBefore;
  mount(
    h(
      'div',
      { class: 'panel content', style: { position: 'absolute', left: '420px', top: '76px', width: '380px', maxHeight: 'calc(100% - 180px)', overflowY: 'auto' } },
      reviewsBox(log),
      h('h3', { style: { marginTop: '12px' } }, '💬 เสียงจากลูกค้า'),
      ...voices.map((v) => h('div', { style: { fontSize: '15px', lineHeight: '1.7' } }, v)),
      h('h3', { style: { marginTop: '12px' } }, 'ยอดขายแต่ละเมนู'),
      ...sales.slice(0, 5).map(([id, n]) => h('div', 'row', cupIcon(id, 32), h('span', { style: { width: '90px', fontSize: '15px' } }, MENU[id].short), h('div', { class: 'bar', style: { flex: '1' } }, h('i', { style: { width: `${(n / max) * 100}%`, background: MENU[id].color } })), h('b', {}, `${n} แก้ว`))),
      h('div', { class: repChange >= 0 ? 'good' : 'bad', style: { marginTop: '10px' } }, `ชื่อเสียงร้าน ${log.repAfter.toFixed(1)} ★ (${repChange >= 0 ? '+' : ''}${repChange.toFixed(2)})`),
    ),
  );

  const adv = new Advisor('bottom-right');
  adv.el.style.bottom = '96px';
  const advice = eveningAdvice(G, log);
  let i = 0;
  adv.say(advice[0], log.profit >= 0 ? 'happy' : 'think');
  const more = btn(`ฟัง มิว ต่อ ▶ (1/${advice.length})`, '', () => {
    i = (i + 1) % advice.length;
    adv.say(advice[i], 'think');
    more.textContent = `ฟัง มิว ต่อ ▶ (${i + 1}/${advice.length})`;
  }, 'small');
  const bankrupt = G.cash < 0;
  const last = log.day >= DEMO_DAYS;
  if (data.guest) {
    mount(h('div', { class: 'bottom-right row dock' }, more, h('span', 'pill', '⏳ รอเจ้าของร้านไปต่อ...')));
    sfx(log.profit >= 0 ? 'done' : 'bad');
    return;
  }
  mount(
    h(
      'div',
      { class: 'bottom-right row dock' },
      more,
      btn('ปรับราคา', '', () => priceModal('ลองดูจากเสียงลูกค้าวันนี้ แล้วค่อยปรับนะ', () => toast('บันทึกราคาใหม่แล้ว'))),
      btn('จัดการร้าน', '', manage),
      btn('ไปต่อ ›', 'pink', () => {
        go('night', { log, bankrupt, last });
      }, 'big'),
    ),
  );
  sfx(log.profit >= 0 ? 'done' : 'bad');
}

/** What spoiled tonight, item by item, and what will spoil tomorrow if not sold. */
function wasteBox(log: DayLog): HTMLElement {
  const items = Object.entries(log.wasteItems ?? {}).sort((a, b) => b[1].value - a[1].value);
  const tomorrow = Object.entries(expiringOn(G.inventory, log.day + 1)).filter(([ing]) => ing !== 'ice');
  const usedBy = (ing: string) => G.menus.filter((id) => MENU[id].recipe[ing]).map((id) => MENU[id].short).join(', ');
  return h(
    'div',
    { style: { marginTop: '10px' } },
    h('h3', {}, '🗑️ ของเสียที่ต้องทิ้งคืนนี้'),
    items.length
      ? h(
          'table',
          { class: 'ledger', style: { fontSize: '14px' } },
          h('tr', 'muted', h('td', {}, 'วัตถุดิบ'), h('td', {}, 'จำนวน'), h('td', {}, 'มูลค่า')),
          ...items.map(([ing, d]) => h('tr', {}, h('td', {}, `${ING_ICON[ing] ?? ''} ${ING[ing].name}`), h('td', {}, `~${d.servings} แก้ว (${(d.servings / ING[ing].servings).toFixed(1)} ${ING[ing].unit.split(' ')[0]})`), h('td', 'bad', `−${baht(d.value)}`))),
        )
      : h('div', 'good', '✓ ไม่มีของเสียเลย เยี่ยม!'),
    items.some(([ing]) => ing === 'ice') ? h('div', { class: 'muted', style: { fontSize: '13px' } }, 'น้ำแข็งละลายทุกคืน ซื้อให้พอดีกับที่คาดว่าจะขาย') : '',
    tomorrow.length
      ? h(
          'div',
          { class: 'bad', style: { fontSize: '14px', marginTop: '6px' } },
          h('b', {}, '⏰ ต้องขายให้หมดภายในพรุ่งนี้'),
          ...tomorrow.map(([ing, n]) => h('div', {}, `${ING[ing].name} ~${n} แก้ว → ใช้ทำ ${usedBy(ing) || 'ไม่มีเมนูที่ใช้!'}`)),
          h('div', 'muted', 'ลองเปิดโปร "โละของใกล้เสีย" หรือซื้อของสดเพิ่มให้น้อยลง'),
        )
      : '',
  );
}

const stars = (n: number): string => (n ? `${n.toFixed(2)} ★` : '-');

/** Today's reviews and the running average, day by day. */
function reviewsBox(log: DayLog): HTMLElement {
  const today = log.reviewCount ? log.reviewSum / log.reviewCount : 0;
  return h(
    'div',
    {},
    h('h3', {}, '⭐ รีวิวลูกค้า'),
    h('div', { style: { fontSize: '15px', lineHeight: '1.7' } }, `ลูกค้าเข้าร้าน ${log.visitors} คน (นั่งทาน ${log.dineIn} • กลับบ้าน ${log.takeaway})${log.deliveryOrders ? ` • เดลิเวอรี่ ${log.deliveryOrders} ออเดอร์` : ''}`),
    h('div', { style: { fontSize: '15px', lineHeight: '1.7' } }, `วันนี้รีวิว ${log.reviewCount} คน เฉลี่ย `, h('b', {}, stars(today))),
    h('div', { style: { fontSize: '15px', lineHeight: '1.7' } }, `คะแนนสะสม `, h('b', { style: { color: '#e09b18' } }, stars(log.ratingAll)), ` จาก ${G.reviews.count} รีวิว`),
    h(
      'table',
      { class: 'ledger', style: { fontSize: '14px' } },
      h('tr', 'muted', h('td', {}, 'วัน'), h('td', {}, 'รีวิว'), h('td', {}, 'เฉลี่ยวันนั้น'), h('td', {}, 'สะสม')),
      ...G.history.map((d) => h('tr', {}, h('td', {}, String(d.day)), h('td', {}, String(d.reviewCount ?? 0)), h('td', {}, stars(d.reviewCount ? d.reviewSum / d.reviewCount : 0)), h('td', {}, stars(d.ratingAll ?? 0)))),
    ),
    h('div', { class: 'muted', style: { fontSize: '13px' } }, 'คะแนนสะสม = ดาวทั้งหมด ÷ จำนวนคนที่รีวิวทั้งหมด (วันที่มีคนรีวิวเยอะมีน้ำหนักมากกว่า)'),
  );
}

/** Change menus and staff between days. */
function manage(): void {
  const menus = MENUS.filter((m) => !m.signature || G.strategy === 'creative');
  const menuGrid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } });
  for (const m of menus) {
    const c = h('div', { class: `card row ${G.menus.includes(m.id) ? 'sel' : ''}`, style: { padding: '8px' } }, cupIcon(m.id, 36), m.short);
    c.addEventListener('click', () => {
      if (G.menus.includes(m.id)) {
        if (G.menus.length > 1) G.menus = G.menus.filter((id) => id !== m.id);
      } else {
        G.menus.push(m.id);
        G.prices[m.id] ??= m.basePrice;
      }
      c.classList.toggle('sel', G.menus.includes(m.id));
    });
    menuGrid.append(c);
  }
  const staffRow = h('div', 'row');
  for (const s of STAFF) {
    const c = h('div', { class: `card ${G.staff.includes(s.id) ? 'sel' : ''}`, style: { width: '180px' } }, h('b', {}, `${s.name} (${s.role})`), h('div', 'muted', `${baht(dailyWage(s))}/วัน`));
    c.addEventListener('click', () => {
      G.staff = G.staff.includes(s.id) ? G.staff.filter((id) => id !== s.id) : [...G.staff, s.id];
      c.classList.toggle('sel', G.staff.includes(s.id));
    });
    staffRow.append(c);
  }
  const { close } = modal([h('h2', {}, 'จัดการร้าน'), h('div', 'muted', 'เมนู (ต้องมีวัตถุดิบถึงจะขายได้)'), menuGrid, h('div', { class: 'muted', style: { marginTop: '12px' } }, 'พนักงาน (ค่าแรงจ่ายรายวัน)'), staffRow, h('div', { style: { textAlign: 'center', marginTop: '14px' } }, btn('เสร็จแล้ว', 'pink', () => close()))], { width: '680px' });
}

/** Evening wind-down with MIYU on the balcony before the next day. */
export function nightScreen(stage: Stage, data: { log: DayLog; bankrupt: boolean; last: boolean; guest?: boolean }): void {
  const e = stage.engine;
  e.setSky('#2a2a6a', true, 45, 160);
  e.hemi.intensity = 0.7;
  e.sun.intensity = 0.5;
  e.hemi.color.set('#b8b4ff');
  stage.onUpdate(() => undefined);
  const terrace = buildTerrace();
  stage.add(terrace.group);
  stage.onUpdate(terrace.update);
  const miyu = addChibi(stage, CAST.advisor, 0.6, 2.4, -0.25);
  const me = addChibi(stage, CAST[G.playerKey], -0.8, 2.4, 0.25);
  addCat(stage, 0, -0.1, 3.2);
  const cup = bubbleTea('#d9a877', true);
  cup.position.set(0, -0.36, 0.07);
  miyu.arm(1).add(cup);
  e.camera.position.set(0, 1.9, 6.4);
  e.look(0, 1.3, 2);
  mount(h('div', 'top-left panel chip-title', h('div', 'badge', '🌙'), h('div', {}, h('h2', {}, `คืนหลังเปิดร้านวันที่ ${data.log.day}`))));
  const p = data.log.profit + data.log.setup;
  const dlg = new DialogBox();
  const lines: Line[] = data.bankrupt
    ? [{ who: 'miyu', text: 'เงินทุนหมดแล้ว... มาดูกันว่าเกิดอะไรขึ้น', expr: 'sad' }]
    : [
        { who: 'miyu', text: p >= 0 ? `วันนี้เหนื่อยหน่อยนะ ${playerName()} แต่เป็นวันที่ดีมากเลย` : 'วันนี้ไม่เป็นอย่างที่หวัง แต่ไม่เป็นไร ทุกร้านก็ต้องเจอวันแบบนี้', expr: p >= 0 ? 'happy' : 'think' },
        { who: 'me', text: data.log.feedback.expensive > 2 ? 'ลูกค้าหลายคนบอกว่าแพง พรุ่งนี้ลองคิดเรื่องราคาดูดีกว่า' : data.log.feedback.leftAngry > 2 ? 'มีลูกค้ารอนานจนเดินออกไปหลายคนเลย...' : 'ได้ยินลูกค้าชมแล้วดีใจมากเลย', expr: 'think' },
        { who: 'miyu', text: data.last ? 'ครบ 7 วันแล้ว มาดูกันว่าร้านเราเติบโตไปแค่ไหน' : 'พรุ่งนี้สู้ใหม่นะ พักผ่อนให้เต็มที่ก่อน', expr: 'wink' },
      ];
  const talk = async () => {
    for (const l of lines) {
      (l.who === 'miyu' ? miyu : me).setExpr(l.expr ?? 'normal');
      await dlg.say([l]);
    }
  };
  talk().then(() => {
    dlg.hide();
    if (data.guest) return void mount(h('div', 'bottom-right pill', '⏳ รอเจ้าของร้านไปวันต่อไป...'));
    const swap = coopActive() && !data.bankrupt && !data.last ? btn('🔄 สลับหน้าที่พรุ่งนี้', 'gold', () => (act({ k: 'rotate' }), toast('หมุนเวียนหน้าที่แล้ว ดูหน้าที่ใหม่ได้ที่ป้ายห้อง', 'good'))) : '';
    if (swap) mount(h('div', { class: 'bottom-right', style: { bottom: '96px' } }, swap));
    mount(
      h(
        'div',
        'bottom-right',
        btn(data.bankrupt || data.last ? 'ดูผลสรุป ›' : 'ไปวันต่อไป ›', 'pink', () => {
          if (data.bankrupt || data.last) return go('ending', { bankrupt: data.bankrupt });
          G.day++;
          G.checkpoint = 'morning';
          saveGame();
          go('map');
        }, 'big'),
      ),
    );
  });
}

/** After day 7 (or running out of money): the season report. */
export function endingScreen(stage: Stage, data: { bankrupt?: boolean; evicted?: boolean; guest?: boolean } = {}): void {
  stage.add(buildStreet());
  const e = stage.engine;
  e.camera.position.set(1.4, 2.4, 10.5);
  e.look(1.2, 1.1, 4.5);
  addChibi(stage, CAST[G.playerKey], 0.2, 5.2, 0.15).setExpr(data.bankrupt ? 'sad' : 'happy');
  addChibi(stage, CAST.advisor, 1.6, 5.3, -0.2).setExpr(data.bankrupt ? 'think' : 'wink');
  addCat(stage, 0, 0.9, 6.2);
  const hst = G.history;
  const revenue = hst.reduce((s, d) => s + d.revenue, 0);
  const profit = hst.reduce((s, d) => s + d.profit, 0);
  const cups = hst.reduce((s, d) => s + d.cupsSold, 0);
  const served = hst.reduce((s, d) => s + d.served, 0);
  // unpaid tax at the end costs a 20% fine; whatever is still owed comes off the cash
  const taxFine = Math.round(G.taxDue * 0.2);
  const worth = netWorth(G) - taxFine;
  const setupAll = hst.reduce((s, d) => s + d.setup, 0);
  // selling profit per day, without the one-off investment
  const perDay = hst.length ? (profit + setupAll) / hst.length : 0;
  const payback = perDay > 0 ? Math.ceil(setupAll / (perDay * 30)) : Infinity;
  const rank = data.bankrupt ? 'บทเรียนราคาแพง' : perDay > 1500 ? 'เจ้าพ่อ/เจ้าแม่ชานม' : perDay > 0 ? 'ดาวรุ่งวงการชานม' : G.reputation >= 3.5 ? 'ร้านเล็กที่ลูกค้ารัก' : 'เจ้าของร้านมือใหม่';
  const maxAbs = Math.max(1, ...hst.map((d) => Math.abs(d.profit)));
  mount(
    h(
      'div',
      { class: 'panel content', style: { position: 'absolute', left: '20px', top: '20px', width: '460px' } },
      h('h2', {}, data.bankrupt ? 'เงินทุนหมดแล้ว...' : `สรุปผล ${hst.length} วันแรก`),
      h('h2', { style: { color: 'var(--pink-dark)', margin: '6px 0' } }, `ฉายา: "${rank}"`),
      h('div', { style: { lineHeight: '1.8' } }, `รายได้รวม ${baht(revenue)}`, h('br'), `กำไร/ขาดทุนรวม ${baht(profit)} (รวมค่าลงทุนเริ่มต้น ${baht(setupAll)})`, h('br'), `กำไรจากการขายเฉลี่ย ${baht(Math.round(perDay))}/วัน • ${payback === Infinity ? 'ยังคืนทุนไม่ได้ถ้าขายแบบนี้' : `คาดว่าคืนทุนใน ~${payback} เดือน`}`, h('br'), `ขายไป ${cups} แก้ว ให้ลูกค้า ${served} คน`, h('br'), `เงินสดคงเหลือ ${baht(G.cash)} • ชื่อเสียง ${G.reputation.toFixed(1)} ★`, h('br'), `รีวิวสะสม ${G.reviews.count ? ratingAll(G).toFixed(2) : '-'} ★ จาก ${G.reviews.count} รีวิว`, h('br'), `หนี้ธนาคาร ${baht(G.loan)} • ค่าเช่าค้าง ${baht(G.rentDue)} • ภาษีค้าง ${baht(G.taxDue)}${taxFine ? ` (+ปรับ ${baht(taxFine)})` : ''}`, h('br'), h('b', worth >= 0 ? 'good' : 'bad', `ทรัพย์สินสุทธิ (เงินสด − หนี้ทั้งหมด) ${baht(worth)}`)),
      h('div', { class: 'row', style: { alignItems: 'flex-end', height: '120px', marginTop: '10px', gap: '8px' } }, ...hst.map((d) => h('div', { style: { flex: '1', textAlign: 'center', fontSize: '15px' } }, h('div', { style: { height: `${(Math.abs(d.profit) / maxAbs) * 90}px`, background: d.profit >= 0 ? 'var(--mint)' : 'var(--red)', borderRadius: '8px 8px 0 0' } }), `วัน ${d.day}`))),
    ),
  );
  const dlg = new DialogBox();
  const lines = data.bankrupt
    ? [
        { who: 'miyu' as const, text: `เงินทุนหมดแล้ว... แต่ไม่เป็นไรนะ ${playerName()} ธุรกิจจริงก็ล้มกันบ่อย สิ่งสำคัญคือเราได้เรียนรู้อะไร`, expr: 'sad' as const },
        { who: 'miyu' as const, text: 'ลองนึกดูว่าเงินหายไปกับอะไรมากที่สุด ค่าเช่า ค่าแรง หรือของเสีย แล้วรอบหน้าลองใหม่กันนะ', expr: 'think' as const },
      ]
    : [
        { who: 'miyu' as const, text: `ผ่านไป ${hst.length} วันแล้ว ${playerName()} ตอนนี้เข้าใจเรื่องต้นทุน กำไร ทำเล และลูกค้ามากขึ้นเยอะเลยนะ`, expr: 'happy' as const },
        { who: 'me' as const, text: 'ขอบคุณที่ช่วยมาตลอดนะ มิว ร้านนี้เป็นของเราเองจริงๆ แล้ว', expr: 'happy' as const },
        { who: 'miyu' as const, text: 'นี่เป็นแค่ Chapter 1 นะ ร้านของเรายังไปได้อีกไกล', expr: 'wink' as const },
      ];
  dlg.say(lines).then(() => {
    dlg.hide();
    if (!data.guest) clearSave();
    mount(h('div', 'bottom-center', btn('กลับหน้าแรก', 'pink', () => {
      if (data.guest) leaveRoom();
      go('title');
    }, 'big')));
  });
}
