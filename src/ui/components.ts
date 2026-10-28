import { btn, h, mount } from './dom';
import { portrait } from '../three/portrait';
import { setTalking } from '../three/models/miyu';
import { CAST, type Expr } from '../game/specs';
import { G } from '../sim/GameState';
import { baht } from '../game/format';
import { sfx } from './sfx';
import { chunkText } from './chunk';

export const MIYU = 'มิว';
export const playerName = (): string => G.playerName?.trim() || 'คุณ';
export const polite = (): string => (G.playerKey === 'player_f' ? 'ค่ะ' : 'ครับ');
export const selfWord = (): string => (G.playerKey === 'player_f' ? 'ฉัน' : 'ผม');

export type Speaker = 'miyu' | 'me' | 'narrator' | 'boss';

export interface Line {
  who: Speaker;
  text: string;
  expr?: Expr;
}

function face(key: string, expr: Expr = 'normal'): string {
  return portrait(key, CAST[key], expr);
}

/** Step banner in the top-left, like the reference's title chip. */
export function stepChip(num: number | string, title: string, sub?: string): HTMLElement {
  const head = h('div', 'chip-title', h('div', 'badge', typeof num === 'number' ? '🐾' : num), h('h2', {}, typeof num === 'number' ? `${num}. ${title}` : title));
  return mount(h('div', 'top-left step-chip', head, sub ? h('div', 'chip-sub', sub) : null));
}

/** Top bar: day / clock / money / reputation pills. */
export class Hud {
  readonly el: HTMLElement;
  private cash: HTMLElement;
  private stars: HTMLElement;
  private title: HTMLElement;
  readonly clock: HTMLElement;
  readonly extra: HTMLElement;

  constructor(title: string) {
    this.title = h('span', {}, title);
    this.clock = h('span', 'pill', '☀ 10:00');
    this.clock.style.display = 'none';
    this.extra = h('span', 'pill muted');
    this.extra.style.display = 'none';
    this.cash = h('b');
    this.stars = h('span', { style: { color: '#ffb340', letterSpacing: '1px' } });
    this.el = mount(
      h(
        'div',
        { class: 'top-right row', style: { gap: '10px' } },
        h('span', 'pill', '🏪 ', this.title),
        this.clock,
        this.extra,
        h('span', 'pill', h('span', 'coin'), this.cash),
        h('span', 'pill', this.stars),
      ),
    );
    this.refresh();
  }

  setTitle(s: string): void {
    this.title.textContent = s;
  }

  refresh(cash = G.cash, rep = G.reputation): void {
    this.cash.textContent = baht(cash);
    this.cash.className = cash < 0 ? 'bad' : '';
    const n = Math.round(rep);
    this.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
  }
}

/** Visual-novel style dialogue at the bottom of the screen. */
export class DialogBox {
  private el: HTMLElement;
  private img: HTMLImageElement;
  private name: HTMLElement;
  private text: HTMLElement;
  private portraitBox: HTMLElement;
  private full = '';
  private timer = 0;
  private resolve?: () => void;
  private choices?: HTMLElement;

