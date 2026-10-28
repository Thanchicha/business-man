import { btn, h } from '../ui/dom';
import { modal, priceInput } from '../ui/components';
import { G } from '../sim/GameState';
import { LOCATION, marketPrice } from '../data/locations';
import { MENU, cupCost } from '../data/menus';
import { clearanceMenus, DELIVERY_FEE } from '../sim/economy';
import { OPENING_DAYS, orderTotal } from '../sim/pricing';
import { baht } from '../game/format';
import { cupIcon } from './icons';

const margin = (price: number, cost: number): HTMLElement => {
  const p = price - cost;
  return h('b', p > 0 ? 'good' : 'bad', `${baht(p)} (${price ? Math.round((p / price) * 100) : 0}%)`);
};

/** Live cell that redraws when a value changes. */
function cell(draw: () => HTMLElement | string): { el: HTMLElement; redraw: () => void } {
  const el = h('td');
  const redraw = () => el.replaceChildren(draw());
  redraw();
  return { el, redraw };
}

function shopTab(): HTMLElement {
  const market = G.location ? marketPrice(LOCATION[G.location]) : 45;
  const rows = G.menus.map((id) => {
    const cost = cupCost(id);
    const m = cell(() => margin(G.prices[id], cost));
    const tag = cell(() => (G.prices[id] % 10 === 9 ? h('span', 'pill good', 'ราคาจิตวิทยา') : ''));
    return h('tr', {}, h('td', {}, h('div', 'row', cupIcon(id, 40), MENU[id].name)), h('td', {}, baht(cost)), h('td', {}, priceInput(G.prices[id], (v) => {
      G.prices[id] = v;
      m.redraw();
      tag.redraw();
    })), m.el, tag.el);
  });
  return h(
    'div',
    {},
    h('div', 'muted', `ราคาเฉลี่ยในย่านนี้ประมาณ ${baht(market)} • กำไรต่อแก้ว = ราคาขาย − ต้นทุน • พิมพ์ราคาได้ทุกตัวเลข`),
    h('div', 'muted', '💡 ราคาลงท้าย 9 เช่น 39 หรือ 49 ทำให้ลูกค้ารู้สึกว่าถูกกว่าราคาเต็มสิบ (ราคาจิตวิทยา)'),
    h('table', { class: 'ledger', style: { marginTop: '10px' } }, h('tr', 'muted', h('td', {}, 'เมนู'), h('td', {}, 'ต้นทุน/แก้ว'), h('td', {}, 'ราคาฐาน (฿)'), h('td', {}, 'กำไร/แก้ว'), h('td', {}, '')), ...rows),
  );
}

function deliveryTab(): HTMLElement {
  const body = h('div');
  const draw = () => {
    const on = G.delivery.on;
    const rows = G.menus.map((id) => {
      G.delivery.prices[id] ??= G.prices[id] + 10;
      const cost = cupCost(id);
      const net = () => Math.round(G.delivery.prices[id] * (1 - DELIVERY_FEE) * 100) / 100;
      const fee = cell(() => `−${baht(Math.round(G.delivery.prices[id] * DELIVERY_FEE * 100) / 100)}`);
      const get = cell(() => baht(net()));
      const m = cell(() => margin(net(), cost));
      return h('tr', {}, h('td', {}, h('div', 'row', cupIcon(id, 36), MENU[id].short)), h('td', {}, baht(G.prices[id])), h('td', {}, priceInput(G.delivery.prices[id], (v) => {
        G.delivery.prices[id] = v;
        fee.redraw();
        get.redraw();
        m.redraw();
      })), fee.el, get.el, m.el);
    });
    body.replaceChildren(
      h('div', 'row', h('b', {}, '📱 ขายผ่านแอปเดลิเวอรี่'), btn(on ? 'เปิดอยู่ ✓' : 'ปิดอยู่', on ? 'mint' : '', () => {
        G.delivery.on = !G.delivery.on;
        draw();
      }, 'small')),
      h('div', 'muted', `แอปหักค่า GP 30% + VAT 7% = ${(DELIVERY_FEE * 100).toFixed(1)}% ของยอดขาย (อัตราปกติของ LINE MAN / Grab) ร้านส่วนใหญ่จึงตั้งราคาในแอปสูงกว่าหน้าร้าน แต่ถ้าแพงเกินไป คนก็สั่งน้อยลง`),
      h('div', 'muted', 'ออเดอร์จากแอปต้องชงแทรกคิวลูกค้าหน้าร้าน วันฝนตกคนจะสั่งเดลิเวอรี่เยอะขึ้น'),
      on
        ? h('table', { class: 'ledger', style: { marginTop: '10px' } }, h('tr', 'muted', h('td', {}, 'เมนู'), h('td', {}, 'หน้าร้าน'), h('td', {}, 'ราคาในแอป (฿)'), h('td', {}, 'แอปหัก'), h('td', {}, 'ร้านได้รับ'), h('td', {}, 'กำไร/แก้ว')), ...rows)
        : h('p', 'muted', 'ยังไม่ได้เปิดขายเดลิเวอรี่'),
    );
  };
  draw();
  return body;
}

