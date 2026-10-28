import { h } from './dom';
import type { ChartSpec, TableSpec } from '../sim/research';

const SVG = 'http://www.w3.org/2000/svg';
const PALETTE = ['#f56fa6', '#7fb2f0', '#6fcf97', '#f6a04d', '#a993f5', '#ffd36e'];

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** A ring split by share, with a legend of names and percentages beside it. */
function donut(c: Extract<ChartSpec, { kind: 'donut' }>, big: boolean): HTMLElement {
  const size = big ? 150 : 104;
  const total = c.items.reduce((s, i) => s + i.value, 0) || 1;
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const root = svg('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}` });
  root.append(svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: '#f0e6ee', 'stroke-width': big ? 22 : 16 }));
  let acc = 0;
  c.items.forEach((it, i) => {
    const frac = it.value / total;
    const arc = svg('circle', {
      cx: size / 2, cy: size / 2, r, fill: 'none', stroke: it.color ?? PALETTE[i % PALETTE.length], 'stroke-width': big ? 22 : 16,
      'stroke-dasharray': `${Math.max(0, frac * circ - 1.5)} ${circ}`, 'stroke-dashoffset': -acc * circ, transform: `rotate(-90 ${size / 2} ${size / 2})`,
    });
    root.append(arc);
    acc += frac;
  });
  const legend = h(
    'div',
    { class: 'chart-legend' },
    ...c.items.map((it, i) => h('div', 'row', h('i', { class: 'dot', style: { background: it.color ?? PALETTE[i % PALETTE.length] } }), h('span', { style: { flex: '1' } }, it.label), h('b', {}, pct(it.value / total)))),
  );
  const wrap = h('div', 'chart-donut');
  wrap.append(root, legend);
  return wrap;
}

/** One horizontal bar per item; values are 0-1 of the full width. */
function bars(c: Extract<ChartSpec, { kind: 'bars' }>): HTMLElement {
  return h(
    'div',
    { class: 'chart-bars' },
    ...c.items.map((it, i) =>
      h(
        'div',
        'row',
        h('span', { class: 'chart-label' }, it.label),
        h('div', { class: 'bar pink', style: { flex: '1' } }, h('i', { style: { width: `${Math.round(Math.min(1, it.value) * 100)}%`, background: PALETTE[i % PALETTE.length] } })),
        h('small', { class: 'chart-val' }, it.text ?? pct(it.value)),
      ),
    ),
  );
}

export function chartView(c: ChartSpec, big = false): HTMLElement {
  return h('div', 'chart', h('div', 'chart-title', c.title), c.kind === 'donut' ? donut(c, big) : bars(c));
}

export function tableView(t: TableSpec): HTMLElement {
  return h('table', 'ledger notes-table', h('tr', {}, ...t.head.map((x) => h('th', {}, x))), ...t.rows.map((r) => h('tr', {}, ...r.map((x) => h('td', {}, x)))));
}
