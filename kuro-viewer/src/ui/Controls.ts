import type { Viewer } from '../app/Viewer';
import type { ViewName } from '../app/params';
import { EXPRESSION_LABELS, EXPRESSIONS, type Expression } from '../character/types';
import { GESTURES, type Gesture } from '../character/anim/Animator';
import { actionIcon, catDoodle, faceIcon, heart, sparkleDoodle, toolIcon, viewIcon, type ActionIconName } from './icons';

type PresetView = Exclude<ViewName, 'free'>;

const VIEW_BUTTONS: { view: PresetView; label: string; aria: string }[] = [
  { view: 'front', label: 'Front', aria: 'Front view' },
  { view: 'side', label: 'Side', aria: 'Side view' },
  { view: 'back', label: 'Back', aria: 'Back view' },
  { view: 'threequarter', label: '3/4', aria: 'Three-quarter view' },
  { view: 'face', label: 'Face', aria: 'Face close-up' },
];

const GESTURE_LABELS: Record<Gesture, { en: string; th: string }> = {
  wave: { en: 'Wave', th: 'โบกมือ' },
  nod: { en: 'Nod', th: 'พยักหน้า' },
  bow: { en: 'Bow', th: 'โค้ง' },
  cheer: { en: 'Cheer', th: 'เย้!' },
  shy: { en: 'Shy', th: 'เขินอาย' },
};

const DEFAULT_VIEW: PresetView = 'threequarter';
const TURNTABLE_SPEED = 1.6;

interface InitialState {
  view: ViewName;
  expr: Expression;
  shot?: boolean;
}

