/**
 * Painted cover art made of stacked image layers (see public/cover/README.md). The art is
 * optional: with no public/cover/layers.json the title screen keeps its 3D scene.
 *
 * Every layer is the same canvas size, so layers line up with no per-layer positioning. Each is
 * wrapped twice: the outer wrapper is moved by the pointer parallax (JS), the image inside plays
 * a CSS idle loop (breathing, sway...), so the two never fight over `transform`.
 */
export type CoverAnim = 'breathe' | 'sway' | 'bob' | 'flicker' | 'none';

export interface CoverLayer {
  id: string;
  src: string;
  /** 0 = far away (hardly moves) … 1 = close (moves most). */
  depth?: number;
  anim?: CoverAnim;
  /** Seconds for one idle loop. */
  seconds?: number;
  /** Where the idle motion pivots from, e.g. "50% 100%" for the feet. */
  origin?: string;
  /** Closed-eyes overlay for this layer; it flashes on every few seconds. */
  blink?: string;
}

export interface CoverManifest {
  /** Pixel size the layers were exported at (only the ratio matters). */
  width: number;
  height: number;
  /** Optional focus point 0-1 kept in view when the screen is narrower than the art. */
  focus?: { x: number; y: number };
  petals?: boolean;
  layers: CoverLayer[];
}

const BASE = `${import.meta.env.BASE_URL}cover/`;
/** How far (px) the closest layer slides at the screen edge. */
const PARALLAX_PX = 22;

export interface CoverHandle {
  dispose(): void;
}

function wait(img: HTMLImageElement): Promise<void> {
  return img.decode().catch(() => undefined);
}

/** Loads the cover, or resolves null when there is no cover art (or it failed to load). */
export async function mountCover(root: HTMLElement): Promise<CoverHandle | null> {
  let manifest: CoverManifest;
  try {
    const res = await fetch(`${BASE}layers.json`, { cache: 'no-cache' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    manifest = (await res.json()) as CoverManifest;
    if (!manifest.layers?.length || !manifest.width || !manifest.height) return null;
  } catch {
    return null;
  }

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.className = 'cover';
  const stage = document.createElement('div');
  stage.className = 'cover-stage';
  stage.style.aspectRatio = `${manifest.width} / ${manifest.height}`;
  const focus = manifest.focus ?? { x: 0.5, y: 0.5 };
  el.style.setProperty('--fx', `${focus.x * 100}%`);
  el.style.setProperty('--fy', `${focus.y * 100}%`);
  el.append(stage);

  const movers: { wrap: HTMLElement; depth: number }[] = [];
  const timers: number[] = [];
  const images: Promise<void>[] = [];
  let k = 0;
  for (const layer of manifest.layers) {
    const wrap = document.createElement('div');
    wrap.className = 'cover-layer';
    wrap.dataset.layer = layer.id;
    const img = document.createElement('img');
    img.src = BASE + layer.src;
    img.alt = '';
    img.draggable = false;
    if (!calm && layer.anim && layer.anim !== 'none') {
      img.classList.add(`cv-${layer.anim}`);
      // layers drift out of step instead of moving in unison
      img.style.animationDuration = `${layer.seconds ?? 4 + (k % 4)}s`;
      img.style.animationDelay = `${-((k * 1.7) % 5)}s`;
      if (layer.origin) img.style.transformOrigin = layer.origin;
    }
    wrap.append(img);
    images.push(wait(img));
    if (layer.blink && !calm) {
      const eyes = document.createElement('img');
      eyes.src = BASE + layer.blink;
      eyes.alt = '';
      eyes.className = 'cover-eyes';
      if (layer.anim && layer.anim !== 'none') {
        eyes.classList.add(`cv-${layer.anim}`);
        eyes.style.animationDuration = img.style.animationDuration;
        eyes.style.animationDelay = img.style.animationDelay;
        if (layer.origin) eyes.style.transformOrigin = layer.origin;
      }
      wrap.append(eyes);
      images.push(wait(eyes));
      const blinkLater = () => {
        timers.push(
          window.setTimeout(() => {
            eyes.style.opacity = '1';
            timers.push(window.setTimeout(() => ((eyes.style.opacity = '0'), blinkLater()), 120));
          }, 2500 + Math.random() * 3500),
        );
      };
      blinkLater();
    }
    stage.append(wrap);
    if (layer.depth) movers.push({ wrap, depth: layer.depth });
    k++;
  }

  // the first screen waits for the pictures, so the cover never pops in layer by layer
  await Promise.all(images);

  // drifting petals on a small canvas above everything
  let canvas: HTMLCanvasElement | null = null;
  let petals: { x: number; y: number; r: number; vx: number; vy: number; a: number; va: number; hue: number }[] = [];
  if (manifest.petals && !calm) {
    canvas = document.createElement('canvas');
    canvas.className = 'cover-petals';
    el.append(canvas);
    petals = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), r: 4 + Math.random() * 6, vx: -0.012 - Math.random() * 0.02, vy: 0.02 + Math.random() * 0.03, a: Math.random() * 6, va: (Math.random() - 0.5) * 2, hue: 330 + Math.random() * 20 }));
  }

  root.insertBefore(el, root.querySelector('#ui'));

  // pointer or tilt parallax, eased so it glides
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  const onMove = (e: PointerEvent) => {
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    tx = Math.max(-1, Math.min(1, e.gamma / 25));
    ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
  };
  if (!calm) {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('deviceorientation', onTilt);
  }

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const ease = 1 - Math.exp(-dt * 5);
    cx += (tx - cx) * ease;
    cy += (ty - cy) * ease;
    for (const m of movers) m.wrap.style.transform = `translate3d(${(-cx * m.depth * PARALLAX_PX).toFixed(2)}px, ${(-cy * m.depth * PARALLAX_PX * 0.6).toFixed(2)}px, 0)`;
    if (canvas) {
      const w = (canvas.width = el.clientWidth);
      const h = (canvas.height = el.clientHeight);
      const g = canvas.getContext('2d')!;
      g.clearRect(0, 0, w, h);
      for (const p of petals) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.a += p.va * dt;
        if (p.y > 1.05 || p.x < -0.05) {
          p.y = -0.05;
          p.x = 0.3 + Math.random() * 0.8;
        }
        g.save();
        g.translate(p.x * w, p.y * h);
        g.rotate(p.a);
        g.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.a * 1.3)));
        g.fillStyle = `hsla(${p.hue}, 90%, 85%, 0.85)`;
        g.beginPath();
        g.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  };
  // no loop for still art or hidden tabs
  const visible = () => {
    cancelAnimationFrame(raf);
    if (!calm && document.visibilityState === 'visible') {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', visible);
  visible();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
      document.removeEventListener('visibilitychange', visible);
      el.remove();
    },
  };
}