  constructor() {
    this.img = h('img');
    this.portraitBox = h('div', 'portrait', this.img);
    this.name = h('div', 'name');
    this.text = h('div', 'text');
    this.el = mount(h('div', 'dialog panel', this.portraitBox, this.name, this.text, h('div', 'next', '▼')));
    this.el.style.display = 'none';
    this.el.addEventListener('click', () => this.advance());
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if ((e.key === ' ' || e.key === 'Enter') && this.el.isConnected && this.el.style.display !== 'none') {
        e.preventDefault();
        this.advance();
      }
    };
    window.addEventListener('keydown', key);
    new MutationObserver(() => {
      if (!this.el.isConnected) window.removeEventListener('keydown', key);
    }).observe(document.getElementById('ui')!, { childList: true });
  }

  private advance(): void {
    if (this.choices) return;
    if (this.text.textContent !== this.full) {
      clearInterval(this.timer);
      setTalking(null);
      this.text.textContent = this.full;
      return;
    }
    const r = this.resolve;
    this.resolve = undefined;
    r?.();
  }

  private show(line: Line): void {
    this.el.style.display = '';
    const key = line.who === 'miyu' ? 'advisor' : line.who === 'me' ? G.playerKey : null;
    this.portraitBox.style.display = key ? '' : 'none';
    if (key) this.img.src = face(key, line.expr);
    const names: Record<Speaker, string> = { miyu: MIYU, me: playerName(), narrator: '', boss: 'หัวหน้าทีม (อีเมล)' };
    this.name.textContent = names[line.who];
    this.name.style.display = names[line.who] ? '' : 'none';
    this.name.className = `name ${line.who === 'me' ? 'me' : line.who === 'boss' ? 'other' : ''}`;
    this.name.style.left = key ? '150px' : '24px';
    this.text.className = `text ${line.who === 'narrator' ? 'narrator' : ''}`;
    this.full = line.text;
    this.text.textContent = '';
    clearInterval(this.timer);
    setTalking(line.who === 'miyu' ? 'miyu' : line.who === 'me' ? 'me' : null);
    let i = 0;
    const chars = [...line.text];
    this.timer = window.setInterval(() => {
      i++;
      this.text.textContent = chars.slice(0, i).join('');
      if (i % 3 === 0) sfx('type');
      if (i >= chars.length) {
        clearInterval(this.timer);
        setTalking(null);
      }
    }, 24);
  }

  say(lines: Line[]): Promise<void> {
    // long lines are cut into short ones, so nobody has to read a paragraph at once
    lines = lines.flatMap((l) => chunkText(l.text).map((text) => ({ ...l, text })));
    return lines.reduce<Promise<void>>(
      (p, line) =>
        p.then(
          () =>
            new Promise<void>((res) => {
              this.show(line);
              this.resolve = res;
            }),
        ),
      Promise.resolve(),
    );
  }

  ask(line: Line, options: { id: string; label: string }[]): Promise<string> {
    this.show(line);
    return new Promise((res) => {
      this.choices = mount(h('div', 'choices'));
      options.forEach((o, i) =>
        this.choices!.append(
          btn(o.label, i === 0 ? 'pink' : '', () => {
            this.choices?.remove();
            this.choices = undefined;
            res(o.id);
          }),
        ),
      );
    });
  }

  /** Shows a line and waits for the player to type an answer (e.g. their name). */
  prompt(line: Line, placeholder: string, maxLength = 16): Promise<string> {
    this.show(line);
    return new Promise((res) => {
      const input = h('input', { class: 'name-input', placeholder, maxlength: maxLength });
      const ok = btn('ตกลง ✓', 'pink', () => submit());
      const submit = () => {
        const v = input.value.trim();
        if (!v) {
          input.focus();
          input.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 220 });
          return;
        }
        sfx('done');
        this.choices?.remove();
        this.choices = undefined;
        res(v);
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') submit();
      });
      this.choices = mount(h('div', 'choices name-ask panel', h('b', {}, 'พิมพ์ชื่อเล่นของคุณ'), input, ok));
      setTimeout(() => input.focus(), 50);
    });
  }

  hide(): void {
    setTalking(null);
    this.el.style.display = 'none';
  }
}

