/**
 * Synthesized sound effects and a soft looping background tune, so there are
 * no audio files to ship. Browsers keep audio suspended until the player
 * interacts, so the context is created/resumed on the first click or key.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('bubble-tea-muted') === '1';
  } catch {
    return false;
  }
})();

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.32;
      musicBus.connect(master);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('bubble-tea-muted', m ? '1' : '0');
  } catch {
    // ignore
  }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  if (!m) startMusic();
}
export const isMuted = (): boolean => muted;

export type Sound = 'click' | 'hover' | 'type' | 'coin' | 'pop' | 'bad' | 'done' | 'step' | 'page' | 'meow';

interface Note {
  f: number;
  /** start offset in seconds */
  at: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  /** pitch slide target */
  to?: number;
}

const SOUNDS: Record<Sound, Note[]> = {
  // soft bubbly "pop" for buttons and cards
  click: [{ f: 620, to: 980, at: 0, dur: 0.07, type: 'sine', vol: 0.22 }, { f: 1320, at: 0.02, dur: 0.05, type: 'triangle', vol: 0.06 }],
  hover: [{ f: 1500, at: 0, dur: 0.03, type: 'sine', vol: 0.04 }],
  type: [{ f: 1100, at: 0, dur: 0.018, type: 'triangle', vol: 0.03 }],
  coin: [{ f: 988, at: 0, dur: 0.07, type: 'square', vol: 0.06 }, { f: 1319, at: 0.07, dur: 0.18, type: 'square', vol: 0.06 }],
  pop: [{ f: 400, to: 900, at: 0, dur: 0.09, type: 'sine', vol: 0.22 }],
  bad: [{ f: 330, to: 220, at: 0, dur: 0.16, type: 'triangle', vol: 0.18 }, { f: 220, to: 160, at: 0.15, dur: 0.2, type: 'triangle', vol: 0.15 }],
  done: [
    { f: 784, at: 0, dur: 0.12, type: 'sine', vol: 0.18 },
    { f: 988, at: 0.09, dur: 0.12, type: 'sine', vol: 0.18 },
    { f: 1175, at: 0.18, dur: 0.12, type: 'sine', vol: 0.18 },
    { f: 1568, at: 0.27, dur: 0.3, type: 'sine', vol: 0.14 },
  ],
  step: [{ f: 160, at: 0, dur: 0.03, type: 'triangle', vol: 0.05 }],
  page: [{ f: 520, to: 780, at: 0, dur: 0.1, type: 'sine', vol: 0.1 }, { f: 1040, at: 0.06, dur: 0.12, type: 'sine', vol: 0.06 }],
  meow: [{ f: 700, to: 1100, at: 0, dur: 0.12, type: 'triangle', vol: 0.12 }, { f: 1100, to: 620, at: 0.12, dur: 0.22, type: 'triangle', vol: 0.12 }],
};

function play(notes: Note[], dest: AudioNode, t0: number): void {
  const a = ctx!;
  for (const n of notes) {
    const o = a.createOscillator();
    const g = a.createGain();
    const t = t0 + n.at;
    o.type = n.type ?? 'sine';
    o.frequency.setValueAtTime(n.f, t);
    if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, t + n.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(n.vol ?? 0.1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + n.dur + 0.02);
  }
}

export function sfx(name: Sound): void {
  if (muted) return;
  const a = audio();
  if (!a || a.state !== 'running' || !master) return;
  play(SOUNDS[name], master, a.currentTime);
}

// ---------------------------------------------------------------- background music

/** A gentle café loop: C – Am – F – G with a music-box melody. */
const BPM = 92;
const BEAT = 60 / BPM;
const CHORDS = [
  [261.63, 329.63, 392.0],
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [196.0, 246.94, 293.66],
];
const MELODY = [
  [659.25, 0, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25],
  [523.25, 0, 659.25, 587.33, 523.25, 440.0, 523.25, 0],
  [440.0, 523.25, 698.46, 659.25, 587.33, 0, 523.25, 587.33],
  [587.33, 0, 493.88, 587.33, 783.99, 0, 739.99, 783.99],
];
let musicOn = false;
let nextBar = 0;
let bar = 0;

function scheduleBar(t: number): void {
  const bus = musicBus!;
  const c = bar % 4;
  // soft pad chord
  for (const f of CHORDS[c]) play([{ f, at: 0, dur: BEAT * 4, type: 'sine', vol: 0.05 }], bus, t);
  // bass on beats 1 and 3
  for (const b of [0, 2]) play([{ f: CHORDS[c][0] / 2, at: b * BEAT, dur: BEAT * 1.6, type: 'triangle', vol: 0.09 }], bus, t);
  // music-box melody in eighths
  MELODY[c].forEach((f, i) => {
    if (!f) return;
    play([{ f, at: (i * BEAT) / 2, dur: BEAT * 0.9, type: 'sine', vol: 0.07 }, { f: f * 2, at: (i * BEAT) / 2, dur: BEAT * 0.4, type: 'sine', vol: 0.015 }], bus, t);
  });
  bar++;
}

export function startMusic(): void {
  if (musicOn || muted) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  musicOn = true;
  nextBar = a.currentTime + 0.1;
  const tick = () => {
    if (!ctx) return;
    while (nextBar < ctx.currentTime + 1.5) {
      scheduleBar(nextBar);
      nextBar += BEAT * 4;
    }
  };
  tick();
  setInterval(tick, 400);
}

// ---------------------------------------------------------------- global hooks

const CLICKABLE = '.btn:not(:disabled), .card:not(.locked), .lotcard, .tag3d.pin';

/** Unlock audio on the first gesture and give every button/card a click sound. */
export function initSound(): void {
  const unlock = () => {
    const a = audio();
    if (!a) return;
    const go = () => startMusic();
    if (a.state === 'running') go();
    else void a.resume().then(go);
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest?.(CLICKABLE);
      if (el) sfx('click');
      else if ((e.target as HTMLElement | null)?.closest?.('.dialog')) sfx('page');
    },
    { capture: true },
  );
  let last: Element | null = null;
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.(CLICKABLE) ?? null;
    if (el && el !== last) sfx('hover');
    last = el;
  });
}

if (import.meta.env.DEV) Object.assign(window, { __audio: () => ({ state: ctx?.state ?? 'none', music: musicOn, muted }) });