function promoTab(): HTMLElement {
  const body = h('div');
  const sample = G.menus[0];
  const draw = () => {
    const pr = G.promos;
    const card = (on: boolean, toggle: () => void, title: string, desc: string, ...controls: (HTMLElement | string)[]) =>
      h('div', `promo ${on ? 'on' : ''}`, h('div', 'row', h('b', { style: { flex: '1' } }, title), btn(on ? 'ใช้อยู่ ✓' : 'ไม่ใช้', on ? 'pink' : '', () => {
        toggle();
        draw();
      }, 'small')), h('div', { class: 'muted', style: { fontSize: '15px' } }, desc), on ? h('div', { class: 'row', style: { marginTop: '6px', flexWrap: 'wrap' } }, ...controls) : '');
    const ex = h('div', { class: 'muted', style: { fontSize: '15px' } });
    const example = () => {
      if (!sample) return;
      const unit = G.prices[sample];
      ex.textContent = `ตัวอย่าง ${MENU[sample].short} (ราคาฐาน ${baht(unit)}): 1 แก้ว ${baht(orderTotal(G, sample, 1))} • 2 แก้ว ${baht(orderTotal(G, sample, 2))} • 3 แก้ว ${baht(orderTotal(G, sample, 3))}`;
    };
    const openLeft = OPENING_DAYS - G.day + 1;
    body.replaceChildren(
      h('div', 'muted', 'ราคาฐานยังเหมือนเดิม โปรโมชั่นจะลดราคาตอนคิดเงินเท่านั้น ช่วยดึงลูกค้า แต่กำไรต่อแก้วจะลดลงนะ'),
      card(
        pr.opening.on,
        () => (pr.opening.on = !pr.opening.on),
        '🎉 โปรเปิดร้านใหม่',
        openLeft > 0 ? `ลดทุกแก้วหน้าร้าน ใช้ได้ ${OPENING_DAYS} วันแรก (เหลืออีก ${openLeft} วัน) คนแถวนี้จะแวะมาลองมากขึ้น` : 'หมดช่วงเปิดร้านใหม่แล้ว โปรนี้จะไม่มีผล',
        'ลด',
        priceInput(pr.opening.pct, (v) => {
          pr.opening.pct = v;
          example();
        }, 5, 30),
        '%',
      ),
      card(
        pr.coupon.on,
        () => (pr.coupon.on = !pr.coupon.on),
        '⭐ รีวิว 5 ดาว รับส่วนลดรอบหน้า',
        'ลูกค้ารีวิวมากขึ้น คนที่ให้ 5 ดาวได้คูปอง และกว่าครึ่งจะกลับมาใช้ในวันถัดไป',
        'คูปองลด',
        priceInput(pr.coupon.amount, (v) => {
          pr.coupon.amount = v;
        }, 5, 30),
        'บาท',
      ),
      card(
        pr.bundle.on,
        () => (pr.bundle.on = !pr.bundle.on),
        '👫 ชวนเพื่อนมา ซื้อหลายแก้วถูกกว่า',
        'กลุ่มเพื่อนและครอบครัวจะซื้อ 2–3 แก้วบ่อยขึ้น ยอดขายต่อบิลสูงขึ้น',
        '2 แก้ว ลด',
        priceInput(pr.bundle.off2, (v) => {
          pr.bundle.off2 = v;
          example();
        }, 0, 50),
        'บาท • 3 แก้ว ลด',
        priceInput(pr.bundle.off3, (v) => {
          pr.bundle.off3 = v;
          example();
        }, 0, 80),
        'บาท',
      ),
      card(
        pr.clearance.on,
        () => (pr.clearance.on = !pr.clearance.on),
        '🧹 โละของใกล้เสีย',
        clearanceMenus(G).length ? `วันนี้ใช้กับ: ${clearanceMenus(G).map((id) => MENU[id].short).join(', ')} (มีวัตถุดิบที่จะเสียคืนนี้) ลูกค้าจะหันมาสั่งเมนูเหล่านี้มากขึ้น` : 'ลดราคาเฉพาะเมนูที่ใช้ของสดที่จะเสียคืนนี้ ตอนนี้ยังไม่มีของใกล้เสีย',
        'ลด',
        priceInput(pr.clearance.pct, (v) => {
          pr.clearance.pct = v;
        }, 5, 50),
        '% เฉพาะเมนูที่ใช้ของใกล้เสีย',
      ),
      ex,
    );
    example();
  };
  draw();
  return body;
}

/** Shop prices, delivery app prices and promotions, in three tabs. */
export function priceModal(note: string, onDone: () => void): void {
  const tabs: [string, () => HTMLElement][] = [['🏪 ราคาหน้าร้าน', shopTab], ['📱 เดลิเวอรี่', deliveryTab], ['🎁 โปรโมชั่น', promoTab]];
  const content = h('div');
  const buttons = tabs.map(([label, make], i) => btn(label, '', () => show(i, make), 'small'));
  const show = (i: number, make: () => HTMLElement) => {
    buttons.forEach((b, j) => b.classList.toggle('on', i === j));
    content.replaceChildren(make());
  };
  show(0, tabs[0][1]);
  const { close } = modal([h('h2', {}, 'ตั้งราคา & โปรโมชั่น'), h('div', 'muted', note), h('div', 'tabs', ...buttons), content, h('div', { style: { textAlign: 'center', marginTop: '14px' } }, btn('ตกลง', 'pink', () => {
    close();
    onDone();
  }, 'big'))], { width: '820px' });
}