/** Modal asking the player's name, for when the intro is skipped. */
export function askName(): Promise<string> {
  return new Promise((res) => {
    const input = h('input', { class: 'name-input', placeholder: 'เช่น ภูมิ, แพรว', maxlength: 16 });
    const submit = () => {
      const v = input.value.trim();
      if (!v) return input.focus();
      sfx('done');
      close();
      res(v);
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    const { close } = modal([h('h2', { style: { textAlign: 'center' } }, 'ชื่อเล่นของคุณคืออะไร?'), h('p', { class: 'muted', style: { textAlign: 'center' } }, `${MIYU} จะเรียกคุณด้วยชื่อนี้ตลอดเกม`), input, h('div', { style: { textAlign: 'center', marginTop: '14px' } }, btn('ตกลง ✓', 'pink', submit, 'big'))], { width: '440px' });
    setTimeout(() => input.focus(), 50);
  });
}

/** MIYU's corner card: she comments while the player decides. */
export class Advisor {
  readonly el: HTMLElement;
  private img: HTMLImageElement;
  private text: HTMLElement;
  private timer = 0;
  private nextTimer = 0;
  private skip: () => void = () => {};

  constructor(where = 'bottom-left', parent?: HTMLElement) {
    this.img = h('img');
    this.text = h('div', 'say');
    // MIYU's bust with a speech bubble beside her, like the mockups
    const bubbleEl = h('div', { class: 'bubble', style: { cursor: 'pointer', pointerEvents: 'auto' } }, h('div', 'tip-head', `🐾 ${MIYU} แนะนำ`), this.text);
    bubbleEl.addEventListener('click', () => this.skip());
    this.el = h('div', `miyu-tip ${where}`, this.img, bubbleEl);
    mount(this.el, parent);
  }

  /** Says it in short pieces, one after another (tap the bubble to skip ahead). */
  say(s: string, expr: Expr = 'happy'): this {
    this.img.src = face('advisor', expr);
    clearInterval(this.timer);
    clearTimeout(this.nextTimer);
    const parts = chunkText(s);
    const show = (n: number) => {
      const chars = [...parts[n]];
      let i = 0;
      this.text.textContent = '';
      clearInterval(this.timer);
      this.timer = window.setInterval(() => {
        i++;
        this.text.textContent = chars.slice(0, i).join('');
        if (i % 4 === 0) sfx('type');
        if (i >= chars.length) {
          clearInterval(this.timer);
          if (n + 1 < parts.length) this.nextTimer = window.setTimeout(() => show(n + 1), 1500);
        }
      }, 18);
      this.skip = () => {
        clearInterval(this.timer);
        clearTimeout(this.nextTimer);
        if (this.text.textContent !== parts[n]) this.text.textContent = parts[n];
        else if (n + 1 < parts.length) show(n + 1);
      };
    };
    show(0);
    this.img.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 260 });
    return this;
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  show(): void {
    this.el.style.display = '';
  }
}

/** Centered modal; returns the panel and a close function. */
export function modal(content: HTMLElement | HTMLElement[], o: { width?: string; onClose?: () => void } = {}): { panel: HTMLElement; close: () => void } {
  const panel = h('div', 'panel modal');
  if (o.width) panel.style.width = o.width;
  panel.append(...(Array.isArray(content) ? content : [content]));
  const ov = mount(h('div', 'overlay', panel));
  const close = () => {
    ov.remove();
    o.onClose?.();
  };
  return { panel, close };
}

export function toast(s: string, cls = ''): void {
  const t = mount(h('div', `toast pill ${cls}`, s));
  setTimeout(() => t.remove(), 2600);
}

/** Floating text at a screen position (e.g. +฿45). */
export function floatAt(x: number, y: number, s: string, color = 'var(--green)'): void {
  const el = mount(h('div', { class: 'float', style: { left: `${x}px`, top: `${y}px`, color, transform: 'translate(-50%, 0)' } }, s));
  setTimeout(() => el.remove(), 1300);
}

export function bubble(text: string, cls = ''): HTMLElement {
  return h('div', `bubble ${cls}`, text);
}

export function stepper(value: number, onChange: (v: number) => void, min = 0, max = 99, step = 1): HTMLElement {
  const v = h('b', {}, String(value));
  let cur = value;
  const set = (n: number) => {
    cur = Math.max(min, Math.min(max, n));
    v.textContent = String(cur);
    onChange(cur);
  };
  return h('span', 'stepper', btn('−', '', () => set(cur - step), 'square small'), v, btn('+', 'pink', () => set(cur + step), 'square small'));
}

/** A price field: type any whole number, or nudge it by 1 baht with − / +. */
export function priceInput(value: number, onChange: (v: number) => void, min = 1, max = 300): HTMLElement {
  let cur = value;
  const input = h('input', { class: 'price-input', type: 'number', value, min, max, step: 1, inputmode: 'numeric' });
  const set = (n: number, write = true) => {
    if (!Number.isFinite(n)) return;
    cur = Math.max(min, Math.min(max, Math.round(n)));
    if (write) input.value = String(cur);
    onChange(cur);
  };
  // keep the game's keyboard controls from reacting while typing
  input.addEventListener('keydown', (e) => e.stopPropagation());
  input.addEventListener('input', () => input.value !== '' && set(Number(input.value), false));
  input.addEventListener('change', () => set(Number(input.value)));
  return h('span', 'stepper', btn('−', '', () => set(cur - 1), 'square small'), input, btn('+', 'pink', () => set(cur + 1), 'square small'));
}