/** Overlay UI: title, camera presets + tools, expression switcher, hints and keyboard shortcuts. */
export function mountControls(root: HTMLElement, viewer: Viewer, initial: InitialState): void {
  const ui = el('div', 'ui');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = { view: initial.view, expr: initial.expr };

  const live = el('div', 'sr-only');
  live.setAttribute('aria-live', 'polite');

  // ------------------------------------------------------------ views
  const viewsPanel = panel('views-panel', 'View', 'Camera view');
  const viewBtns = VIEW_BUTTONS.map(({ view, label, aria }) => {
    const b = button(`${viewIcon(view)}<span class="label">${label}</span>`, () => pickView(view));
    b.dataset.view = view;
    b.setAttribute('aria-label', aria);
    viewsPanel.group.appendChild(b);
    return b;
  });

  function pickView(view: PresetView, announce = true): void {
    setTurntable(false);
    viewer.setView(view, reducedMotion.matches);
    markView(view);
    if (announce) say(VIEW_BUTTONS.find((v) => v.view === view)!.aria);
  }
  function markView(view: ViewName): void {
    current.view = view;
    press(viewBtns, viewBtns.find((b) => b.dataset.view === view) ?? null);
    syncUrl();
  }

  // ------------------------------------------------------------ tools
  const tools = el('div', 'panel tools');
  tools.setAttribute('role', 'toolbar');
  tools.setAttribute('aria-label', 'Camera tools');
  const turntableBtn = button(`${toolIcon.turntable}<span class="label">Turntable</span>`, () =>
    setTurntable(!viewer.controls.autoRotate, true),
  );
  turntableBtn.classList.add('tool');
  turntableBtn.setAttribute('aria-pressed', 'false');
  turntableBtn.setAttribute('aria-keyshortcuts', 'T');
  turntableBtn.title = 'Turntable (T)';
  const resetBtn = button(`${toolIcon.reset}<span class="label">Reset</span>`, resetCamera);
  resetBtn.classList.add('tool');
  resetBtn.setAttribute('aria-keyshortcuts', 'R');
  resetBtn.title = 'Reset camera (R)';
  const hideBtn = button(`${toolIcon.hide}<span class="label">Hide UI</span>`, () => setHidden(true));
  hideBtn.classList.add('tool');
  hideBtn.setAttribute('aria-keyshortcuts', 'H');
  hideBtn.title = 'Hide UI (H)';
  tools.append(turntableBtn, resetBtn, hideBtn);

  function setTurntable(on: boolean, announce = false): void {
    if (initial.shot) on = false;
    viewer.controls.autoRotate = on;
    viewer.controls.autoRotateSpeed = TURNTABLE_SPEED;
    turntableBtn.setAttribute('aria-pressed', String(on));
    if (on) markView('free');
    if (announce) say(on ? 'Turntable on' : 'Turntable off');
  }
  function resetCamera(): void {
    pickView(DEFAULT_VIEW, false);
    say('Camera reset');
  }

  // Free orbiting leaves the named preset.
  viewer.controls.addEventListener('start', () => {
    if (current.view !== 'free') markView('free');
  });

  // ------------------------------------------------------------ expressions
  const exprPanel = panel('expr-panel', 'Expression', 'Expression');
  const exprBtns = EXPRESSIONS.map((expr, i) => {
    const { en, th } = EXPRESSION_LABELS[expr];
    const b = button(
      `${faceIcon(expr)}<span class="text"><span class="th" lang="th">${th}</span><span class="en">${en}</span></span><kbd aria-hidden="true">${i + 1}</kbd>`,
      () => pickExpr(expr),
    );
    b.dataset.expr = expr;
    b.setAttribute('aria-label', `${en} (${th})`);
    b.setAttribute('aria-keyshortcuts', String(i + 1));
    exprPanel.group.appendChild(b);
    return b;
  });

  function pickExpr(expr: Expression): void {
    viewer.setExpression(expr);
    current.expr = expr;
    press(exprBtns, exprBtns.find((b) => b.dataset.expr === expr) ?? null);
    const { en, th } = EXPRESSION_LABELS[expr];
    say(`${en}, ${th}`);
    syncUrl();
  }
  function cycleExpr(step: number): void {
    const i = EXPRESSIONS.indexOf(current.expr);
    pickExpr(EXPRESSIONS[(i + step + EXPRESSIONS.length) % EXPRESSIONS.length]);
  }

  // ------------------------------------------------------------ actions (walk, talk, gestures)
  const actionPanel = panel('action-panel', 'Action', 'Movement and gestures');
  const actionButton = (icon: ActionIconName, th: string, en: string, onClick: () => void) => {
    const b = button(`${actionIcon(icon)}<span class="text"><span class="th" lang="th">${th}</span><span class="en">${en}</span></span>`, onClick);
    b.setAttribute('aria-label', `${en} (${th})`);
    actionPanel.group.appendChild(b);
    return b;
  };
  const walkBtn = actionButton('walk', 'เดิน', 'Walk', () => setWalking(!viewer.kuro.walking));
  walkBtn.setAttribute('aria-pressed', String(viewer.kuro.walking));
  walkBtn.setAttribute('aria-keyshortcuts', 'W');
  walkBtn.title = 'Walk (W)';
  const talkBtn = actionButton('talk', 'พูด', 'Talk', () => setTalking(!viewer.kuro.isTalking));
  talkBtn.setAttribute('aria-pressed', String(viewer.kuro.isTalking));
  talkBtn.setAttribute('aria-keyshortcuts', 'S');
  talkBtn.title = 'Talk (S)';
  for (const g of GESTURES) {
    const { th, en } = GESTURE_LABELS[g];
    actionButton(g, th, en, () => {
      viewer.kuro.playGesture(g);
      say(`${en}, ${th}`);
    });
  }

  function setWalking(on: boolean): void {
    viewer.kuro.setWalking(on);
    walkBtn.setAttribute('aria-pressed', String(on));
    say(on ? 'Walking' : 'Stopped walking');
  }
  function setTalking(on: boolean): void {
    viewer.kuro.setTalking(on);
    talkBtn.setAttribute('aria-pressed', String(on));
    say(on ? 'Talking' : 'Stopped talking');
  }

  // ------------------------------------------------------------ title, hint, hide/show
  const brand = el('header', 'brand');
  brand.innerHTML = `${catDoodle}<div class="brand-text"><h1>Kuro</h1><p>3D Character Model ${heart('heart sub-heart')}</p></div>${sparkleDoodle}`;

  const hint = el('p', 'hint');
  hint.innerHTML = `
    <span class="hint-mouse"><b>Drag</b> orbit · <b>Scroll</b> zoom · <b>Right-drag</b> pan</span>
    <span class="hint-touch"><b>Drag</b> orbit · <b>Pinch</b> zoom · <b>Two fingers</b> pan</span>
    <span class="hint-keys"><kbd>1</kbd>–<kbd>8</kbd> / <kbd>←</kbd><kbd>→</kbd> expression · <kbd>W</kbd> walk · <kbd>S</kbd> talk · <kbd>T</kbd> turntable · <kbd>R</kbd> reset · <kbd>H</kbd> hide UI</span>`;

  const showBtn = button(`${toolIcon.show}<span class="sr-only">Show UI</span>`, () => setHidden(false));
  showBtn.className = 'show-ui';
  showBtn.title = 'Show UI (H)';
  const toast = el('div', 'toast');
  toast.setAttribute('aria-hidden', 'true');

  let toastTimer = 0;
  function setHidden(hidden: boolean, fromKey = false): void {
    ui.classList.toggle('is-hidden', hidden);
    for (const node of [brand, tools, viewsPanel.root, actionPanel.root, exprPanel.root, hint]) node.inert = hidden;
    showBtn.hidden = !hidden;
    if (hidden) {
      // Keyboard (H) hides cleanly for screenshots; button activation keeps focus on the way back.
      if (fromKey) (document.activeElement as HTMLElement | null)?.blur();
      else showBtn.focus({ preventScroll: true });
      toast.innerHTML = 'UI hidden · press <kbd>H</kbd> or tap the eye to show';
      toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('is-on'), 2200);
    } else {
      toast.classList.remove('is-on');
      if (!fromKey) hideBtn.focus({ preventScroll: true });
    }
    say(hidden ? 'Interface hidden. Press H to show it again.' : 'Interface shown');
  }

  // ------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= EXPRESSIONS.length) pickExpr(EXPRESSIONS[n - 1]);
    else if (e.key === 'ArrowRight') cycleExpr(1);
    else if (e.key === 'ArrowLeft') cycleExpr(-1);
    else if (e.key === 'h' || e.key === 'H') setHidden(!ui.classList.contains('is-hidden'), true);
    else if (e.key === 't' || e.key === 'T') setTurntable(!viewer.controls.autoRotate, true);
    else if (e.key === 'w' || e.key === 'W') setWalking(!viewer.kuro.walking);
    else if (e.key === 's' || e.key === 'S') setTalking(!viewer.kuro.isTalking);
    else if (e.key === 'r' || e.key === 'R') resetCamera();
    else return;
    e.preventDefault();
  });

  function syncUrl(): void {
    if (initial.shot) return;
    const q = new URLSearchParams(window.location.search);
    if (current.view === 'free') q.delete('view');
    else q.set('view', current.view);
    q.set('expr', current.expr);
    history.replaceState(null, '', `${window.location.pathname}?${q}`);
  }

  function say(msg: string): void {
    live.textContent = msg;
  }

  // ------------------------------------------------------------ mount
  showBtn.hidden = true;
  const dock = el('div', 'dock');
  dock.append(hint, viewsPanel.root, actionPanel.root, exprPanel.root);
  ui.append(brand, tools, dock, showBtn, toast, live);
  root.appendChild(ui);
  press(viewBtns, viewBtns.find((b) => b.dataset.view === initial.view) ?? null);
  press(exprBtns, exprBtns.find((b) => b.dataset.expr === initial.expr) ?? null);
}

// ------------------------------------------------------------ helpers

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** A rounded translucent panel with a "♡ Title ♡" heading and a button group. */
function panel(className: string, title: string, groupLabel: string): { root: HTMLElement; group: HTMLElement } {
  const root = el('section', `panel ${className}`);
  const id = `${className}-title`;
  root.innerHTML = `<h2 id="${id}">${heart()}<span>${title}</span>${heart()}</h2>`;
  const group = el('div', 'group');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', id);
  group.setAttribute('aria-description', groupLabel);
  root.appendChild(group);
  return { root, group };
}

function button(html: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = html;
  b.addEventListener('click', onClick);
  return b;
}

function press(all: HTMLButtonElement[], active: HTMLButtonElement | null): void {
  for (const b of all) b.setAttribute('aria-pressed', String(b === active));
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}
