import type { Engine, Stage } from '../three/engine';
import { clearUI, h, ui } from '../ui/dom';

export type Screen = (stage: Stage, data?: any) => void | (() => void);

const screens = new Map<string, Screen>();
let engine: Engine;
let cleanup: (() => void) | void;
let busy = false;
let screenHook: ((name: string, data: unknown) => void) | null = null;

/** Called whenever a screen starts, so a co-op host can show friends the same thing. */
export function onScreen(fn: ((name: string, data: unknown) => void) | null): void {
  screenHook = fn;
}

export const isBusy = (): boolean => busy;

export function initFlow(e: Engine): void {
  engine = e;
}

export function getEngine(): Engine {
  return engine;
}

export function registerScreen(name: string, s: Screen): void {
  screens.set(name, s);
}

function fader(): HTMLElement {
  let f = document.querySelector<HTMLElement>('.fader');
  if (!f) {
    f = h('div', 'fader');
    document.getElementById('app')!.appendChild(f);
  }
  return f;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Switches screens with a soft pink fade. */
export async function go(name: string, data?: unknown): Promise<void> {
  const s = screens.get(name);
  if (!s || busy) return;
  busy = true;
  screenHook?.(name, data);
  const f = fader();
  f.classList.add('on');
  await sleep(360);
  cleanup?.();
  cleanup = undefined;
  clearUI();
  const stage = engine.newStage();
  engine.daySky();
  try {
    cleanup = s(stage, data);
  } catch (err) {
    console.error(`screen "${name}" failed`, err);
  } finally {
    ui().scrollTop = 0;
    await sleep(60);
    f.classList.remove('on');
    busy = false;
  }
}
