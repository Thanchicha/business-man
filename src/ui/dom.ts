/** Tiny DOM helpers so screens can describe UI without a framework. */
type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> | string = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const p = typeof props === 'string' ? { class: props } : props;
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export type BtnStyle = '' | 'pink' | 'mint' | 'gold' | 'lav';

export function btn(label: string, style: BtnStyle, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = h('button', { class: `btn ${style} ${extra}`.trim() }, label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!b.disabled) onClick();
  });
  return b;
}

export const ui = (): HTMLElement => document.getElementById('ui')!;

export function mount<T extends HTMLElement>(el: T, parent: HTMLElement = ui()): T {
  parent.appendChild(el);
  return el;
}

export function clearUI(): void {
  ui().replaceChildren();
}
