import { btn, h } from '../ui/dom';
import { modal } from '../ui/components';
import { chartView, tableView } from '../ui/charts';
import { LOCATION } from '../data/locations';
import { G } from '../sim/GameState';
import { notebook, type Finding } from '../sim/research';

/** Notebook, volume 1: one page per thing learnt at each place, short text with a chart or a table. */
export interface NotePage {
  loc: string;
  area: string;
  f: Finding;
}

export function notebookPages(onlyLoc?: string): NotePage[] {
  return Object.keys(G.research.done)
    .filter((id) => (!onlyLoc || id === onlyLoc) && G.research.done[id].length)
    .flatMap((id) => notebook(G, id).map((f) => ({ loc: id, area: LOCATION[id].area, f })));
}

function personCard(t: NonNullable<Finding['people']>[number]): HTMLElement {
  return h(
    'div',
    'note-person',
    h('div', 'note-avatar', t.icon),
    h('div', { style: { flex: '1' } }, h('b', {}, `${t.name} • ${t.tag}`), h('div', 'note-quote', `“${t.quote}”`), h('div', 'row note-chips', ...t.chips.map((c) => h('span', 'pill', c)), t.gotTea ? h('span', 'pill', '🧋 รับชานม') : null)),
  );
}

/** One page, small (side panel) or big (full screen). */
export function pageView(p: NotePage, big = false): HTMLElement {
  const f = p.f;
  const people = f.people ?? [];
  return h(
    'div',
    `note-page ${big ? 'big' : ''}`,
    h('div', 'note-kicker', `📍 ${p.area}`),
    h('h3', 'note-title', f.title),
    h('div', 'note-headline', f.headline),
    ...(f.lines.length ? [h('ul', 'note-points', ...f.lines.map((l) => h('li', {}, l)))] : []),
    ...(f.refused ? [h('div', 'note-refused', `🙅 มี ${f.refused} คนปฏิเสธการให้สัมภาษณ์ (รีบ/เขิน)`)] : []),
    ...(f.charts ?? []).map((c) => chartView(c, big)),
    ...(f.table ? [tableView(f.table)] : []),
    ...(people.length ? [h('div', 'note-people', ...people.map(personCard))] : []),
  );
}

const keyOf = (p: NotePage) => `${p.loc}:${p.f.method}`;

/** Compact notebook for the side panel: page tabs, one page at a time and a button for the big view. */
export function notebookView(onlyLoc?: string): HTMLElement {
  const pages = notebookPages(onlyLoc);
  if (!pages.length) return h('div', 'muted', 'ยังไม่ได้สำรวจอะไรเลย');
  let i = pages.length - 1;
  const root = h('div', 'notebook');
  const draw = () => {
    root.replaceChildren(
      h('div', 'row note-tabs', ...pages.map((p, n) => btn(p.f.title.split(' ')[0], n === i ? 'pink' : '', () => { i = n; draw(); }, 'small'))),
      pageView(pages[i]),
      h('div', { style: { textAlign: 'center', marginTop: '8px' } }, btn('🔍 ดูหน้าจอใหญ่', 'gold', () => openNotebook(keyOf(pages[i])), 'small')),
    );
  };
  draw();
  return root;
}

/** Big notebook: every place and every page, flipped with the arrows. */
export function openNotebook(startKey?: string): void {
  const pages = notebookPages();
  if (!pages.length) {
    const { close } = modal([h('h2', {}, '📒 สมุดบันทึกเล่ม 1'), h('p', 'muted', 'ยังไม่ได้สำรวจอะไรเลย ไปเก็บข้อมูลกันก่อนนะ'), h('div', { style: { textAlign: 'center' } }, btn('ปิด', 'pink', () => close()))], { width: '420px' });
    return;
  }
  let i = Math.max(0, startKey ? pages.findIndex((p) => keyOf(p) === startKey) : pages.length - 1);
  const body = h('div', 'note-book-body');
  const index = h('div', 'note-index');
  const counter = h('span', 'muted');
  const prev = btn('◀', '', () => go(i - 1), 'small');
  const next = btn('▶', '', () => go(i + 1), 'small');
  const go = (n: number) => {
    i = Math.min(pages.length - 1, Math.max(0, n));
    draw();
  };
  const draw = () => {
    body.replaceChildren(pageView(pages[i], true));
    body.scrollTop = 0;
    index.replaceChildren(...pages.map((p, n) => h('button', { class: `note-tab ${n === i ? 'on' : ''}`, onclick: () => go(n) }, h('small', {}, p.area), h('b', {}, p.f.title))));
    counter.textContent = `หน้า ${i + 1} / ${pages.length}`;
    prev.disabled = i === 0;
    next.disabled = i === pages.length - 1;
  };
  const { panel, close } = modal([
    h('h2', { style: { textAlign: 'center' } }, '📒 สมุดบันทึกเล่ม 1'),
    h('div', 'note-book', index, body),
    h('div', { class: 'row', style: { justifyContent: 'center', gap: '14px', marginTop: '12px' } }, prev, counter, next, btn('ปิด', 'pink', () => close())),
  ], { width: 'min(1000px, 96vw)' });
  panel.classList.add('note-modal');
  draw();
}
